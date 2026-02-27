/**
 * LBS FieldGuard — Dashboard Screen
 *
 * Fully responsive: phone / tablet / desktop (Windows) layouts.
 * Uses useScreenSize hook to scale fonts, padding, and columns.
 * Light theme matching lbs-int.com.
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
import { THEME } from '../theme';

const STATUS_COLOR: Record<string, string> = {
  connected:    THEME.successDark,
  connecting:   THEME.warningDark,
  disconnected: THEME.textLight,
  error:        THEME.danger,
};

type ScaleFn = (n: number) => number;

export default function DashboardScreen() {
  const {
    probeStatus, probeLatencyMs, signaturesLoaded, alerts, rilEvents,
    monitoringMode, monitoringDetail,
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
      <Text style={{ fontSize: fontSize(22), fontWeight: '700', color: THEME.text, marginBottom: scale(4) }}>
        LBS FieldGuard
      </Text>

      {cardRow && (
        <View style={{ flexDirection: 'row', gap: scale(10) }}>
          <StatCard label="Critical" value={critical}         color={THEME.danger} scale={scale} fontSize={fontSize} />
          <StatCard label="High"     value={high}             color="#ea580c" scale={scale} fontSize={fontSize} />
          <StatCard label="Medium"   value={medium}           color={THEME.warningDark} scale={scale} fontSize={fontSize} />
          <StatCard label="Patterns" value={signaturesLoaded} color={THEME.primary} scale={scale} fontSize={fontSize} />
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
          <Text style={{ color: THEME.textMuted, fontSize: fontSize(13), marginTop: 4 }}>Latency: {probeLatencyMs} ms</Text>
        )}
        <Text style={{ color: THEME.textMuted, fontSize: fontSize(13), marginTop: 2 }}>Station: 140.82.39.182:5556</Text>
      </View>

      <View style={[styles.card, { padding: scale(16), borderColor: THEME.primary }]}>
        <View style={styles.row}>
          <Icon name="shield-check-outline" size={scale(20)} color={THEME.primary} />
          <Text style={{ color: THEME.text, fontWeight: '600', fontSize: fontSize(16), marginLeft: 6 }}>
            Detection Capability
          </Text>
        </View>
        <Text style={{ color: THEME.primary, fontSize: fontSize(13), marginTop: 6, fontWeight: '700' }}>{monitoringMode}</Text>
        <Text style={{ color: THEME.textMuted, fontSize: fontSize(12), marginTop: 3 }}>{monitoringDetail}</Text>
      </View>

      {!cardRow && (
        <View style={[styles.card, { padding: scale(16) }]}>
          <View style={styles.row}>
            <Icon name="database-check" size={scale(20)} color={THEME.primary} />
            <Text style={{ fontWeight: '600', color: THEME.text, fontSize: fontSize(16), marginLeft: 6 }}>Signature DB</Text>
          </View>
          <Text style={{ color: THEME.textMuted, fontSize: fontSize(13), marginTop: 4 }}>{signaturesLoaded} patterns loaded</Text>
        </View>
      )}

      {!cardRow && (
        <View style={[styles.card, { padding: scale(16) }]}>
          <Text style={{ fontWeight: '600', color: THEME.text, fontSize: fontSize(16), marginBottom: scale(8) }}>Threat Summary</Text>
          <View style={[styles.row, { gap: scale(8) }]}>
            <_Badge label="Critical" count={critical} color={THEME.danger} scale={scale} fontSize={fontSize} />
            <_Badge label="High"     count={high}     color="#ea580c" scale={scale} fontSize={fontSize} />
            <_Badge label="Medium"   count={medium}   color={THEME.warningDark} scale={scale} fontSize={fontSize} />
          </View>
        </View>
      )}

      {Platform.OS === 'android' && (
        <View style={[styles.card, { padding: scale(16) }]}>
          <View style={styles.row}>
            <Icon name="sim" size={scale(20)} color={THEME.primary} />
            <Text style={{ fontWeight: '600', color: THEME.text, fontSize: fontSize(16), marginLeft: 6 }}>RIL Monitor</Text>
          </View>
          <Text style={{ color: THEME.textMuted, fontSize: fontSize(13), marginTop: 4 }}>{rilEvents.length} RIL events captured</Text>
          <Text style={{ color: THEME.textMuted, fontSize: fontSize(13), marginTop: 2 }}>
            Flagged: {rilEvents.filter((e) => e.flagged).length}
          </Text>
        </View>
      )}

      <View style={[styles.card, { padding: scale(14) }]}>
        <View style={styles.row}>
          <Icon name={Platform.OS === 'windows' ? 'microsoft-windows' : 'android'} size={scale(18)} color={THEME.textMuted} />
          <Text style={{ color: THEME.textMuted, fontSize: fontSize(13), marginLeft: 6 }}>
            {Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function _Badge({ label, count, color, scale, fontSize }: { label: string; count: number; color: string; scale: ScaleFn; fontSize: ScaleFn }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', borderRadius: scale(8), borderWidth: 1, borderColor: color, padding: scale(8), backgroundColor: THEME.bg }}>
      <Text style={{ fontSize: fontSize(24), fontWeight: '700', color }}>{count}</Text>
      <Text style={{ fontSize: fontSize(11), color: THEME.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, color, scale, fontSize }: { label: string; value: number; color: string; scale: ScaleFn; fontSize: ScaleFn }) {
  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg, borderRadius: scale(10), borderWidth: 1, borderColor: color, padding: scale(14), alignItems: 'center' }}>
      <Text style={{ fontSize: fontSize(28), fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: fontSize(11), color: THEME.textMuted, marginTop: 2, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.surface },
  card: { backgroundColor: THEME.bg, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  row:  { flexDirection: 'row', alignItems: 'center' },
});
