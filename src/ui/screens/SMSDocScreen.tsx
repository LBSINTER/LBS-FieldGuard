import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../components/Icon';
import { DOCUMENTATION_ENTRIES, getGroups } from '../../ss7/DocumentationCatalogue';

const ALL_GROUPS = getGroups();

export default function SMSDocScreen() {
  const [activeGroup, setActiveGroup] = useState(ALL_GROUPS[0] ?? 'Core SMS');
  const entries = useMemo(
    () => DOCUMENTATION_ENTRIES.filter((entry) => entry.group === activeGroup),
    [activeGroup],
  );

  const detectableCount = DOCUMENTATION_ENTRIES.filter((entry) => entry.detectable).length;
  const sendableCount = DOCUMENTATION_ENTRIES.filter((entry) => entry.sendableInBuilder).length;
  const rawPduCount = DOCUMENTATION_ENTRIES.filter((entry) => entry.rawPduCapable).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Documentation</Text>
      <Text style={styles.subtitle}>
        Detectable SMS types and builder templates, including raw PDU-capable formats.
      </Text>

      <View style={styles.statsRow}>
        <StatCard icon="radar" label="Detectable" value={detectableCount} />
        <StatCard icon="file-send-outline" label="Sendable" value={sendableCount} />
        <StatCard icon="cellphone-wireless" label="Raw PDU" value={rawPduCount} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
        {ALL_GROUPS.map((group) => {
          const active = group === activeGroup;
          return (
            <TouchableOpacity
              key={group}
              style={[styles.groupChip, active && styles.groupChipActive]}
              onPress={() => setActiveGroup(group)}
            >
              <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>{group}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.listWrap}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Icon name={entry.icon} size={18} color="#1f2937" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{entry.title}</Text>
                <Text style={styles.cardSpec}>{entry.spec}</Text>
              </View>
            </View>

            <Text style={styles.cardDesc}>{entry.description}</Text>

            <View style={styles.badgesRow}>
              {entry.detectable && (
                <Badge icon="shield-check-outline" text="Detectable in app" tone="ok" />
              )}
              {entry.sendableInBuilder && (
                <Badge icon="send-outline" text="Sendable in PDU Builder" tone="info" />
              )}
              {entry.rawPduCapable && (
                <Badge icon="flash-outline" text="Raw PDU capable" tone="warn" />
              )}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>PID: {entry.pid !== undefined ? `0x${entry.pid.toString(16).toUpperCase().padStart(2, '0')}` : 'N/A'}</Text>
              <Text style={styles.metaText}>DCS: {entry.dcs !== undefined ? `0x${entry.dcs.toString(16).toUpperCase().padStart(2, '0')}` : 'N/A'}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Icon name={icon} size={18} color="#2563eb" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ icon, text, tone }: { icon: string; text: string; tone: 'ok' | 'info' | 'warn' }) {
  const badgeTone =
    tone === 'ok' ? styles.badgeOk : tone === 'warn' ? styles.badgeWarn : styles.badgeInfo;

  return (
    <View style={[styles.badge, badgeTone]}>
      <Icon name={icon} size={14} color="#111827" />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#475569' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 11, color: '#64748b' },
  groupScroll: { marginTop: 14, maxHeight: 36 },
  groupChip: {
    borderRadius: 16,
    borderColor: '#cbd5e1',
    borderWidth: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  groupChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  groupChipText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  groupChipTextActive: { color: '#ffffff' },
  listWrap: { marginTop: 12, gap: 10 },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSpec: { fontSize: 11, color: '#64748b', marginTop: 1 },
  cardDesc: { fontSize: 13, color: '#334155', marginTop: 8, lineHeight: 18 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  badgeInfo: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  badgeWarn: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  badgeText: { fontSize: 11, color: '#111827', fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 11, color: '#475569', fontWeight: '600' },
});
