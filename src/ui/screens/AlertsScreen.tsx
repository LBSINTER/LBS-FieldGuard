/**
 * LBS FieldGuard — Alerts Screen
 * Light theme matching lbs-int.com.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Pressable, Share, Clipboard,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { Alert, Severity } from '../../types';
import Icon from '../components/Icon';
import { PID_NOTES, DCS_NOTES, UDH_IEI_NOTES, CATEGORY_DETAIL } from '../../ss7/AlertAnnotations';
import { THEME } from '../theme';

const SEV_COLOR: Record<Severity, string> = {
  info:     THEME.textLight,
  low:      THEME.successDark,
  medium:   THEME.warningDark,
  high:     '#ea580c',
  critical: THEME.danger,
};
const SEV_BG: Record<Severity, string> = {
  info:     '#f1f5f9',
  low:      '#f0fdf4',
  medium:   '#fffbeb',
  high:     '#fff7ed',
  critical: '#fef2f2',
};

type Tab = 'explain' | 'hex' | 'fields';

export default function AlertsScreen() {
  const { alerts, clearAlerts } = useAppStore();
  const [selected, setSelected]     = useState<Alert | null>(null);
  const [activeTab, setActiveTab]   = useState<Tab>('explain');
  const [filterSev, setFilterSev]   = useState<Severity | 'all'>('all');

  const filtered = filterSev === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filterSev);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Alerts</Text>
        <TouchableOpacity onPress={clearAlerts} style={s.clearBtn}>
          <Text style={s.clearTxt}>Clear all</Text>
        </TouchableOpacity>
      </View>

      {/* Severity filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chipContent}>
        {(['all','critical','high','medium','low','info'] as const).map(s2 => (
          <TouchableOpacity
            key={s2}
            style={[s.chip, filterSev===s2 && { backgroundColor: s2==='all' ? '#e2e8f0' : SEV_BG[s2 as Severity] }]}
            onPress={() => setFilterSev(s2)}
          >
            <Text style={[s.chipTxt, s2 !== 'all' && { color: SEV_COLOR[s2 as Severity] }]}>
              {s2.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Icon name="shield-check" size={48} color="#16a34a" />
          <Text style={s.emptyTxt}>{alerts.length === 0 ? 'No alerts \u2014 device appears clean' : 'No alerts match current filter'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => a.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <AlertRow alert={item} onPress={() => { setSelected(item); setActiveTab('explain'); }} />
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selected && (
              <AlertDetailModal
                alert={selected}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onClose={() => setSelected(null)}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AlertRow({ alert, onPress }: { alert: Alert; onPress: () => void }) {
  const color = SEV_COLOR[alert.severity];
  const ts    = new Date(alert.ts).toLocaleTimeString();
  return (
    <TouchableOpacity style={[s.row, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <View style={s.rowTop}>
        <Text style={[s.sevLabel, { color }]}>{alert.severity.toUpperCase()}</Text>
        <Text style={s.ts}>{ts}</Text>
        {alert.sigId && <Text style={s.sigPill}>{alert.sigId}</Text>}
      </View>
      <Text style={s.rowTitle}>{alert.title}</Text>
      <Text style={s.rowDetail} numberOfLines={2}>{alert.detail}</Text>
      <Text style={s.tapHint}>Tap to inspect</Text>
    </TouchableOpacity>
  );
}

function AlertDetailModal({
  alert, activeTab, setActiveTab, onClose
}: {
  alert: Alert;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const color = SEV_COLOR[alert.severity];
  const ts    = new Date(alert.ts).toLocaleString();

  const handleShare = () => {
    const text = 'FieldGuard Alert\n' + alert.severity.toUpperCase() + ' \u2014 ' + alert.title + '\n' + alert.detail + '\n' + ts;
    Share.share({ message: text });
  };
  const handleCopyHex = () => {
    if (alert.raw) Clipboard.setString(alert.raw);
  };

  return (
    <View style={s.modalInner}>
      {/* Modal header */}
      <View style={s.modalHeader}>
        <View style={[s.sevBadge, { backgroundColor: SEV_BG[alert.severity], borderColor: color }]}>
          <Text style={[s.sevBadgeTxt, { color }]}>{alert.severity.toUpperCase()}</Text>
        </View>
        <Text style={s.modalTitle} numberOfLines={2}>{alert.title}</Text>
        <View style={s.modalActions}>
          <TouchableOpacity onPress={handleShare} style={s.iconBtn}>
            <Icon name="share-variant" size={18} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Icon name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={s.modalTs}>{ts} · {alert.category}</Text>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['explain','hex','fields'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, activeTab===t && s.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[s.tabTxt, activeTab===t && s.tabTxtActive]}>
              {t === 'explain' ? 'Explanation' : t === 'hex' ? 'Hex Dump' : 'PDU Fields'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 20 }}>
        {activeTab === 'explain' && <ExplainTab alert={alert} />}
        {activeTab === 'hex'     && <HexTab     alert={alert} onCopy={handleCopyHex} />}
        {activeTab === 'fields'  && <FieldsTab  alert={alert} />}
      </ScrollView>
    </View>
  );
}

function ExplainTab({ alert }: { alert: Alert }) {
  const catDetail = CATEGORY_DETAIL[alert.category] ?? null;
  return (
    <View>
      <Text style={s.sectionLabel}>What was detected</Text>
      <Text style={s.detailText}>{alert.detail}</Text>

      {catDetail && (
        <>
          <Text style={s.sectionLabel}>Technical context</Text>
          <Text style={s.detailText}>{catDetail.explanation}</Text>
        </>
      )}

      {alert.explanation && (
        <>
          <Text style={s.sectionLabel}>Detection method</Text>
          <Text style={s.detailText}>{alert.explanation}</Text>
        </>
      )}

      {alert.sigId && (
        <View style={s.sigBox}>
          <Text style={s.sectionLabel}>Matched signature</Text>
          <Text style={s.monoText}>{alert.sigId}</Text>
          {alert.sigOffset != null && (
            <Text style={s.monoText}>
              Offset: 0x{alert.sigOffset.toString(16).padStart(4,'0')} (byte {alert.sigOffset})
              {alert.sigLen != null ? (' · ' + alert.sigLen + ' byte' + (alert.sigLen===1?'':'s')) : ''}
            </Text>
          )}
        </View>
      )}

      {catDetail?.references && catDetail.references.length > 0 && (
        <>
          <Text style={s.sectionLabel}>References</Text>
          {catDetail.references.map((r,i) => (
            <Text key={i} style={s.refText}>{'• ' + r}</Text>
          ))}
        </>
      )}
    </View>
  );
}

function HexTab({ alert, onCopy }: { alert: Alert; onCopy: () => void }) {
  if (!alert.raw) {
    return <Text style={s.noDataText}>No raw PDU bytes associated with this alert.</Text>;
  }

  const bytes  = alert.raw.replace(/\s/g,'').toUpperCase().match(/.{1,2}/g) ?? [];
  const hlFrom = alert.sigOffset ?? -1;
  const hlTo   = (alert.sigOffset != null && alert.sigLen != null)
    ? alert.sigOffset + alert.sigLen - 1
    : -1;

  const rows: JSX.Element[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk  = bytes.slice(i, i+16);
    const offset = i.toString(16).padStart(4,'0').toUpperCase();
    const hexCells = chunk.map((b, j) => {
      const abs = i+j;
      const hl  = hlFrom >= 0 && abs >= hlFrom && (hlTo < 0 || abs <= hlTo);
      return (
        <Text key={j} style={[s.hexByte, hl && s.hexByteHL]}>{b}</Text>
      );
    });
    const ascii = chunk.map(b => {
      const cc = parseInt(b,16);
      return (cc >= 0x20 && cc < 0x7f) ? String.fromCharCode(cc) : '.';
    }).join('');
    rows.push(
      <View key={i} style={s.hexRow}>
        <Text style={s.hexOffset}>{offset}</Text>
        <View style={s.hexBytesWrap}>{hexCells}</View>
        <Text style={s.hexAscii}>{ascii}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={s.hexHeader}>
        <Text style={s.sectionLabel}>Hex dump ({bytes.length} bytes)</Text>
        <TouchableOpacity onPress={onCopy}>
          <Text style={s.copyBtn}>Copy hex</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal>
        <View style={s.hexDump}>{rows}</View>
      </ScrollView>
      {hlFrom >= 0 && (
        <Text style={s.hlNote}>
          Bytes {hlFrom}\u2013{hlTo < 0 ? hlFrom : hlTo} matched signature
        </Text>
      )}
    </View>
  );
}

function FieldsTab({ alert }: { alert: Alert }) {
  const f = alert.pduFields;
  if (!f) return <Text style={s.noDataText}>No PDU field decode available for this alert.</Text>;

  const rows: { name: string; val: string; note: string }[] = [];
  const add = (name: string, val: string | number | boolean, note = '') =>
    rows.push({ name, val: String(val), note });

  if (f.smsc)      add('SMSC',     f.smsc,    'Service Centre address (BCD)');
  if (f.tpMti != null) add('TP-MTI', '0x' + (f.tpMti?.toString(16)) + ' (' + (['DELIVER','SUBMIT','STATUS-REPORT'][f.tpMti!] ?? '?') + ')', 'Message Type Indicator (bits 0-1 of first octet)');
  if (f.sender)    add('OA',       f.sender,  f.senderType===145 ? 'International (+)' : f.senderType===161 ? 'National' : 'Unknown format');
  if (f.pid != null) add('PID', '0x' + (f.pid?.toString(16).padStart(2,'0')), PID_NOTES[f.pid!] ?? '');
  if (f.dcs != null) add('DCS', '0x' + (f.dcs?.toString(16).padStart(2,'0')), DCS_NOTES[f.dcs! & 0x0f] ?? ('Encoding: ' + f.dcsEncoding + '; Class: ' + f.dcsClass));
  if (f.timestamp) add('SCTS',     f.timestamp, 'Service Centre Timestamp (local time)');
  if (f.udLen != null) add('UD-Length', f.udLen!, 'User Data length (septets for GSM-7, bytes for 8-bit/UCS-2)');
  if (f.tpUdhi)    add('TP-UDHI',  'present', 'User Data Header Indicator \u2014 UDH is present');
  if (f.udh?.length) {
    f.udh!.forEach((h, i) =>
      add('UDH[' + i + '] IEI=0x' + h.iei.toString(16), h.data, h.desc ?? UDH_IEI_NOTES[h.iei] ?? '')
    );
  }
  if (f.text)      add('Text',     f.text,    f.dcsEncoding + ' encoded');
  if (f.binaryPayload) add('Binary UD', f.binaryPayload.slice(0,40)+'\u2026', 'Truncated');

  return (
    <View>
      <Text style={s.sectionLabel}>Decoded PDU fields</Text>
      {rows.map((r,i) => (
        <View key={i} style={s.fieldRow}>
          <Text style={s.fieldName}>{r.name}</Text>
          <Text style={s.fieldVal}>{r.val}</Text>
          {r.note ? <Text style={s.fieldNote}>{r.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex:1, backgroundColor:THEME.surface },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingBottom:8 },
  title:         { fontSize:20, fontWeight:'700', color:THEME.text },
  clearBtn:      { padding:8 },
  clearTxt:      { color:THEME.primary, fontSize:13 },
  chipRow:       { maxHeight:42, borderBottomWidth:1, borderBottomColor:THEME.border },
  chipContent:   { paddingHorizontal:12, alignItems:'center', gap:6 },
  chip:          { paddingHorizontal:12, paddingVertical:5, borderRadius:14, backgroundColor:THEME.bg, borderWidth:1, borderColor:THEME.border },
  chipTxt:       { fontSize:11, fontWeight:'600', color:THEME.textMuted },
  empty:         { flex:1, alignItems:'center', justifyContent:'center', gap:12, padding:40 },
  emptyTxt:      { color:THEME.successDark, fontSize:15, textAlign:'center' },
  list:          { padding:12, gap:8 },
  row:           { backgroundColor:THEME.bg, borderRadius:8, padding:12, borderWidth:1, borderColor:THEME.border, borderLeftWidth:3 },
  rowTop:        { flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  sevLabel:      { fontSize:11, fontWeight:'700' },
  ts:            { fontSize:10, color:THEME.textLight, flex:1 },
  sigPill:       { fontSize:9, color:'#7c3aed', backgroundColor:'#f5f3ff', paddingHorizontal:6, paddingVertical:2, borderRadius:8 },
  rowTitle:      { fontSize:13, fontWeight:'600', color:THEME.text, marginBottom:3 },
  rowDetail:     { fontSize:12, color:THEME.textMuted, lineHeight:17 },
  tapHint:       { fontSize:10, color:THEME.borderDark, marginTop:4 },
  // Modal
  modalOverlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  modalCard:     { backgroundColor:THEME.bg, borderTopLeftRadius:16, borderTopRightRadius:16, borderWidth:1, borderColor:THEME.border, maxHeight:'90%' },
  modalInner:    { flex:1 },
  modalHeader:   { flexDirection:'row', alignItems:'center', padding:16, gap:10, borderBottomWidth:1, borderBottomColor:THEME.border },
  sevBadge:      { paddingHorizontal:8, paddingVertical:3, borderRadius:8, borderWidth:1 },
  sevBadgeTxt:   { fontSize:10, fontWeight:'700' },
  modalTitle:    { flex:1, fontSize:14, fontWeight:'700', color:THEME.text },
  modalActions:  { flexDirection:'row', gap:4 },
  iconBtn:       { padding:6 },
  modalTs:       { fontSize:11, color:THEME.textLight, paddingHorizontal:16, paddingBottom:8 },
  tabs:          { flexDirection:'row', borderBottomWidth:1, borderBottomColor:THEME.border },
  tab:           { flex:1, paddingVertical:10, alignItems:'center', borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive:     { borderBottomColor:THEME.primary },
  tabTxt:        { fontSize:12, color:THEME.textMuted },
  tabTxtActive:  { color:THEME.primary, fontWeight:'600' },
  modalBody:     { flex:1, padding:14 },
  sectionLabel:  { fontSize:10, color:THEME.textLight, textTransform:'uppercase', letterSpacing:1, marginTop:14, marginBottom:6, borderBottomWidth:1, borderBottomColor:THEME.border, paddingBottom:3 },
  detailText:    { fontSize:13, color:THEME.textSecondary, lineHeight:20 },
  sigBox:        { backgroundColor:'#f5f3ff', borderRadius:6, padding:10, marginTop:4, borderWidth:1, borderColor:'#ddd6fe' },
  monoText:      { fontSize:11, color:'#7c3aed', fontFamily:'monospace' },
  refText:       { fontSize:11, color:THEME.primary, lineHeight:22 },
  noDataText:    { color:THEME.textLight, fontSize:13, textAlign:'center', marginTop:30 },
  // Hex dump
  hexHeader:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4 },
  copyBtn:       { fontSize:11, color:THEME.primary },
  hexDump:       { backgroundColor:THEME.surfaceHover, borderRadius:6, padding:10, borderWidth:1, borderColor:THEME.border, marginTop:4 },
  hexRow:        { flexDirection:'row', marginBottom:2, alignItems:'center', gap:8 },
  hexOffset:     { fontSize:11, color:THEME.textLight, fontFamily:'monospace', minWidth:36 },
  hexBytesWrap:  { flexDirection:'row', flexWrap:'nowrap', gap:3 },
  hexByte:       { fontSize:11, color:THEME.textSecondary, fontFamily:'monospace' },
  hexByteHL:     { color:'#b45309', backgroundColor:'#fef3c7', borderRadius:2, fontWeight:'700' },
  hexAscii:      { fontSize:11, color:THEME.textLight, fontFamily:'monospace', borderLeftWidth:1, borderLeftColor:THEME.border, paddingLeft:8 },
  hlNote:        { fontSize:10, color:THEME.warningDark, marginTop:6 },
  // Fields
  fieldRow:      { paddingVertical:7, borderBottomWidth:1, borderBottomColor:THEME.surfaceHover },
  fieldName:     { fontSize:11, color:THEME.primary, fontFamily:'monospace', marginBottom:1 },
  fieldVal:      { fontSize:12, color:THEME.text, fontFamily:'monospace' },
  fieldNote:     { fontSize:10, color:THEME.textMuted, marginTop:1 },
});
