import { useScreenSize } from '../hooks/useScreenSize';
/**
 * LBS FieldGuard — Scanner Screen
 *
 * Allows the operator to pick a directory (or use predefined paths) and run
 * the byte-pattern scanner against every file, displaying a summary and
 * sortable results list.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Platform,
  InteractionManager,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { scanDirectory } from '../../scanner/FileScanner';
import { ScanResult } from '../../types';
import Icon from '../components/Icon';
import { THEME } from '../theme';

// Predefined scan targets per platform
const SCAN_TARGETS: Record<string, string[]> = {
  android: [
    '/sdcard/Download',
    '/sdcard/DCIM',
    '/sdcard/Android/data',
    '/data/local/tmp',
  ],
  windows: [
    'C:\\Users\\Public\\Downloads',
    'C:\\ProgramData',
    process?.env?.TEMP ?? 'C:\\Windows\\Temp',
  ],
};

const VERDICT_COLOR = { clean: '#16a34a', suspicious: '#d97706', malicious: '#dc2626' };

export default function ScannerScreen() {
  const { addScanResult, clearScanResults, scanResults } = useAppStore();
  const { scale, fontSize, maxContentWidth } = useScreenSize();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, total: 0 });
  const [activeTarget, setActiveTarget] = useState<string>('');
  const [status, setStatus] = useState<string>('Pick a target to scan');
  const [scanError, setScanError] = useState<string>('');
  const scanRef = useRef(0); // prevent stale callbacks

  const targets = SCAN_TARGETS[Platform.OS] ?? SCAN_TARGETS.android!;

  const startScan = useCallback(async (target: string) => {
    const id = ++scanRef.current;
    setScanning(true);
    setScanError('');
    setActiveTarget(target);
    setProgress({ scanned: 0, total: 0 });
    setStatus('Preparing scan for ' + target + '\u2026');
    clearScanResults();

    // Let the UI render its "scanning" state before blocking the JS thread
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(resolve, 200);
      });
    });

    // Bail if another scan was triggered while we waited
    if (scanRef.current !== id) return;

    try {
      const results = await scanDirectory({
        path: target,
        recursive: true,
        onProgress: (scanned, total) => {
          if (scanRef.current === id) {
            setProgress({ scanned, total });
            setStatus('Scanning file ' + scanned + ' of ' + total + '\u2026');
          }
        },
      });

      if (scanRef.current !== id) return;

      for (const r of results) addScanResult(r);

      if (results.length === 0) {
        setStatus('No readable files found. Check storage permissions or try another path.');
      } else {
        const hits = results.filter((r) => r.verdict !== 'clean').length;
        setStatus('Completed: ' + results.length + ' files scanned, ' + hits + ' flagged.');
      }
    } catch (e: any) {
      if (scanRef.current !== id) return;
      const msg = String(e?.message ?? e);
      setScanError(msg);
      setStatus('Scan failed. See error below.');
    } finally {
      if (scanRef.current === id) setScanning(false);
    }
  }, [addScanResult, clearScanResults]);

  const maliciousCount = scanResults.filter((r) => r.verdict === 'malicious').length;
  const suspiciousCount = scanResults.filter((r) => r.verdict === 'suspicious').length;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>File Scanner</Text>

      {/* Target buttons */}
      <View style={styles.targets}>
        {targets.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.targetBtn, activeTarget === t && styles.targetBtnActive]}
            onPress={() => startScan(t)}
            disabled={scanning}
            activeOpacity={0.7}
          >
            <Icon name="folder-outline" size={14} color={activeTarget === t ? '#2563eb' : '#64748b'} />
            <Text style={[styles.targetBtnTxt, activeTarget === t && styles.targetBtnTxtActive]} numberOfLines={1}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Progress */}
      {scanning && (
        <View style={styles.progressBar}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.progressTxt}>
            {' '}Scanning {progress.scanned}/{progress.total}...
          </Text>
        </View>
      )}

      <Text style={styles.statusLine}>{status}</Text>
      {scanError ? <Text style={styles.errorLine}>{scanError}</Text> : null}

      {/* Summary */}
      {!scanning && scanResults.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTxt}>
            {scanResults.length} files scanned —{' '}
          </Text>
          {maliciousCount > 0 && (
            <Text style={[styles.summaryTxt, { color: '#dc2626' }]}>
              {maliciousCount} malicious{' '}
            </Text>
          )}
          {suspiciousCount > 0 && (
            <Text style={[styles.summaryTxt, { color: '#d97706' }]}>
              {suspiciousCount} suspicious
            </Text>
          )}
        </View>
      )}

      {/* Results list */}
      <FlatList
        data={scanResults.filter((r) => r.verdict !== 'clean')}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !scanning ? (
            <View style={styles.empty}>
              <Icon name="folder-search" size={40} color="#94a3b8" />
              <Text style={styles.emptyTxt}>Pick a target to scan</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <ResultRow result={item} />}
      />
    </View>
  );
}

function ResultRow({ result }: { result: ScanResult }) {
  const color = VERDICT_COLOR[result.verdict];
  return (
    <View style={[styles.resultRow, { borderLeftColor: color }]}>
      <View style={styles.resultTop}>
        <Text style={[styles.verdict, { color }]}>{result.verdict.toUpperCase()}</Text>
        <Text style={styles.fileSize}>{_humanSize(result.fileSize)}</Text>
      </View>
      <Text style={styles.fileName} numberOfLines={1}>{result.fileName}</Text>
      {result.matchedSignatures.map((m, i) => (
        <Text key={i} style={styles.sigHit}>{'↳ ' + m.name + ' @ offset ' + m.offset}</Text>
      ))}
    </View>
  );
}

function _humanSize(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: THEME.surface, padding: 16 },
  title:          { fontSize: 20, fontWeight: '700', color: THEME.text, marginBottom: 12 },
  targets:        { gap: 8 },
  targetBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.bg, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, padding: 12 },
  targetBtnActive: { borderColor: THEME.primary, backgroundColor: '#eff6ff' },
  targetBtnTxt:   { color: THEME.textSecondary, fontSize: 12, fontFamily: 'monospace', flex: 1 },
  targetBtnTxtActive: { color: THEME.primaryHover },
  progressBar:    { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  progressTxt:    { color: THEME.textMuted, fontSize: 13 },
  statusLine:     { color: THEME.primary, fontSize: 12, marginTop: 8 },
  errorLine:      { color: THEME.danger, fontSize: 12, marginTop: 4 },
  summary:        { flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' },
  summaryTxt:     { color: THEME.text, fontSize: 13 },
  list:           { marginTop: 12, gap: 8 },
  empty:          { alignItems: 'center', marginTop: 48, gap: 12 },
  emptyTxt:       { color: THEME.textLight, fontSize: 14 },
  resultRow:      { backgroundColor: THEME.bg, borderRadius: 8, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: THEME.border },
  resultTop:      { flexDirection: 'row', justifyContent: 'space-between' },
  verdict:        { fontSize: 12, fontWeight: '700' },
  fileSize:       { fontSize: 11, color: THEME.textMuted },
  fileName:       { fontSize: 13, color: THEME.text, marginTop: 2, fontFamily: 'monospace' },
  sigHit:         { fontSize: 11, color: '#ea580c', marginTop: 2 },
});
