/**
 * LBS FieldGuard — Settings Screen
 * Loads persisted values from AsyncStorage on mount; saves on button press.
 * Light theme matching lbs-int.com.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Switch, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../components/Icon';
import { useScreenSize } from '../hooks/useScreenSize';
import { APP_VERSION, PROBE_HOST, PROBE_PORT, RELAY_BASE_URL } from '../../config/build';

const KEYS = {
  STATION_HOST: 'fg_station_host',
  STATION_PORT: 'fg_station_port',
  RELAY_URL:    'fg_relay_url',
  VPN_DETECT:   'fg_vpn_detect',
  DEEP_SCAN:    'fg_deep_scan',
};

export default function SettingsScreen() {
  const [host,      setHost]      = useState(PROBE_HOST);
  const [port,      setPort]      = useState(String(PROBE_PORT));
  const [relay,     setRelay]     = useState(RELAY_BASE_URL);
  const [vpnDetect, setVpnDetect] = useState(true);
  const [deepScan,  setDeepScan]  = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [loaded,    setLoaded]    = useState(false);
  const [shareReports,    setShareReports]    = useState(false);
  const [shareMinSev,     setShareMinSev]     = useState<string>('high');
  const [shareLow,        setShareLow]        = useState(false);
  const [connNetUrl,      setConnNetUrl]      = useState('https://fieldguard.connectednet.com/api.php');

  const { scale, fontSize, maxContentWidth } = useScreenSize();

  useEffect(() => {
    AsyncStorage.multiGet([
      KEYS.STATION_HOST, KEYS.STATION_PORT, KEYS.RELAY_URL,
      KEYS.VPN_DETECT, KEYS.DEEP_SCAN, 'fg_settings',
    ]).then((pairs) => {
      const m = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (m[KEYS.STATION_HOST]) setHost(m[KEYS.STATION_HOST]!);
      if (m[KEYS.STATION_PORT]) setPort(m[KEYS.STATION_PORT]!);
      if (m[KEYS.RELAY_URL])    setRelay(m[KEYS.RELAY_URL]!);
      if (m[KEYS.VPN_DETECT] !== null)  setVpnDetect(m[KEYS.VPN_DETECT] !== 'false');
      if (m[KEYS.DEEP_SCAN]  !== null)  setDeepScan(m[KEYS.DEEP_SCAN]   === 'true');
      try {
        const settings = m['fg_settings'] ? JSON.parse(m['fg_settings']) : {};
        if (settings.shareReports     !== undefined) setShareReports(settings.shareReports);
        if (settings.shareMinSeverity !== undefined) setShareMinSev(settings.shareMinSeverity);
        if (settings.shareLowEnabled  !== undefined) setShareLow(settings.shareLowEnabled);
        if (settings.connectedNetUrl  !== undefined) setConnNetUrl(settings.connectedNetUrl);
      } catch {}
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function save() {
    await AsyncStorage.multiSet([
      [KEYS.STATION_HOST, host],
      [KEYS.STATION_PORT, port],
      [KEYS.RELAY_URL,    relay],
      [KEYS.VPN_DETECT,   String(vpnDetect)],
      [KEYS.DEEP_SCAN,    String(deepScan)],
    ]);
    const current = await AsyncStorage.getItem('fg_settings').catch(() => null);
    const current_parsed = current ? JSON.parse(current) : {};
    await AsyncStorage.setItem('fg_settings', JSON.stringify({
      ...current_parsed,
      shareReports: shareReports,
      shareMinSeverity: shareMinSev,
      shareLowEnabled: shareLow,
      connectedNetUrl: connNetUrl,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!loaded) return null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        { padding: scale(16), paddingBottom: scale(32) },
        maxContentWidth ? { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth } : undefined,
      ]}
    >
      <Text style={[styles.title, { fontSize: fontSize(20) }]}>Settings</Text>

      <Text style={[styles.section, { fontSize: fontSize(13) }]}>Station Connection</Text>
      <Text style={[styles.label, { fontSize: fontSize(13) }]}>Station Host</Text>
      <TextInput
        style={[styles.input, { fontSize: fontSize(14), paddingHorizontal: scale(12), paddingVertical: scale(8) }]}
        value={host} onChangeText={setHost}
        placeholderTextColor="#94a3b8" autoCapitalize="none"
      />
      <Text style={[styles.label, { fontSize: fontSize(13) }]}>Station Probe Port</Text>
      <TextInput
        style={[styles.input, { fontSize: fontSize(14), paddingHorizontal: scale(12), paddingVertical: scale(8) }]}
        value={port} onChangeText={setPort}
        keyboardType="number-pad" placeholderTextColor="#94a3b8"
      />

      <Text style={[styles.section, { fontSize: fontSize(13) }]}>PC Bridge / Log Relay</Text>
      <Text style={[styles.label, { fontSize: fontSize(13) }]}>Relay API URL</Text>
      <TextInput
        style={[styles.input, { fontSize: fontSize(13), paddingHorizontal: scale(12), paddingVertical: scale(8) }]}
        value={relay} onChangeText={setRelay}
        placeholderTextColor="#94a3b8" autoCapitalize="none" autoCorrect={false}
      />

      <Text style={[styles.section, { fontSize: fontSize(13) }]}>Detection</Text>
      <View style={styles.row}>
        <Text style={[styles.toggleLabel, { fontSize: fontSize(14) }]}>VPN / Proxy IP detection</Text>
        <Switch value={vpnDetect} onValueChange={setVpnDetect}
          trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={vpnDetect ? '#2563eb' : '#f1f5f9'} />
      </View>
      <View style={styles.row}>
        <Text style={[styles.toggleLabel, { fontSize: fontSize(14) }]}>Deep filesystem scan (slower)</Text>
        <Switch value={deepScan} onValueChange={setDeepScan}
          trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={deepScan ? '#2563eb' : '#f1f5f9'} />
      </View>

      <Text style={[styles.section, { fontSize: fontSize(13) }]}>Threat Intelligence Sharing</Text>
      <View style={styles.row}>
        <Text style={[styles.toggleLabel, { fontSize: fontSize(14) }]}>Share anonymised threat reports</Text>
        <Switch value={shareReports} onValueChange={setShareReports}
          trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={shareReports ? '#2563eb' : '#f1f5f9'} />
      </View>
      {shareReports && (
        <>
          <Text style={[styles.label, { fontSize: fontSize(12) }]}>
            Only threat signatures, PDU hex, and cell IDs are shared. No MSISDN or IMEI.
          </Text>
          <Text style={[styles.label, { fontSize: fontSize(13) }]}>Minimum severity to share</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {(['critical', 'high', 'medium'] as const).map((sev) => (
              <TouchableOpacity
                key={sev}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                  backgroundColor: shareMinSev === sev ? '#2563eb' : '#ffffff',
                  borderWidth: 1, borderColor: shareMinSev === sev ? '#2563eb' : '#e2e8f0' }}
                onPress={() => setShareMinSev(sev)}
              >
                <Text style={{ color: shareMinSev === sev ? '#ffffff' : '#64748b', fontSize: fontSize(12), fontWeight: '600' }}>
                  {sev.toUpperCase()}+
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Text style={[styles.toggleLabel, { fontSize: fontSize(14) }]}>Also share low-priority alerts</Text>
            <Switch value={shareLow} onValueChange={setShareLow}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={shareLow ? '#2563eb' : '#f1f5f9'} />
          </View>
          <Text style={[styles.label, { fontSize: fontSize(13), marginTop: 12 }]}>connectednet.com API URL</Text>
          <TextInput
            style={[styles.input, { fontSize: fontSize(13), paddingHorizontal: scale(12), paddingVertical: scale(8) }]}
            value={connNetUrl} onChangeText={setConnNetUrl}
            placeholderTextColor="#94a3b8" autoCapitalize="none" autoCorrect={false}
          />
        </>
      )}


      <TouchableOpacity
        style={[styles.saveBtn, { borderRadius: scale(6), padding: scale(12), marginTop: scale(24) }]}
        onPress={save}
      >
        <Icon name={saved ? 'check' : 'content-save'} size={scale(18)} color="#ffffff" />
        <Text style={[styles.saveBtnTxt, { fontSize: fontSize(15) }]}>{saved ? ' Saved' : ' Save Settings'}</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { fontSize: fontSize(11), marginTop: scale(24) }]}>
        LBS FieldGuard v{APP_VERSION}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f8fafc' },
  title:       { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  section:     { fontSize: 13, fontWeight: '600', color: '#2563eb', marginTop: 20, marginBottom: 8 },
  label:       { fontSize: 13, color: '#64748b', marginTop: 8, marginBottom: 4 },
  input:       { backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 8 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  toggleLabel: { color: '#0f172a', fontSize: 14, flex: 1, marginRight: 12 },
  saveBtn:     { flexDirection: 'row', backgroundColor: '#2563eb', borderRadius: 6, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnTxt:  { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  version:     { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 24 },
});
