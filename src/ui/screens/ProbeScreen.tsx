/**
 * LBS FieldGuard — Probe Screen
 *
 * Shows the live probe connection status, latency graph, and allows
 * manual reconnect / disconnect.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../store/appStore';
import { initProbe, disconnectProbe } from '../probe/ProbeClient';
import Icon from './components/Icon';

const STATUS_COLOR: Record<string, string> = {
  connected:    '#3fb950',
  connecting:   '#f0883e',
  disconnected: '#8b949e',
  error:        '#f85149',
};

export default function ProbeScreen() {
  const { probeStatus, probeLatencyMs, setProbeStatus } = useAppStore();
  const color = STATUS_COLOR[probeStatus] ?? '#8b949e';

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
          <Icon name="refresh" size={18} color="#e6edf3" />
          <Text style={styles.btnTxt}> Reconnect</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnRed]} onPress={disconnect}>
          <Icon name="close-circle" size={18} color="#f85149" />
          <Text style={[styles.btnTxt, { color: '#f85149' }]}> Disconnect</Text>
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
  root:       { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title:      { fontSize: 20, fontWeight: '700', color: '#e6edf3', marginBottom: 16 },
  card:       { backgroundColor: '#161b22', borderRadius: 8, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  status:     { fontSize: 22, fontWeight: '700' },
  host:       { fontSize: 13, color: '#8b949e', fontFamily: 'monospace' },
  latency:    { fontSize: 28, fontWeight: '700', color: '#58a6ff' },
  actions:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#161b22', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', padding: 10 },
  btnRed:     { borderColor: '#f85149' },
  btnTxt:     { color: '#e6edf3', fontSize: 14 },
  infoCard:   { backgroundColor: '#161b22', borderRadius: 8, borderWidth: 1, borderColor: '#30363d', padding: 16, marginTop: 16, gap: 4 },
  infoLabel:  { fontSize: 11, color: '#8b949e', marginTop: 8 },
  infoVal:    { fontSize: 13, color: '#e6edf3' },
});
