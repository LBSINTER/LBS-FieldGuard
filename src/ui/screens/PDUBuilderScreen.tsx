import { useScreenSize } from '../hooks/useScreenSize';
/**
 * LBS FieldGuard — PDU Builder Screen
 *
 * Allows the field operator to:
 *   1. Pick a payload template from the SS7 catalogue (or custom)
 *   2. Fill in destination, content, PID/DCS overrides
 *   3. Build the PDU hex and inspect the decode
 *   4. Log built PDUs to the pduLog store
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { SS7_PAYLOAD_CATALOGUE } from '../../ss7/PayloadCatalogue';
import { encodePDU, decodePDU, bytesToHex, hexToBytes } from '../../android/PDUCodec';
import { nanoid } from '../../utils/id';
import Icon from '../components/Icon';

export default function PDUBuilderScreen() {
  const { addPDURecord } = useAppStore();
  const { scale, fontSize, maxContentWidth } = useScreenSize();

  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [pidHex, setPidHex] = useState('00');
  const [dcsHex, setDcsHex] = useState('00');
  const [binaryPayload, setBinaryPayload] = useState('');
  const [useBinary, setUseBinary] = useState(false);
  const [templateIdx, setTemplateIdx] = useState<number>(-1);
  const [builtPDU, setBuiltPDU] = useState('');
  const [decoded, setDecoded] = useState<ReturnType<typeof decodePDU> | null>(null);
  const [error, setError] = useState('');

  const templates = SS7_PAYLOAD_CATALOGUE.filter(
    (e) => e.pduPrefix || e.pid !== undefined || e.dcs !== undefined
  );

  function applyTemplate(idx: number) {
    setTemplateIdx(idx);
    const t = templates[idx];
    if (!t) return;
    if (t.pid !== undefined) setPidHex(t.pid.toString(16).padStart(2, '0'));
    if (t.dcs !== undefined) {
      setDcsHex(t.dcs.toString(16).padStart(2, '0'));
      setUseBinary((t.dcs & 0x04) !== 0);
    }
    if (t.pduPrefix) {
      setBinaryPayload(t.pduPrefix.replace(/\?\?/g, '00').replace(/\s/g, ''));
    }
  }

  function build() {
    setError('');
    setBuiltPDU('');
    setDecoded(null);
    try {
      const pid = parseInt(pidHex, 16);
      const dcs = parseInt(dcsHex, 16);
      let pdu: string;
      if (useBinary) {
        pdu = encodePDU({
          to,
          binary: hexToBytes(binaryPayload),
          pid,
          dcs: dcs | 0x04,
        });
      } else {
        pdu = encodePDU({ to, text, pid, dcs });
      }
      setBuiltPDU(pdu);
      // Decode for verification
      setDecoded(decodePDU(pdu));
      // Log
      addPDURecord({
        id: nanoid(),
        ts: Date.now(),
        direction: 'built',
        rawHex: pdu,
        decoded: decodePDU(pdu),
        label: templates[templateIdx]?.name,
      });
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PDU Builder</Text>

      {/* Template picker */}
      <Text style={styles.label}>Template (optional)</Text>
      <ScrollView horizontal style={styles.templateScroll}>
        {templates.map((t, i) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.templateChip, templateIdx === i && styles.templateChipActive]}
            onPress={() => applyTemplate(i)}
          >
            <Text style={[styles.templateChipTxt, templateIdx === i && { color: '#0d1117' }]}>
              {t.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {templateIdx >= 0 && (
        <Text style={styles.templateDesc}>{templates[templateIdx]?.description?.slice(0, 120)}…</Text>
      )}

      {/* Destination */}
      <Text style={styles.label}>To (MSISDN)</Text>
      <TextInput
        style={styles.input}
        value={to}
        onChangeText={setTo}
        placeholder="+1234567890"
        placeholderTextColor="#8b949e"
        keyboardType="phone-pad"
      />

      {/* PID / DCS */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>PID (hex)</Text>
          <TextInput style={styles.input} value={pidHex} onChangeText={setPidHex}
            placeholder="00" placeholderTextColor="#8b949e" autoCapitalize="none" />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>DCS (hex)</Text>
          <TextInput style={styles.input} value={dcsHex} onChangeText={setDcsHex}
            placeholder="00" placeholderTextColor="#8b949e" autoCapitalize="none" />
        </View>
      </View>

      {/* Binary toggle */}
      <View style={[styles.row, { marginVertical: 8 }]}>
        <Text style={styles.label}>Binary payload</Text>
        <Switch value={useBinary} onValueChange={setUseBinary}
          trackColor={{ false: '#30363d', true: '#1f6feb' }} thumbColor="#e6edf3" />
      </View>

      {useBinary ? (
        <>
          <Text style={styles.label}>Payload hex</Text>
          <TextInput
            style={[styles.input, styles.mono]}
            value={binaryPayload}
            onChangeText={setBinaryPayload}
            placeholder="d0 12 81 03 ..."
            placeholderTextColor="#8b949e"
            autoCapitalize="none"
            multiline
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Text (GSM-7)</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Hello"
            placeholderTextColor="#8b949e"
          />
        </>
      )}

      <TouchableOpacity style={styles.buildBtn} onPress={build}>
        <Icon name="wrench" size={18} color="#0d1117" />
        <Text style={styles.buildBtnTxt}> Build PDU</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {builtPDU ? (
        <View style={styles.result}>
          <Text style={styles.label}>Built PDU (SMS-SUBMIT):</Text>
          <ScrollView horizontal>
            <Text style={styles.hex}>{builtPDU.match(/.{1,2}/g)?.join(' ')}</Text>
          </ScrollView>
          {decoded && (
            <>
              <Text style={[styles.label, { marginTop: 8 }]}>Decoded verify:</Text>
              <Text style={styles.decodedLine}>PID: 0x{decoded.pid.toString(16).toUpperCase().padStart(2,'0')}</Text>
              <Text style={styles.decodedLine}>DCS: 0x{decoded.dcs.toString(16).toUpperCase().padStart(2,'0')} ({decoded.dcsEncoding})</Text>
              {decoded.text && <Text style={styles.decodedLine}>Text: {decoded.text}</Text>}
              {decoded.binaryPayload && (
                <Text style={styles.decodedLine}>Binary: {decoded.binaryPayload.slice(0, 64)}…</Text>
              )}
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#0d1117' },
  content:          { padding: 16 },
  title:            { fontSize: 20, fontWeight: '700', color: '#e6edf3', marginBottom: 12 },
  label:            { fontSize: 13, color: '#8b949e', marginTop: 12, marginBottom: 4 },
  input:            { backgroundColor: '#161b22', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', color: '#e6edf3', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  mono:             { fontFamily: 'monospace' },
  row:              { flexDirection: 'row', alignItems: 'center' },
  templateScroll:   { flexGrow: 0, marginVertical: 8 },
  templateChip:     { backgroundColor: '#161b22', borderRadius: 16, borderWidth: 1, borderColor: '#30363d', paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  templateChipActive: { backgroundColor: '#58a6ff', borderColor: '#58a6ff' },
  templateChipTxt:  { color: '#e6edf3', fontSize: 12 },
  templateDesc:     { fontSize: 11, color: '#8b949e', marginBottom: 8 },
  buildBtn:         { flexDirection: 'row', backgroundColor: '#238636', borderRadius: 6, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buildBtnTxt:      { color: '#e6edf3', fontWeight: '600', fontSize: 15 },
  error:            { color: '#f85149', marginTop: 8, fontSize: 13 },
  result:           { backgroundColor: '#161b22', borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#30363d' },
  hex:              { fontFamily: 'monospace', fontSize: 12, color: '#79c0ff' },
  decodedLine:      { fontSize: 12, color: '#e6edf3', marginTop: 2 },
});
