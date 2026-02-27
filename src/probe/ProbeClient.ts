/**
 * LBS FieldGuard — Station Probe Client
 *
 * Maintains a persistent TCP connection to the LBS station (140.82.39.182:5556).
 * Protocol: 2B MSG_TYPE | 4B PAYLOAD_LEN | NB JSON payload
 *
 * On connect: sends PROBE_HELLO with device_id + platform + version.
 * Station may push: sig_update | alert | pong
 */

import TcpSocket from 'react-native-tcp-socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { useAppStore } from '../store/appStore';
import { nanoid } from '../utils/id';
import { PROBE_HOST, PROBE_PORT, APP_VERSION } from '../config/build';

const RECONNECT_DELAY_MS = 15_000;
const PING_INTERVAL_MS   = 30_000;

const MSG_PROBE_HELLO = 0x0001;
const MSG_ALERT       = 0x0002;
const MSG_PING        = 0x0003;
const MSG_PONG        = 0x0004;
const MSG_SIG_UPDATE  = 0x0005;

const KEYS = {
  DEVICE_ID:    'fg_device_id',
  STATION_HOST: 'fg_station_host',
  STATION_PORT: 'fg_station_port',
};

let _socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
let _pingTimer: ReturnType<typeof setInterval> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _connected = false;
let _deviceId  = '';
let _stopped   = false;

async function _getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEYS.DEVICE_ID);
  if (!id) {
    id = nanoid();
    await AsyncStorage.setItem(KEYS.DEVICE_ID, id);
  }
  return id;
}

async function _getSettings(): Promise<{ host: string; port: number }> {
  const [hostRaw, portRaw] = await AsyncStorage.multiGet([KEYS.STATION_HOST, KEYS.STATION_PORT]);
  const host = hostRaw[1] ?? PROBE_HOST;
  const port = parseInt(portRaw[1] ?? String(PROBE_PORT), 10) || PROBE_PORT;
  return { host, port };
}

export async function initProbe(): Promise<boolean> {
  _stopped  = false;
  _deviceId = await _getDeviceId();
  return new Promise((resolve) => {
    _connect(resolve);
  });
}

export function disconnectProbe(): void {
  _stopped = true;
  _clearPing();
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  try { _socket?.destroy(); } catch (_) {}
  _socket    = null;
  _connected = false;
  useAppStore.getState().setProbeStatus('disconnected');
}

function _connect(onFirstResult?: (connected: boolean) => void) {
  if (_stopped) { onFirstResult?.(false); return; }
  const { setProbeStatus } = useAppStore.getState();
  setProbeStatus('connecting');

  _getSettings().then(({ host, port }) => {
    const sock = TcpSocket.createConnection({ host, port, tls: false }, () => {
      _connected = true;
      _socket    = sock;
      setProbeStatus('connected', 0);
      _sendHello(sock);
      _startPing(sock);
      onFirstResult?.(true);
      onFirstResult = undefined;
    });

    sock.on('data', _handleData);

    sock.on('error', (err) => {
      console.warn('[FieldGuard] probe socket error:', err.message);
      _connected = false;
      setProbeStatus('error');
      onFirstResult?.(false);
      onFirstResult = undefined;
      if (!_stopped) _scheduleReconnect();
    });

    sock.on('close', () => {
      _connected = false;
      setProbeStatus('disconnected');
      onFirstResult?.(false);
      onFirstResult = undefined;
      _clearPing();
      if (!_stopped) _scheduleReconnect();
    });
  }).catch(() => {
    onFirstResult?.(false);
    onFirstResult = undefined;
    if (!_stopped) _scheduleReconnect();
  });
}

function _scheduleReconnect() {
  if (_reconnectTimer || _stopped) return;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    _connect();
  }, RECONNECT_DELAY_MS);
}

function _startPing(sock: ReturnType<typeof TcpSocket.createConnection>) {
  _clearPing();
  _pingTimer = setInterval(() => {
    if (_connected && sock) {
      const ts = Date.now();
      _send(sock, MSG_PING, Buffer.from(JSON.stringify({ ts })));
    }
  }, PING_INTERVAL_MS);
}

function _clearPing() {
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
}

function _send(
  sock: ReturnType<typeof TcpSocket.createConnection>,
  msgType: number,
  payload: Buffer,
) {
  const header = Buffer.alloc(6);
  header.writeUInt16BE(msgType, 0);
  header.writeUInt32BE(payload.length, 2);
  try { sock.write(Buffer.concat([header, payload])); } catch (_) {}
}

function _sendHello(sock: ReturnType<typeof TcpSocket.createConnection>) {
  _send(sock, MSG_PROBE_HELLO, Buffer.from(JSON.stringify({
    device_id: _deviceId,
    platform: 'android',
    version: APP_VERSION,
  })));
}

let _rxBuf = Buffer.alloc(0);

function _handleData(raw: Buffer | string) {
  const chunk = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
  _rxBuf = Buffer.concat([_rxBuf, chunk]);

  while (_rxBuf.length >= 6) {
    const msgType   = _rxBuf.readUInt16BE(0);
    const payloadLen = _rxBuf.readUInt32BE(2);
    if (_rxBuf.length < 6 + payloadLen) break;

    const payload = _rxBuf.slice(6, 6 + payloadLen);
    _rxBuf = _rxBuf.slice(6 + payloadLen);

    try { _dispatchMsg(msgType, payload); } catch (e) {
      console.warn('[FieldGuard] probe msg dispatch error:', e);
    }
  }

  // Guard against unbounded accumulation
  if (_rxBuf.length > 1_000_000) _rxBuf = Buffer.alloc(0);
}

function _dispatchMsg(msgType: number, payload: Buffer) {
  const { setProbeStatus, addAlert } = useAppStore.getState();

  if (msgType === MSG_PONG) {
    let sent = 0;
    try { sent = JSON.parse(payload.toString('utf8')).ts ?? 0; } catch (_) {}
    const latency = sent ? Date.now() - sent : -1;
    setProbeStatus('connected', latency);
    return;
  }

  if (msgType === MSG_ALERT) {
    try {
      const a = JSON.parse(payload.toString('utf8'));
      if (a.title) {
        addAlert({
          id: nanoid(), ts: Date.now(),
          severity: a.severity ?? 'info',
          category: a.category ?? 'ril_anomaly',
          title: a.title, detail: a.detail ?? '', raw: a.raw,
        });
      }
    } catch (_) {}
    return;
  }

  if (msgType === MSG_SIG_UPDATE) {
    // Station pushed new signature DB — persist to AsyncStorage
    try {
      const json = payload.toString('utf8');
      AsyncStorage.setItem('fg_sig_update', json).catch(() => {});
    } catch (_) {}
    return;
  }
}
