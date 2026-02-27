import { useScreenSize } from '../hooks/useScreenSize';
/**
 * LBS FieldGuard — Scanner Screen
 *
 * Allows the operator to pick a directory (or use predefined paths) and run
 * the byte-pattern scanner against every file, displaying a summary and
 * sortable results list.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useAppStore } from '../../store/appStore';
import { scanDirectory } from '../../scanner/FileScanner';
import { ScanResult } from '../../types';
import Icon from '../components/Icon';

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

const VERDICT_COLOR = { clean: '#3fb950', suspicious: '#d29922', malicious: '#f85149' };

export default function ScannerScreen() {
  const { addScanResult, clearScanResults, scanResults } = useAppStore();
  const { scale, fontSize, maxContentWidth } = useScreenSize();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, total: 0 });
  const [activeTarget, setActiveTarget] = useState<string>('');

  const targets = SCAN_TARGETS[Platform.OS] ?? SCAN_TARGETS.android!;

  async function startScan(target: string) {
    setScanning(true);
    setActiveTarget(target);
    setProgress({ scanned: 0, total: 0 });
    clearScanResults();
    try {
      const results = await scanDirectory({
        path: target,
        recursive: true,
        onProgress: (scanned, total) => setProgress({ scanned, total }),
      });
      for (const r of results) {
        addScanResult(r);
      }
    } finally {
      setScanning(false);
    }
  }

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
          >
            <Text style={styles.targetBtnTxt} numberOfLines={1}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Progress */}
      {scanning && (
        <View style={styles.progressBar}>
          <ActivityIndicator size="small" color="#58a6ff" />
          <Text style={styles.progressTxt}>
            {' '}Scanning {progress.scanned}/{progress.total}…
          </Text>
        </View>
      )}

      {/* Summary */}
      {!scanning && scanResults.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTxt}>
            {scanResults.length} files scanned —{' '}
          </Text>
          {maliciousCount > 0 && (
            <Text style={[styles.summaryTxt, { color: '#f85149' }]}>
              {maliciousCount} malicious{' '}
            </Text>
          )}
          {suspiciousCount > 0 && (
            <Text style={[styles.summaryTxt, { color: '#d29922' }]}>
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
              <Icon name="folder-search" size={40} color="#8b949e" />
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
        <Text key={i} style={styles.sigHit}>↳ {m.name} @ offset {m.offset}</Text>
      ))}
    </View>
  );
}

function _humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title:          { fontSize: 20, fontWeight: '700', color: '#e6edf3', marginBottom: 12 },
  targets:        { gap: 8 },
  targetBtn:      { backgroundColor: '#161b22', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', padding: 10 },
  targetBtnActive: { borderColor: '#58a6ff' },
  targetBtnTxt:   { color: '#e6edf3', fontSize: 12, fontFamily: 'monospace' },
  progressBar:    { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  progressTxt:    { color: '#8b949e', fontSize: 13 },
  summary:        { flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' },
  summaryTxt:     { color: '#e6edf3', fontSize: 13 },
  list:           { marginTop: 12, gap: 8 },
  empty:          { alignItems: 'center', marginTop: 48, gap: 12 },
  emptyTxt:       { color: '#8b949e', fontSize: 14 },
  resultRow:      { backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderLeftWidth: 3 },
  resultTop:      { flexDirection: 'row', justifyContent: 'space-between' },
  verdict:        { fontSize: 12, fontWeight: '700' },
  fileSize:       { fontSize: 11, color: '#8b949e' },
  fileName:       { fontSize: 13, color: '#e6edf3', marginTop: 2, fontFamily: 'monospace' },
  sigHit:         { fontSize: 11, color: '#f0883e', marginTop: 2 },
});
