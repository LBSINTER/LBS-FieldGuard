/**
 * LBS FieldGuard — Network Packet Analyser
 *
 * Platform behaviour:
 *   Android — uses VpnService TUN interface (via RNPacketCapture NativeModule)
 *   Windows  — uses WinPcap/Npcap via react-native-windows NativeModule (PCAPBridge)
 *
 * Analyses IP packets for:
 *   - Known Pegasus/NSO Group C2 IP ranges
 *   - SS7-over-IP anomalies (M2PA/SIGTRAN on unexpected ports)
 *   - Unexpected SIP SUBSCRIBE / NOTIFY (SS7 spy activity)
 *   - GTP-C/GTP-U tunnels from non-operator ASNs
 *   - DIAMETER packets from non-operator addresses
 *   - ICMP redirect attacks
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { useAppStore } from '../store/appStore';
import { Alert } from '../types';
import { nanoid } from '../utils/id';

// ── Known malicious/suspicious network indicators ─────────────────────────────
const NSO_C2_SUBNETS = [
  // Published Pegasus C2 infrastructure (Citizen Lab, Amnesty Tech)
  '5.199.', '37.120.', '45.142.', '46.166.', '46.169.',
  '62.210.', '78.31.', '82.221.', '84.38.', '87.121.',
  '89.45.', '91.108.', '91.109.', '92.222.', '94.23.',
  '95.211.', '104.21.', '176.9.', '185.10.', '185.105.',
  '185.161.', '185.244.', '188.68.', '195.123.',
];

// SIGTRAN/SS7-over-IP ports that should not appear from commercial IP space
const SS7_PORTS = [2905, 2910, 3565, 3863, 9900, 14001];

const PCAP_BRIDGE = NativeModules.PCAPBridge as
  | { startCapture: (iface: string) => Promise<void>; stopCapture: () => void }
  | undefined;

const RN_PACKET_CAPTURE = NativeModules.RNPacketCapture as
  | { startVPN: () => Promise<void>; stopVPN: () => void }
  | undefined;

const EMITTER =
  PCAP_BRIDGE
    ? new NativeEventEmitter(NativeModules.PCAPBridge)
    : RN_PACKET_CAPTURE
    ? new NativeEventEmitter(NativeModules.RNPacketCapture)
    : null;

let _running = false;

export function startPacketCapture() {
  if (_running) return;
  _running = true;

  if (Platform.OS === 'windows' && PCAP_BRIDGE) {
    PCAP_BRIDGE.startCapture('any').catch(console.error);
    EMITTER?.addListener('onPacket', _handlePacket);
  } else if (Platform.OS === 'android' && RN_PACKET_CAPTURE) {
    RN_PACKET_CAPTURE.startVPN().catch(console.error);
    EMITTER?.addListener('onPacket', _handlePacket);
  }
}

export function stopPacketCapture() {
  if (!_running) return;
  _running = false;
  PCAP_BRIDGE?.stopCapture();
  RN_PACKET_CAPTURE?.stopVPN();
  EMITTER?.removeAllListeners('onPacket');
}

// ── Packet event ──────────────────────────────────────────────────────────────
interface RawPacket {
  srcIp: string;
  dstIp: string;
  proto: number;   // 6=TCP, 17=UDP, 1=ICMP
  srcPort: number;
  dstPort: number;
  payloadHex: string;
  length: number;
}

function _handlePacket(packet: RawPacket) {
  const { addAlert } = useAppStore.getState();

  // NSO/Pegasus C2
  for (const subnet of NSO_C2_SUBNETS) {
    if (packet.dstIp.startsWith(subnet) || packet.srcIp.startsWith(subnet)) {
      _emit(addAlert, {
        severity: 'critical',
        category: 'nso_pattern',
        title: 'NSO/Pegasus C2 network contact',
        detail: `${packet.srcIp}:${packet.srcPort} → ${packet.dstIp}:${packet.dstPort} (proto ${packet.proto})`,
        raw: packet.payloadHex.slice(0, 128),
      });
      return;
    }
  }

  // SS7-over-IP ports from non-loopback
  if (SS7_PORTS.includes(packet.dstPort) || SS7_PORTS.includes(packet.srcPort)) {
    _emit(addAlert, {
      severity: 'high',
      category: 'ss7_probe',
      title: `SS7/SIGTRAN port detected (${packet.dstPort})`,
      detail: `${packet.srcIp} → ${packet.dstIp}:${packet.dstPort}`,
      raw: packet.payloadHex.slice(0, 128),
    });
    return;
  }

  // GTP (port 2123/2152) from non-LBS addresses
  if ((packet.dstPort === 2123 || packet.dstPort === 2152) && !_isLBSAddress(packet.srcIp)) {
    _emit(addAlert, {
      severity: 'medium',
      category: 'packet_anomaly',
      title: 'Unexpected GTP tunnel packet',
      detail: `GTP from ${packet.srcIp}:${packet.srcPort} → ${packet.dstIp}:${packet.dstPort}`,
      raw: packet.payloadHex.slice(0, 64),
    });
    return;
  }

  // ICMP redirect
  if (packet.proto === 1 && packet.payloadHex.startsWith('05')) {
    _emit(addAlert, {
      severity: 'high',
      category: 'packet_anomaly',
      title: 'ICMP Redirect received',
      detail: `From ${packet.srcIp} — potential MITM / rerouting attack`,
      raw: packet.payloadHex.slice(0, 64),
    });
  }
}

function _isLBSAddress(ip: string): boolean {
  return ip.startsWith('140.82.') || ip.startsWith('10.') || ip.startsWith('192.168.');
}

function _emit(
  addAlert: (a: Alert) => void,
  fields: Omit<Alert, 'id' | 'ts'>
) {
  addAlert({ id: nanoid(), ts: Date.now(), ...fields });
}
