/**
 * LBS FieldGuard — Dashboard Screen
 *
 * Fully responsive: phone / tablet / desktop (Windows) layouts.
 * Uses useScreenSize hook to scale fonts, padding, and columns.
 */

import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { useScreenSize } from '../hooks/useScreenSize';
import Icon from '../components/Icon';

const STATUS_COLOR: Record<string, string> = {
  connected:    '#3fb950',
  connecting:   '#f0883e',
  disconnected: '#8b949e',
  error:        '#f85149',
};

type ScaleFn = (n: number) => number;

export default function DashboardScreen() {
  const {
    probeStatus, probeLatencyMs, signaturesLoaded, alerts, rilEvents,
  } = useAppStore();

  const { scale, fontSize, isTablet, isDesktop, maxContentWidth } = useScreenSize();
  const cardRow = isTablet || isDesktop;
  const statusColor = STATUS_COLOR[probeStatus] ?? STATUS_COLOR.disconnected;

  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const high     = alerts.filter((a) => a.severity === 'high').length;
  const medium   = alerts.filter((a) => a.severity === 'medium').length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        { padding: scale(16), gap: scale(12), paddingBottom: scale(32) },
        maxContentWidth ? { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth } : undefined,
      ]}
    >
      <Text style={{ fontSize: fontSize(22), fontWeight: '700', color: '#e6edf3', marginBottom: scale(4) }}>
        LBS FieldGuard
      </Text>

      {cardRow && (
        <View style={{ flexDirection: 'row', gap: scale(10) }}>
          <StatCard label="Critical" value={critical}         color="#f85149" scale={scale} fontSize={fontSize} />
          <StatCard label="High"     value={high}             color="#f0883e" scale={scale} fontSize={fontSize} />
          <StatCard label="Medium"   value={medium}           color="#d29922" scale={scale} fontSize={fontSize} />
          <StatCard label="Patterns" value={signaturesLoaded} color="#58a6ff" scale={scale} fontSize={fontSize} />
        </View>
      )}

      <View style={[styles.card, { borderColor: statusColor, padding: scale(16) }]}>
        <View style={styles.row}>
          <Icon name="antenna" size={scale(20)} color={statusColor} />
          <Text style={{ color: statusColor, fontWeight: '600', fontSize: fontSize(16), marginLeft: 6 }}>
            Station Probe — {probeStatus.toUpperCase()}
          </Text>
        </View>
        {probeLatencyMs >= 0 && (
          <Text style={{ color: '#8b949e', fontSize: fontSize(13), marginTop: 4 }}>Latency: {probeLatencyMs} ms</Text>
        )}
        <Text style={{ color: '#8b949e', fontSize: fontSize(13), marginTop: 2 }}>Station: 140.82.39.182:5556</Text>
      </View>

      {!cardRow && (
        <View style={[styles.card, { padding: scale(16) }]}>
          <View style={styles.row}>
            <Icon name="database-check" size={scale(20)} color="#58a6ff" />
            <Text style={{ fontWeight: '600', color: '#e6edf3', fontSize: fontSize(16), marginLeft: 6 }}>Signature DB</Text>
          </View>
          <Text style={{ color: '#8b949e', fontSize: fontSize(13), marginTop: 4 }}>{signaturesLoaded} patterns loaded</Text>
        </View>
      )}

      {!cardRow && (
        <View style={[styles.card, { padding: scale(16) }]}>
          <Text style={{ fontWeight: '600', color: '#e6edf3', fontSize: fontSize(16), marginBottom: scale(8) }}>Threat Summary</Text>
          <View style={[styles.row, { gap: scale(8) }]}>
            <_Badge label="Critical" count={critical} color="#f85149" scale={scale} fontSize={fontSize} />
            <_Badge label="High"     count={high}     color="#f0883e" scale={scale} fontSize={fontSize} />
            <_Badge label="Medium"   count={medium}   color="#d29922" scale={scale} fontSize={fontSize} />
          </View>
        </View>
      )}

      {Platform.OS === 'android' && (
        <View style={[styles.card, { padding: scale(16) }]}>
          <View style={styles.row}>
            <Icon name="sim" size={scale(20)} color="#58a6ff" />
            <Text style={{ fontWeight: '600', color: '#e6edf3', fontSize: fontSize(16), marginLeft: 6 }}>RIL Monitor</Text>
          </View>
          <Text style={{ color: '#8b949e', fontSize: fontSize(13), marginTop: 4 }}>{rilEvents.length} RIL events captured</Text>
          <Text style={{ color: '#8b949e', fontSize: fontSize(13), marginTop: 2 }}>
            Flagged: {rilEvents.filter((e) => e.flagged).length}
          </Text>
        </View>
      )}

      <View style={[styles.card, { padding: scale(14) }]}>
        <View style={styles.row}>
          <Icon name={Platform.OS === 'windows' ? 'microsoft-windows' : 'android'} size={scale(18)} color="#8b949e" />
          <Text style={{ color: '#8b949e', fontSize: fontSize(13), marginLeft: 6 }}>
            {Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function _Badge({ label, count, color, scale, fontSize }: { label: string; count: number; color: string; scale: ScaleFn; fontSize: ScaleFn }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', borderRadius: scale(8), borderWidth: 1, borderColor: color, padding: scale(8) }}>
      <Text style={{ fontSize: fontSize(24), fontWeight: '700', color }}>{count}</Text>
      <Text style={{ fontSize: fontSize(11), color: '#8b949e', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, color, scale, fontSize }: { label: string; value: number; color: string; scale: ScaleFn; fontSize: ScaleFn }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#161b22', borderRadius: scale(10), borderWidth: 1, borderColor: color, padding: scale(14), alignItems: 'center' }}>
      <Text style={{ fontSize: fontSize(28), fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: fontSize(11), color: '#8b949e', marginTop: 2, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  card: { backgroundColor: '#161b22', borderRadius: 10, borderWidth: 1, borderColor: '#30363d' },
  row:  { flexDirection: 'row', alignItems: 'center' },
});
