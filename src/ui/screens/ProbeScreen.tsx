import { useScreenSize } from '../hooks/useScreenSize';
/**
 * LBS FieldGuard — Probe Screen
 * Light theme matching lbs-int.com.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../../store/appStore';
import { initProbe, disconnectProbe } from '../../probe/ProbeClient';
import Icon from '../components/Icon';

const STATUS_COLOR: Record<string, string> = {
  connected:    '#16a34a',
  connecting:   '#d97706',
  disconnected: '#94a3b8',
  error:        '#dc2626',
};

export default function ProbeScreen() {
  const { probeStatus, probeLatencyMs, setProbeStatus } = useAppStore();
  const { scale, fontSize, maxContentWidth } = useScreenSize();
  const color = STATUS_COLOR[probeStatus] ?? '#94a3b8';

  async function reconnect() {
    setProbeStatus('connecting');
    await initProbe();
  }

  function disconnect() {
    disconnectProbe();
    setProbeStatus('disconnected');
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Station Probe</Text>

      <View style={[styles.card, { borderColor: color }]}>
        <Icon name="antenna" size={32} color={color} />
        <Text style={[styles.status, { color }]}>{probeStatus.toUpperCase()}</Text>
        <Text style={styles.host}>140.82.39.182:5556</Text>
        {probeLatencyMs >= 0 && (
          <Text style={styles.latency}>{probeLatencyMs} ms</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={reconnect}>
          <Icon name="refresh" size={18} color="#0f172a" />
          <Text style={styles.btnTxt}> Reconnect</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnRed]} onPress={disconnect}>
          <Icon name="close-circle" size={18} color="#dc2626" />
          <Text style={[styles.btnTxt, { color: '#dc2626' }]}> Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Protocol</Text>
        <Text style={styles.infoVal}>LBS FieldGuard Probe v1 (raw TCP)</Text>
        <Text style={styles.infoLabel}>Encryption</Text>
        <Text style={styles.infoVal}>Network layer via CollectedNET relay</Text>
        <Text style={styles.infoLabel}>Functions</Text>
        <Text style={styles.infoVal}>Signature updates · Station alerts · Telemetry relay</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  title:      { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  card:       { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  status:     { fontSize: 22, fontWeight: '700' },
  host:       { fontSize: 13, color: '#64748b', fontFamily: 'monospace' },
  latency:    { fontSize: 28, fontWeight: '700', color: '#2563eb' },
  actions:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  btnRed:     { borderColor: '#dc2626' },
  btnTxt:     { color: '#0f172a', fontSize: 14 },
  infoCard:   { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginTop: 16, gap: 4 },
  infoLabel:  { fontSize: 11, color: '#64748b', marginTop: 8 },
  infoVal:    { fontSize: 13, color: '#0f172a' },
});
