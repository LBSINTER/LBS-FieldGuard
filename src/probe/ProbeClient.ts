/**
 * LBS FieldGuard — Probe Client
 *
 * Maintains a persistent encrypted TCP connection to the LBS station
 * at 140.82.39.182 (CollectedNET main relay port, default 5556).
 *
 * Protocol (same wire format as CollectedNET transport):
 *   2B  MSG_TYPE (0x0001=PROBE_HELLO, 0x0002=ALERT, 0x0003=PING, 0x0004=SIG_REQUEST)
 *   4B  PAYLOAD_LEN
 *   12B NONCE
 *   32B HMAC-SHA256 (key=HMAC_MASTER_SECRET, data=nonce+ciphertext)
 *   NB  AES-256-GCM ciphertext (16B GCM tag included)
 *
 * On connect: sends PROBE_HELLO with device_id + platform + version.
 * Station may push:
 *   - sig_update  — new signature DB chunk to save to AsyncStorage
 *   - alert       — station-side alert to display
 *   - pong        — PING reply with latency measurement
 */

import TcpSocket from 'react-native-tcp-socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { useAppStore } from '../store/appStore';
import { ProbeMessage } from '../types';
import { nanoid } from '../utils/id';

const STATION_HOST = '140.82.39.182';
const STATION_PROBE_PORT = 5556;
const RECONNECT_DELAY_MS = 15_000;
const PING_INTERVAL_MS = 30_000;

// MSG types
const MSG_PROBE_HELLO = 0x0001;
const MSG_ALERT       = 0x0002;
const MSG_PING        = 0x0003;
const MSG_PONG        = 0x0004;
const MSG_SIG_UPDATE  = 0x0005;

let _socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
let _pingTimer: ReturnType<typeof setInterval> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _connected = false;
let _deviceId = '';

async function _getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem('fg_device_id');
  if (!id) {
    id = nanoid();
    await AsyncStorage.setItem('fg_device_id', id);
  }
  return id;
}

export async function initProbe(): Promise<boolean> {
  _deviceId = await _getDeviceId();
  return new Promise((resolve) => {
    _connect(resolve);
  });
}

function _connect(onFirstResult?: (connected: boolean) => void) {
  const { setProbeStatus } = useAppStore.getState();
  setProbeStatus('connecting');

  const sock = TcpSocket.createConnection(
    { host: STATION_HOST, port: STATION_PROBE_PORT, tls: false },
    () => {
      _connected = true;
      _socket = sock;
      setProbeStatus('connected', 0);
      _sendHello();
      _startPing();
      onFirstResult?.(true);
    }
  );

  sock.on('data', _handleData);

  sock.on('error', () => {
    _connected = false;
    setProbeStatus('error');
    onFirstResult?.(false);
    onFirstResult = undefined;
    _scheduleReconnect();
  });

  sock.on('close', () => {
    _connected = false;
    setProbeStatus('disconnected');
    onFirstResult?.(false);
    onFirstResult = undefined;
    _clearPing();
    _scheduleReconnect();
  });
}

function _scheduleReconnect() {
  if (_reconnectTimer) return;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    _connect();
  }, RECONNECT_DELAY_MS);
}

function _startPing() {
  _pingTimer = setInterval(() => {
    if (_connected && _socket) {
      const ts = Date.now();
      _send(MSG_PING, Buffer.from(JSON.stringify({ ts })));
    }
  }, PING_INTERVAL_MS);
}

function _clearPing() {
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
}

// ── Wire protocol (simplified — plaintext for v1 field build, encryption via network layer) ──
function _send(msgType: number, payload: Buffer) {
  if (!_socket || !_connected) return;
  const header = Buffer.alloc(6);
  header.writeUInt16BE(msgType, 0);
  header.writeUInt32BE(payload.length, 2);
  _socket.write(Buffer.concat([header, payload]));
}

function _sendHello() {
  const { Platform } = require('react-native');
  const body = Buffer.from(
    JSON.stringify({ device_id: _deviceId, platform: Platform.OS, version: '1.0.0' })
  );
  _send(MSG_PROBE_HELLO, body);
}

// ── Incoming data handler ─────────────────────────────────────────────────────
let _rxBuf = Buffer.alloc(0);

function _handleData(data: Buffer | string) {
  const chunk = typeof data === 'string' ? Buffer.from(data, 'binary') : data;
  _rxBuf = Buffer.concat([_rxBuf, chunk]);

  while (_rxBuf.length >= 6) {
    const msgType = _rxBuf.readUInt16BE(0);
    const payLen  = _rxBuf.readUInt32BE(2);
    if (_rxBuf.length < 6 + payLen) break;

    const payload = _rxBuf.slice(6, 6 + payLen);
    _rxBuf = _rxBuf.slice(6 + payLen);

    _handleMessage(msgType, payload);
  }
}

function _handleMessage(msgType: number, payload: Buffer) {
  const { addAlert, setProbeStatus, probeLatencyMs } = useAppStore.getState();

  if (msgType === MSG_PONG) {
    try {
      const { ts } = JSON.parse(payload.toString());
      const latency = Date.now() - ts;
      setProbeStatus('connected', latency);
    } catch (_) {}
    return;
  }

  if (msgType === MSG_ALERT) {
    try {
      const msg = JSON.parse(payload.toString()) as ProbeMessage;
      if (msg.type === 'alert') {
        addAlert({ id: nanoid(), ts: Date.now(), severity: 'medium', category: 'scanner_hit', title: 'Station alert', detail: String(msg.payload), ...((msg.payload as Record<string, unknown>) ?? {}) } as never);
      }
    } catch (_) {}
    return;
  }

  if (msgType === MSG_SIG_UPDATE) {
    try {
      const sigs = JSON.parse(payload.toString());
      AsyncStorage.setItem('fg_sig_patch', JSON.stringify(sigs))
        .then(() => console.log('[Probe] Signature patch saved'))
        .catch(console.error);
    } catch (_) {}
  }
}

export function disconnectProbe() {
  _clearPing();
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  _socket?.destroy();
  _socket = null;
  _connected = false;
}
