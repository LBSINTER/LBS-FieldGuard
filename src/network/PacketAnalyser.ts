/**
 * LBS FieldGuard — Network Packet Analyser (Android only)
 *
 * Uses VpnService TUN interface via RNPacketCapture NativeModule to analyse
 * IP traffic for known threat patterns.
 *
 * The Windows PCAP/Npcap path has been removed; Windows monitoring is now
 * handled via the browser-based PC viewer + relay server (BridgeService).
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { useAppStore } from '../store/appStore';
import { Alert } from '../types';
import { nanoid } from '../utils/id';

// Published Pegasus/NSO Group C2 subnets (Citizen Lab / Amnesty Tech reports)
const NSO_C2_SUBNETS = [
  '5.199.', '37.120.', '45.142.', '46.166.', '46.169.',
  '62.210.', '78.31.', '82.221.', '84.38.', '87.121.',
  '89.45.', '91.108.', '91.109.', '92.222.', '94.23.',
  '95.211.', '104.21.', '176.9.', '185.10.', '185.105.',
  '185.161.', '185.244.', '188.68.', '195.123.',
];

// SS7/SIGTRAN ports that must not appear from commercial IP space
const SS7_PORTS = [2905, 2910, 3565, 3863, 9900, 14001];

const RN_PACKET_CAPTURE = NativeModules.RNPacketCapture as
  | { startVPN: () => Promise<void>; stopVPN: () => void }
  | undefined;

let _emitter: NativeEventEmitter | null = null;
let _running = false;

export function startPacketCapture() {
  if (Platform.OS !== 'android') return;  // Only Android; PC viewer handles Windows
  if (_running) return;
  if (!RN_PACKET_CAPTURE) {
    console.warn('[FieldGuard] RNPacketCapture native module unavailable — packet analysis disabled');
    return;
  }
  _running = true;
  RN_PACKET_CAPTURE.startVPN().catch((e: Error) => {
    console.warn('[FieldGuard] PacketCapture VPN start failed:', e.message);
    _running = false;
  });
  _emitter = new NativeEventEmitter(NativeModules.RNPacketCapture);
  _emitter.addListener('onPacket', _handlePacket);
}

export function stopPacketCapture() {
  if (!_running) return;
  _running = false;
  RN_PACKET_CAPTURE?.stopVPN();
  _emitter?.removeAllListeners('onPacket');
  _emitter = null;
}

interface RawPacket {
  srcIp: string;
  dstIp: string;
  proto: number;
  srcPort: number;
  dstPort: number;
  payloadHex: string;
  length: number;
}

function _handlePacket(packet: RawPacket) {
  const { addAlert } = useAppStore.getState();

  for (const subnet of NSO_C2_SUBNETS) {
    if (packet.dstIp.startsWith(subnet) || packet.srcIp.startsWith(subnet)) {
      _emit(addAlert, {
        severity: 'critical', category: 'pegasus_indicator',
        title: 'NSO/Pegasus C2 network contact',
        detail: `${packet.srcIp}:${packet.srcPort} → ${packet.dstIp}:${packet.dstPort} (proto ${packet.proto})`,
        raw: packet.payloadHex.slice(0, 128),
      });
      return;
    }
  }

  if (SS7_PORTS.includes(packet.dstPort) || SS7_PORTS.includes(packet.srcPort)) {
    _emit(addAlert, {
      severity: 'high', category: 'sigtran_probe',
      title: `SS7/SIGTRAN port contact (${packet.dstPort || packet.srcPort})`,
      detail: `${packet.srcIp} → ${packet.dstIp}:${packet.dstPort}`,
      raw: packet.payloadHex.slice(0, 128),
    });
    return;
  }

  if ((packet.dstPort === 2123 || packet.dstPort === 2152) && !_isOperatorAddress(packet.srcIp)) {
    _emit(addAlert, {
      severity: 'medium', category: 'packet_anomaly',
      title: 'Unexpected GTP tunnel',
      detail: `GTP from ${packet.srcIp}:${packet.srcPort} → local`,
      raw: packet.payloadHex.slice(0, 64),
    });
    return;
  }

  if (packet.proto === 1 && packet.payloadHex.startsWith('05')) {
    _emit(addAlert, {
      severity: 'high', category: 'packet_anomaly',
      title: 'ICMP Redirect received — possible MITM',
      detail: `From ${packet.srcIp}`,
      raw: packet.payloadHex.slice(0, 64),
    });
  }
}

function _isOperatorAddress(ip: string): boolean {
  return ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.');
}

function _emit(addAlert: (a: Alert) => void, fields: Omit<Alert, 'id' | 'ts'>) {
  addAlert({ id: nanoid(), ts: Date.now(), ...fields });
}
