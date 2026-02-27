/**
 * LBS FieldGuard — PC Bridge Screen
 * Light theme matching lbs-int.com.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Clipboard,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { createBridgeSession, endBridgeSession, restoreBridgeSession } from '../../services/BridgeService';
import { uploadAndConfirmLogs } from '../../services/LogUploader';

const VIEWER_URL = 'https://fieldguard.lbs-int.com/viewer.php';

export default function PCBridgeScreen() {
  const {
    bridgeSession, bridgeError,
    uploadState, lastBundle, uploadError,
  } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);

  useEffect(() => {
    restoreBridgeSession().catch(() => {});
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try { await createBridgeSession(); }
    catch (e: any) { useAppStore.getState().setBridgeError(e.message); }
    finally { setCreating(false); }
  };

  const handleEnd = async () => { await endBridgeSession(); setPinCopied(false); };

  const handleCopyPin = () => {
    if (!bridgeSession) return;
    Clipboard.setString(bridgeSession.pin);
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
  };

  const handleUpload = async () => {
    if (!bridgeSession) return;
    setUploading(true);
    try { await uploadAndConfirmLogs(bridgeSession.token); }
    finally { setUploading(false); }
  };

  const handleClear = () => { useAppStore.getState().clearLogsAfterConfirm(); };

  const expiryText = bridgeSession ? 'Expires: ' + new Date(bridgeSession.expiresAt).toLocaleTimeString() : '';
  const pcStatus = bridgeSession?.pcConnected ? 'PC Connected' : 'Waiting for PC';
  const pcColor  = bridgeSession?.pcConnected ? '#16a34a' : '#94a3b8';

  const uploadLabel: Record<string, string> = {
    idle:       'Upload Logs to Server',
    uploading:  'Uploading\u2026',
    verifying:  'Verifying Checksum\u2026',
    confirmed:  'Upload Confirmed',
    error:      'Upload Failed \u2014 Retry',
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>PC Bridge</Text>
      <Text style={st.subtitle}>View live events on your PC browser by entering the 6-digit PIN.</Text>
      <Text style={st.viewerUrl}>{VIEWER_URL}</Text>

      {/* Session block */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Session</Text>
        {!bridgeSession ? (
          <>
            <TouchableOpacity
              style={[st.btn, st.btnPrimary, creating && st.btnDisabled]}
              onPress={handleCreate} disabled={creating}
            >
              {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={st.btnPrimaryText}>Start New Session</Text>}
            </TouchableOpacity>
            {bridgeError ? <Text style={st.errText}>{bridgeError}</Text> : null}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={handleCopyPin} activeOpacity={0.7}>
              <View style={st.pinRow}>
                {bridgeSession.pin.split('').map((d, i) => (
                  <Text key={i} style={st.pinDigit}>{d}</Text>
                ))}
              </View>
            </TouchableOpacity>
            <Text style={st.pinHint}>{pinCopied ? 'Copied!' : 'Tap PIN to copy'}</Text>
            <Text style={st.pinShare}>Enter this PIN at the PC viewer URL above.</Text>
            <View style={st.statusRow}>
              <Text style={[st.pcStatus, { color: pcColor }]}>{pcStatus}</Text>
              <Text style={st.expiry}>{expiryText}</Text>
            </View>
            <TouchableOpacity style={[st.btn, st.btnDanger]} onPress={handleEnd}>
              <Text style={st.btnDangerText}>End Session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Upload block */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Upload Logs</Text>
        {lastBundle && (
          <View style={st.shaBlock}>
            <View style={st.shaRow}>
              <Text style={st.shaLabel}>Local SHA-256</Text>
              <Text style={st.shaVal}>{lastBundle.localSha256.slice(0, 20)}\u2026</Text>
            </View>
            <View style={st.shaRow}>
              <Text style={st.shaLabel}>Server SHA-256</Text>
              <Text style={[st.shaVal, lastBundle.uploadState === 'confirmed' ? st.shaMatch : st.shaMismatch]}>
                {lastBundle.sha256 ? lastBundle.sha256.slice(0, 20) + '\u2026' : '\u2014'}
              </Text>
            </View>
            <Text style={st.bundleInfo}>{(lastBundle.sizeBytes / 1024).toFixed(1)} KB uploaded</Text>
            {lastBundle.uploadState === 'confirmed' && (
              <Text style={st.confirmed}>Checksum matched \u2014 safe to clear</Text>
            )}
          </View>
        )}
        {uploadError ? <Text style={st.errText}>{uploadError}</Text> : null}
        <TouchableOpacity
          style={[st.btn, uploadState === 'confirmed' ? st.btnSuccess : st.btnPrimary, (!bridgeSession || uploading) && st.btnDisabled]}
          onPress={handleUpload} disabled={!bridgeSession || uploading}
        >
          {uploading ? <ActivityIndicator color="#ffffff" /> : <Text style={st.btnPrimaryText}>{uploadLabel[uploadState] ?? 'Upload Logs to Server'}</Text>}
        </TouchableOpacity>
      </View>

      {/* Clear block */}
      <View style={[st.card, uploadState !== 'confirmed' && st.cardDisabled]}>
        <Text style={st.cardTitle}>Clear Local Logs</Text>
        <Text style={st.clearNote}>
          {uploadState === 'confirmed' ? 'Server has confirmed checksum match. You may safely clear local logs.' : 'Only available after server confirms checksum match.'}
        </Text>
        <TouchableOpacity
          style={[st.btn, st.btnDanger, uploadState !== 'confirmed' && st.btnDisabled]}
          onPress={handleClear} disabled={uploadState !== 'confirmed'}
        >
          <Text style={st.btnDangerText}>Clear Local Logs</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },
  content:        { padding: 16, paddingBottom: 40 },
  title:          { color: '#0f172a', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle:       { color: '#64748b', fontSize: 13, marginBottom: 4 },
  viewerUrl:      { color: '#2563eb', fontSize: 12, marginBottom: 20 },
  card:           { backgroundColor: '#ffffff', borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardDisabled:   { opacity: 0.45 },
  cardTitle:      { color: '#64748b', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  btn:            { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnPrimary:     { backgroundColor: '#2563eb' },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  btnDanger:      { backgroundColor: '#dc2626', marginTop: 14 },
  btnDangerText:  { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  btnSuccess:     { backgroundColor: '#16a34a' },
  btnDisabled:    { opacity: 0.4 },
  errText:        { color: '#dc2626', fontSize: 12, marginTop: 8 },
  pinRow:         { flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 8 },
  pinDigit:       { color: '#2563eb', fontSize: 38, fontFamily: 'monospace', fontWeight: '800', letterSpacing: 4, backgroundColor: '#eff6ff', paddingHorizontal: 6, borderRadius: 6 },
  pinHint:        { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 6 },
  pinShare:       { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 10 },
  statusRow:      { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  pcStatus:       { fontSize: 14, fontWeight: '600' },
  expiry:         { color: '#94a3b8', fontSize: 12 },
  shaBlock:       { backgroundColor: '#f1f5f9', borderRadius: 7, padding: 12, marginBottom: 10 },
  shaRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  shaLabel:       { color: '#64748b', fontSize: 12 },
  shaVal:         { color: '#334155', fontSize: 12, fontFamily: 'monospace' },
  shaMatch:       { color: '#16a34a' },
  shaMismatch:    { color: '#dc2626' },
  bundleInfo:     { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  confirmed:      { color: '#16a34a', fontSize: 12, fontWeight: '600', marginTop: 6 },
  clearNote:      { color: '#64748b', fontSize: 13, marginBottom: 4 },
});
