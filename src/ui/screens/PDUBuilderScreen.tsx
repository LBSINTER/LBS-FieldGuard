import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { nanoid } from '../../utils/id';
import { decodePDU, encodePDU, hexToBytes } from '../../android/PDUCodec';
import { RawPDUSender } from '../../android/RawPDUSender';
import {
  DocumentationEntry,
  getSendableEntries,
  getSendableGroups,
} from '../../ss7/DocumentationCatalogue';
import Icon from '../components/Icon';

/* ── colour constants matching lbs-int.com ── */
const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  sub: '#334155',
  muted: '#64748b',
  accent: '#2563eb',
  accentLight: '#eff6ff',
  danger: '#dc2626',
  success: '#16a34a',
};

function toTPDU(fullPduHex: string): string {
  const clean = fullPduHex.replace(/\s/g, '');
  const smscLen = parseInt(clean.slice(0, 2), 16);
  const tpduOffset = (1 + smscLen) * 2;
  return clean.slice(tpduOffset);
}

/* ── helpers ── */
function hexPad(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0');
}

export default function PDUBuilderScreen() {
  const { addPDURecord } = useAppStore();

  /* ── build section data from catalogue ── */
  const { sections, flatSendable } = useMemo(() => {
    const entries = getSendableEntries();
    const groups = getSendableGroups();
    const secs = groups.map((g) => ({
      title: g,
      data: entries.filter((e) => e.group === g),
    }));
    return { sections: secs, flatSendable: entries };
  }, []);

  /* ── state ── */
  const [selectedId, setSelectedId] = useState(flatSendable[0]?.id ?? '');
  const [to, setTo] = useState('');
  const [smsc, setSmsc] = useState('');
  const [pidHex, setPidHex] = useState('00');
  const [dcsHex, setDcsHex] = useState('00');
  const [useBinary, setUseBinary] = useState(false);
  const [useUcs2, setUseUcs2] = useState(false);
  const [text, setText] = useState('');
  const [binaryHex, setBinaryHex] = useState('');
  const [builtPdu, setBuiltPdu] = useState('');
  const [decodedText, setDecodedText] = useState('');
  const [status, setStatus] = useState('Select a template, fill destination and build.');
  const [rawAvailable, setRawAvailable] = useState(false);
  const [sendingRaw, setSendingRaw] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /* ── check raw availability ── */
  useEffect(() => {
    let alive = true;
    RawPDUSender.isRawPduAvailable()
      .then((ok) => alive && setRawAvailable(ok))
      .catch(() => alive && setRawAvailable(false));
    return () => { alive = false; };
  }, []);

  /* ── apply template ── */
  useEffect(() => {
    const t = flatSendable.find((e) => e.id === selectedId);
    if (!t) return;
    setPidHex(hexPad(t.pid ?? 0));
    setDcsHex(hexPad(t.dcs ?? 0));
    setUseBinary(Boolean(t.binarySampleHex));
    setUseUcs2(Boolean(t.ucs2));
    setText(t.textSample ?? '');
    setBinaryHex(t.binarySampleHex ?? '');
    setStatus(`Template: ${t.title}`);
  }, [selectedId, flatSendable]);

  const selectedEntry = flatSendable.find((e) => e.id === selectedId);

  /* ── build ── */
  function buildPdu() {
    try {
      const tpl = flatSendable.find((e) => e.id === selectedId);
      if (!tpl) throw new Error('No template selected.');
      if (!to.trim()) throw new Error('Destination MSISDN required.');

      const pid = parseInt(pidHex, 16);
      const dcs = parseInt(dcsHex, 16);
      if (isNaN(pid) || isNaN(dcs)) throw new Error('PID/DCS must be valid hex.');

      const pdu = encodePDU({
        to,
        smsc: smsc.trim() || undefined,
        pid,
        dcs,
        ucs2: useUcs2,
        text: useBinary ? undefined : text,
        binary: useBinary ? hexToBytes(binaryHex) : undefined,
        udh: tpl.udh,
      });

      const decoded = decodePDU(pdu);
      setBuiltPdu(pdu);
      setDecodedText(
        `PID=0x${hexPad(decoded.pid)} | DCS=0x${hexPad(decoded.dcs)} | ` +
        `Encoding=${decoded.dcsEncoding} | UDL=${decoded.udLen}`,
      );

      addPDURecord({
        id: nanoid(),
        ts: Date.now(),
        direction: 'built',
        rawHex: pdu,
        decoded,
        label: tpl.title,
      });

      setStatus('PDU built successfully.');
    } catch (e: any) {
      setStatus(`Build error: ${String(e?.message ?? e)}`);
      setBuiltPdu('');
      setDecodedText('');
    }
  }

  /* ── raw send ── */
  async function sendRawPdu() {
    if (!builtPdu) return setStatus('Build PDU first.');
    if (!rawAvailable) return setStatus('Raw PDU API unavailable on this device.');
    try {
      setSendingRaw(true);
      const tpdu = toTPDU(builtPdu);
      const res = await RawPDUSender.sendRawPdu(tpdu, null);
      if (!res.success) throw new Error(res.error ?? 'Send failed');
      addPDURecord({
        id: nanoid(), ts: Date.now(), direction: 'sent',
        rawHex: builtPdu, decoded: decodePDU(builtPdu),
        label: 'Raw PDU send', sendResult: 'success',
      });
      setStatus('Raw PDU sent successfully.');
    } catch (e: any) {
      setStatus(`Send error: ${String(e?.message ?? e)}`);
    } finally {
      setSendingRaw(false);
    }
  }

  /* ── template picker item ── */
  function renderPickerItem({ item }: { item: DocumentationEntry }) {
    const active = item.id === selectedId;
    return (
      <TouchableOpacity
        style={[s.pickItem, active && s.pickItemActive]}
        onPress={() => { setSelectedId(item.id); setShowPicker(false); }}
        activeOpacity={0.65}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.pickTitle, active && { color: C.accent }]} numberOfLines={1}>{item.title}</Text>
          <Text style={s.pickSpec} numberOfLines={1}>{item.spec}</Text>
        </View>
        <Text style={s.pickPid}>PID {hexPad(item.pid ?? 0)} / DCS {hexPad(item.dcs ?? 0)}</Text>
      </TouchableOpacity>
    );
  }

  function renderSectionHeader({ section }: { section: { title: string } }) {
    return (
      <View style={s.secHeader}>
        <Text style={s.secHeaderText}>{section.title}</Text>
      </View>
    );
  }

  const androidNote =
    Platform.OS === 'android'
      ? `Android ${String(Platform.Version)}  —  raw send requires privileged/root access.`
      : 'Raw PDU sending is Android-only.';

  /* ── RENDER ── */
  return (
    <View style={s.root}>
      {/* ── Full-screen section picker ── */}
      {showPicker ? (
        <View style={s.pickerWrap}>
          <View style={s.pickerBar}>
            <Text style={s.pickerBarTitle}>Select Template</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="close" size={22} color={C.text} />
            </TouchableOpacity>
          </View>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderPickerItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            contentContainerStyle={{ paddingBottom: 30 }}
          />
        </View>
      ) : (
        /* ── Main builder form ── */
        <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* title */}
          <Text style={s.title}>PDU Builder</Text>
          <Text style={s.subtitle}>{flatSendable.length} sendable templates across {sections.length} groups</Text>

          {/* selected template card */}
          <TouchableOpacity style={s.templateCard} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={s.templateLabel}>TEMPLATE</Text>
              <Text style={s.templateTitle} numberOfLines={1}>{selectedEntry?.title ?? '—'}</Text>
              <Text style={s.templateGroup}>{selectedEntry?.group ?? ''}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={C.muted} />
          </TouchableOpacity>

          {/* selected template info */}
          {selectedEntry && (
            <View style={s.infoRow}>
              <View style={s.infoPill}><Text style={s.infoPillText}>PID 0x{hexPad(selectedEntry.pid ?? 0)}</Text></View>
              <View style={s.infoPill}><Text style={s.infoPillText}>DCS 0x{hexPad(selectedEntry.dcs ?? 0)}</Text></View>
              {selectedEntry.udh ? <View style={s.infoPill}><Text style={s.infoPillText}>UDH</Text></View> : null}
              {selectedEntry.ucs2 ? <View style={s.infoPill}><Text style={s.infoPillText}>UCS-2</Text></View> : null}
              {selectedEntry.binarySampleHex ? <View style={s.infoPill}><Text style={s.infoPillText}>Binary</Text></View> : null}
            </View>
          )}

          {selectedEntry && (
            <Text style={s.descText}>{selectedEntry.description}</Text>
          )}

          {/* ── Destination ── */}
          <Text style={s.label}>Destination (MSISDN)</Text>
          <TextInput
            value={to} onChangeText={setTo} style={s.input}
            placeholder="+4512345678" placeholderTextColor={C.muted}
            keyboardType="phone-pad"
          />

          {/* ── SMSC override ── */}
          <Text style={s.label}>SMSC Override (optional)</Text>
          <TextInput
            value={smsc} onChangeText={setSmsc} style={s.input}
            placeholder="+4510010010" placeholderTextColor={C.muted}
            keyboardType="phone-pad"
          />

          {/* PID / DCS row */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>PID (hex)</Text>
              <TextInput value={pidHex} onChangeText={setPidHex} style={s.input} autoCapitalize="characters" maxLength={2} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>DCS (hex)</Text>
              <TextInput value={dcsHex} onChangeText={setDcsHex} style={s.input} autoCapitalize="characters" maxLength={2} />
            </View>
          </View>

          {/* switches */}
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Binary payload</Text>
            <Switch
              value={useBinary} onValueChange={setUseBinary}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              thumbColor={useBinary ? C.accent : '#f1f5f9'}
            />
          </View>
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>UCS-2 encoding</Text>
            <Switch
              value={useUcs2} onValueChange={setUseUcs2}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              thumbColor={useUcs2 ? C.accent : '#f1f5f9'}
            />
          </View>

          {/* payload */}
          {useBinary ? (
            <>
              <Text style={s.label}>Binary Hex</Text>
              <TextInput
                value={binaryHex} onChangeText={setBinaryHex}
                style={[s.input, { fontFamily: 'monospace', minHeight: 64 }]}
                multiline placeholder="D011810301130082..." placeholderTextColor={C.muted}
              />
            </>
          ) : (
            <>
              <Text style={s.label}>Text</Text>
              <TextInput
                value={text} onChangeText={setText}
                style={[s.input, { minHeight: 48 }]}
                multiline placeholder="Message body" placeholderTextColor={C.muted}
              />
            </>
          )}

          {/* actions */}
          <TouchableOpacity style={s.btnPrimary} onPress={buildPdu} activeOpacity={0.75}>
            <Icon name="wrench" size={16} color="#ffffff" />
            <Text style={s.btnPrimaryText}>Build PDU</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnSecondary, !rawAvailable && { opacity: 0.45 }]}
            onPress={sendRawPdu}
            disabled={!rawAvailable || sendingRaw}
            activeOpacity={0.7}
          >
            <Icon name="send-lock-outline" size={16} color={C.accent} />
            <Text style={s.btnSecondaryText}>{sendingRaw ? 'Sending…' : 'Send via Raw PDU API'}</Text>
          </TouchableOpacity>

          <Text style={s.note}>{androidNote}</Text>

          {/* status */}
          <View style={s.statusBox}>
            <Text style={s.statusText}>{status}</Text>
            {decodedText ? <Text style={s.decodedLine}>{decodedText}</Text> : null}
          </View>

          {/* result */}
          {builtPdu ? (
            <View style={s.resultBox}>
              <Text style={s.resultTitle}>Built PDU ({builtPdu.length / 2} bytes)</Text>
              <Text style={s.resultHex}>{builtPdu.match(/.{1,2}/g)?.join(' ')}</Text>
              <Text style={[s.resultTitle, { marginTop: 10 }]}>TPDU for Raw API</Text>
              <Text style={s.resultHex}>{toTPDU(builtPdu).match(/.{1,2}/g)?.join(' ')}</Text>
            </View>
          ) : null}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

/* ── styles ── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },
  title: { color: C.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 2 },

  /* template card */
  templateCard: {
    marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.8 },
  templateTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginTop: 2 },
  templateGroup: { fontSize: 11, color: C.accent, marginTop: 2 },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  infoPill: {
    backgroundColor: C.accentLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  infoPillText: { fontSize: 10, fontWeight: '600', color: C.accent },

  descText: { color: C.sub, fontSize: 12, marginTop: 8, lineHeight: 17 },

  /* form */
  label: { color: C.muted, marginTop: 14, marginBottom: 4, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  input: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  switchLabel: { color: C.text, fontSize: 13 },

  /* buttons */
  btnPrimary: {
    marginTop: 18,
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  btnSecondary: {
    marginTop: 10,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnSecondaryText: { color: C.accent, fontWeight: '700', fontSize: 14 },
  note: { marginTop: 8, color: C.muted, fontSize: 10 },

  /* status & result */
  statusBox: {
    marginTop: 14,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  statusText: { color: C.text, fontSize: 12 },
  decodedLine: { color: C.accent, fontSize: 11, marginTop: 6, fontFamily: 'monospace' },
  resultBox: {
    marginTop: 12,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  resultTitle: { color: C.text, fontSize: 12, fontWeight: '700' },
  resultHex: { color: C.accent, fontSize: 11, fontFamily: 'monospace', marginTop: 4, lineHeight: 18 },

  /* full-screen template picker */
  pickerWrap: { flex: 1, backgroundColor: C.bg },
  pickerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pickerBarTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  secHeader: {
    backgroundColor: '#edf2f7',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secHeaderText: { fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  pickItemActive: { backgroundColor: C.accentLight },
  pickTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  pickSpec: { fontSize: 10, color: C.muted, marginTop: 1 },
  pickPid: { fontSize: 10, fontWeight: '600', color: C.muted, fontFamily: 'monospace', marginLeft: 8 },
});
