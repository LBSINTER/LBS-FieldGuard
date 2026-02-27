/**
 * LBS FieldGuard — Dashboard Screen
 *
 * Shows:
 *   - Probe connection status + latency
 *   - Signature count
 *   - Recent alert summary (severity donut)
 *   - Live RIL event count
 *   - Quick-action buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useAppStore } from '../store/appStore';
import Icon from './components/Icon';

const STATUS_COLOR: Record<string, string> = {
  connected:    '#3fb950',
  connecting:   '#f0883e',
  disconnected: '#8b949e',
  error:        '#f85149',
};

export default function DashboardScreen() {
  const {
    probeStatus,
    probeLatencyMs,
    signaturesLoaded,
    alerts,
    rilEvents,
    probeConnected,
  } = useAppStore();

  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const high     = alerts.filter((a) => a.severity === 'high').length;
  const medium   = alerts.filter((a) => a.severity === 'medium').length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>LBS FieldGuard</Text>

      {/* Probe status card */}
      <View style={[styles.card, { borderColor: STATUS_COLOR[probeStatus] }]}>
        <View style={styles.row}>
          <Icon name="antenna" size={20} color={STATUS_COLOR[probeStatus]} />
          <Text style={[styles.cardTitle, { color: STATUS_COLOR[probeStatus] }]}>
            {' Station Probe — '}{probeStatus.toUpperCase()}
          </Text>
        </View>
        {probeLatencyMs >= 0 && (
          <Text style={styles.cardSub}>Latency: {probeLatencyMs} ms</Text>
        )}
        <Text style={styles.cardSub}>Station: 140.82.39.182:5556</Text>
      </View>

      {/* Signature DB card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name="database-check" size={20} color="#58a6ff" />
          <Text style={styles.cardTitle}> Signature DB</Text>
        </View>
        <Text style={styles.cardSub}>{signaturesLoaded} patterns loaded</Text>
      </View>

      {/* Threat summary */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Threat Summary</Text>
        <View style={styles.row}>
          <_Badge label="Critical" count={critical} color="#f85149" />
          <_Badge label="High" count={high} color="#f0883e" />
          <_Badge label="Medium" count={medium} color="#d29922" />
        </View>
      </View>

      {/* RIL monitor */}
      {Platform.OS === 'android' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Icon name="sim" size={20} color="#58a6ff" />
            <Text style={styles.cardTitle}> RIL Monitor</Text>
          </View>
          <Text style={styles.cardSub}>{rilEvents.length} RIL events captured</Text>
          <Text style={styles.cardSub}>
            Flagged: {rilEvents.filter((e) => e.flagged).length}
          </Text>
        </View>
      )}

      {/* Platform note */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name={Platform.OS === 'windows' ? 'microsoft-windows' : 'android'} size={20} color="#8b949e" />
          <Text style={styles.cardSub}> {Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function _Badge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeCount, { color }]}>{count}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 16, gap: 12 },
  title:   { fontSize: 22, fontWeight: '700', color: '#e6edf3', marginBottom: 8 },
  card:    { backgroundColor: '#161b22', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#30363d' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#e6edf3' },
  cardSub:   { fontSize: 13, color: '#8b949e', marginTop: 4 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  badge:   { flex: 1, alignItems: 'center', borderRadius: 8, borderWidth: 1, padding: 8 },
  badgeCount: { fontSize: 24, fontWeight: '700' },
  badgeLabel: { fontSize: 11, color: '#8b949e', marginTop: 2 },
});
