/**
 * RIL event list + detail modal for FieldGuard dashboard.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Clipboard,
  Platform,
} from 'react-native';
import type { RILEvent, RILEventType } from '../../types';
import { THEME } from '../theme';
import Icon from './Icon';

const TYPE_LABEL: Record<RILEventType, string> = {
  sms_deliver:       'SMS deliver',
  sms_submit:        'SMS submit',
  sms_status_report: 'SMS status report',
  sms_command:       'SMS command',
  cell_broadcast:    'Cell broadcast',
  ril_unsol:         'RIL unsolicited',
  type0_silent:      'Type-0 / silent',
  wap_push:          'WAP push',
  ota_sms_pp:        'OTA SMS-PP',
};

type ScaleFn = (n: number) => number;
type FontSizeFn = (n: number) => number;

export function RILMonitorEventsSection({
  rilEvents,
  scale,
  fontSize,
  onClear,
}: {
  rilEvents: RILEvent[];
  scale: ScaleFn;
  fontSize: FontSizeFn;
  onClear: () => void;
}) {
  const [selected, setSelected] = useState<RILEvent | null>(null);

  const preview = rilEvents.slice(0, 40);

  return (
    <View style={{ marginTop: scale(10) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(6) }}>
        <Text style={{ color: THEME.textMuted, fontSize: fontSize(12), fontWeight: '600' }}>
          Recent events (tap for detail)
        </Text>
        {rilEvents.length > 0 && (
          <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: THEME.primary, fontSize: fontSize(12) }}>Clear log</Text>
          </TouchableOpacity>
        )}
      </View>

      {preview.length === 0 ? (
        <Text style={{ color: THEME.textLight, fontSize: fontSize(12), fontStyle: 'italic' }}>
          No RIL events captured yet. Incoming SMS activity will appear here.
        </Text>
      ) : (
        preview.map((e) => (
          <RILEventRow key={e.id} event={e} scale={scale} fontSize={fontSize} onPress={() => setSelected(e)} />
        ))
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected && (
              <RILEventDetailModal
                event={selected}
                scale={scale}
                fontSize={fontSize}
                onClose={() => setSelected(null)}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function RILEventRow({
  event,
  scale,
  fontSize,
  onPress,
}: {
  event: RILEvent;
  scale: ScaleFn;
  fontSize: FontSizeFn;
  onPress: () => void;
}) {
  const ts = new Date(event.ts).toLocaleTimeString();
  const label = TYPE_LABEL[event.type] ?? event.type;
  const cleanHex = event.rawHex.replace(/\s/g, '');
  const hexPreview = cleanHex.slice(0, 24) + (cleanHex.length > 24 ? '…' : '');

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          paddingVertical: scale(8),
          paddingHorizontal: scale(10),
          marginBottom: scale(6),
          borderLeftColor: event.flagged ? THEME.danger : THEME.primary,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`RIL event ${label}, ${event.flagged ? 'flagged' : 'clean'}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
        <Text style={{ fontSize: fontSize(10), color: THEME.textLight }}>{ts}</Text>
        {event.flagged && (
          <View style={styles.flagDot}>
            <Text style={styles.flagDotTxt}>!</Text>
          </View>
        )}
        <Text style={{ fontSize: fontSize(12), fontWeight: '600', color: THEME.text, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: fontSize(10), color: THEME.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 }} numberOfLines={1}>
        {hexPreview}
      </Text>
      {event.flagReason ? (
        <Text style={{ fontSize: fontSize(10), color: THEME.danger, marginTop: 2 }} numberOfLines={1}>
          {event.flagReason}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function RILEventDetailModal({
  event,
  scale,
  fontSize,
  onClose,
}: {
  event: RILEvent;
  scale: ScaleFn;
  fontSize: FontSizeFn;
  onClose: () => void;
}) {
  const label = TYPE_LABEL[event.type] ?? event.type;
  const ts = new Date(event.ts).toLocaleString();

  const copyHex = () => {
    Clipboard.setString(event.rawHex.replace(/\s/g, ''));
  };

  const spacedHex = formatHexLines(event.rawHex.replace(/\s/g, ''), 32);
  const d = event.decoded;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={[styles.detailHeader, { padding: scale(14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize(16), fontWeight: '700', color: THEME.text }}>{label}</Text>
          <Text style={{ fontSize: fontSize(11), color: THEME.textLight, marginTop: 4 }}>{ts}</Text>
        </View>
        <TouchableOpacity onPress={copyHex} style={{ padding: scale(6) }} accessibilityLabel="Copy hex">
          <Icon name="clipboard-outline" size={scale(18)} color={THEME.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ padding: scale(6) }} accessibilityLabel="Close">
          <Icon name="close" size={scale(22)} color={THEME.textMuted} />
        </TouchableOpacity>
      </View>

      {event.flagged && (
        <View style={[styles.flagBanner, { marginHorizontal: scale(14), marginBottom: scale(8) }]}>
          <Text style={{ fontSize: fontSize(12), fontWeight: '700', color: THEME.danger }}>Flagged</Text>
          {event.flagReason ? (
            <Text style={{ fontSize: fontSize(12), color: THEME.textSecondary, marginTop: 4 }}>{event.flagReason}</Text>
          ) : null}
        </View>
      )}

      <ScrollView
        style={{ flex: 1, paddingHorizontal: scale(14) }}
        contentContainerStyle={{ paddingBottom: scale(24) }}
        scrollEnabled
        nestedScrollEnabled={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <Text style={styles.sectionLabel}>Raw PDU (hex)</Text>
        <ScrollView
          horizontal
          scrollEnabled
          nestedScrollEnabled={Platform.OS === 'android'}
          style={{ marginBottom: scale(12) }}
        >
          <Text
            selectable
            style={{
              fontSize: fontSize(11),
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              color: THEME.textSecondary,
              backgroundColor: THEME.surfaceHover,
              padding: scale(10),
              borderRadius: scale(6),
              borderWidth: 1,
              borderColor: THEME.border,
            }}
          >
            {spacedHex}
          </Text>
        </ScrollView>

        {d && (
          <>
            <Text style={styles.sectionLabel}>Decoded</Text>
            {d.smsc != null && d.smsc !== '' && <DetailRow k="SMSC" v={d.smsc} fontSize={fontSize} />}
            {d.sender != null && d.sender !== '' && <DetailRow k="Sender" v={d.sender} fontSize={fontSize} />}
            {d.tpMti != null && (
              <DetailRow k="TP-MTI" v={String(['DELIVER', 'SUBMIT', 'STATUS-REPORT'][d.tpMti] ?? d.tpMti)} fontSize={fontSize} />
            )}
            {d.pid != null && <DetailRow k="PID" v={`0x${d.pid.toString(16).padStart(2, '0')}`} fontSize={fontSize} />}
            {d.dcs != null && <DetailRow k="DCS" v={`0x${d.dcs.toString(16).padStart(2, '0')} (${d.dcsEncoding ?? ''})`} fontSize={fontSize} />}
            {d.text != null && d.text !== '' && (
              <DetailRow k="Text" v={d.text.length > 400 ? d.text.slice(0, 400) + '…' : d.text} fontSize={fontSize} />
            )}
            {d.timestamp != null && d.timestamp !== '' && <DetailRow k="SCTS" v={d.timestamp} fontSize={fontSize} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ k, v, fontSize }: { k: string; v: string; fontSize: FontSizeFn }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: fontSize(10), color: THEME.textLight, textTransform: 'uppercase' }}>{k}</Text>
      <Text style={{ fontSize: fontSize(12), color: THEME.text, marginTop: 2 }}>{v}</Text>
    </View>
  );
}

function formatHexLines(hex: string, perLine: number): string {
  const upper = hex.toUpperCase();
  const lines: string[] = [];
  for (let i = 0; i < upper.length; i += perLine) {
    const chunk = upper.slice(i, i + perLine);
    const pairs = chunk.match(/.{1,2}/g)?.join(' ') ?? chunk;
    lines.push(pairs);
  }
  return lines.join('\n');
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: THEME.surfaceHover,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    borderLeftWidth: 3,
  },
  flagDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagDotTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    maxHeight: '88%',
    minHeight: 200,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  flagBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  sectionLabel: {
    fontSize: 10,
    color: THEME.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
});
