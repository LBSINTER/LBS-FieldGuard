import { useScreenSize } from '../hooks/useScreenSize';
/**
 * LBS FieldGuard — Alerts Screen
 *
 * Live scrollable feed of all flagged events sorted newest-first.
 * Tapping an alert expands the raw PDU hex view.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { Alert, Severity } from '../../types';
import Icon from '../components/Icon';
import { bytesToHex, hexToBytes } from '../../android/PDUCodec';
import { classifyPayload } from '../../ss7/PayloadCatalogue';

const SEV_COLOR: Record<Severity, string> = {
  info:     '#8b949e',
  low:      '#3fb950',
  medium:   '#d29922',
  high:     '#f0883e',
  critical: '#f85149',
};

export default function AlertsScreen() {
  const { alerts, clearAlerts } = useAppStore();
  const { scale, fontSize, maxContentWidth } = useScreenSize();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <TouchableOpacity onPress={clearAlerts} style={styles.clearBtn}>
          <Text style={styles.clearTxt}>Clear all</Text>
        </TouchableOpacity>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="shield-check" size={48} color="#3fb950" />
          <Text style={styles.emptyTxt}>No alerts</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <AlertRow
              alert={item}
              expanded={expanded === item.id}
              onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function AlertRow({
  alert,
  expanded,
  onPress,
}: {
  alert: Alert;
  expanded: boolean;
  onPress: () => void;
}) {
  const ts = new Date(alert.ts).toLocaleTimeString();
  const color = SEV_COLOR[alert.severity];

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.rowTop}>
        <Text style={[styles.sevLabel, { color }]}>{alert.severity.toUpperCase()}</Text>
        <Text style={styles.ts}>{ts}</Text>
      </View>
      <Text style={styles.rowTitle}>{alert.title}</Text>
      <Text style={styles.rowDetail}>{alert.detail}</Text>

      {expanded && (
        <View style={styles.expanded}>
          {alert.raw ? (
            <>
              <Text style={styles.hexLabel}>Raw PDU hex:</Text>
              <ScrollView horizontal>
                <Text style={styles.hex}>{formatHex(alert.raw)}</Text>
              </ScrollView>
            </>
          ) : null}
          <Text style={[styles.hexLabel, { marginTop: 8 }]}>Category: {alert.category}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatHex(hex: string): string {
  const clean = hex.replace(/\s/g, '').toUpperCase();
  return clean.match(/.{1,2}/g)?.join(' ') ?? clean;
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#0d1117' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title:      { fontSize: 20, fontWeight: '700', color: '#e6edf3' },
  clearBtn:   { padding: 8 },
  clearTxt:   { color: '#58a6ff', fontSize: 13 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt:   { color: '#3fb950', fontSize: 16 },
  list:       { padding: 12, gap: 8 },
  row:        { backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderLeftWidth: 3 },
  rowTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sevLabel:   { fontSize: 11, fontWeight: '700' },
  ts:         { fontSize: 11, color: '#8b949e' },
  rowTitle:   { fontSize: 14, fontWeight: '600', color: '#e6edf3' },
  rowDetail:  { fontSize: 12, color: '#8b949e', marginTop: 2 },
  expanded:   { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#30363d' },
  hexLabel:   { fontSize: 11, color: '#8b949e', marginBottom: 4 },
  hex:        { fontFamily: 'monospace', fontSize: 11, color: '#79c0ff' },
});
