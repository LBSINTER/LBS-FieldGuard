/**
 * LBS FieldGuard — Settings Screen
 * Responsive: font sizes and padding scale with device class.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../components/Icon';
import { useScreenSize } from '../hooks/useScreenSize';
import { APP_VERSION } from '../../config/build';

const KEYS = {
  STATION_HOST: 'fg_station_host',
  STATION_PORT: 'fg_station_port',
  VPN_DETECT:   'fg_vpn_detect',
  DEEP_SCAN:    'fg_deep_scan',
};

export default function SettingsScreen() {
  const [host, setHost] = useState('140.82.39.182');
  const [port, setPort] = useState('5556');
  const [vpnDetect, setVpnDetect] = useState(true);
  const [deepScan, setDeepScan] = useState(false);
  const [saved, setSaved] = useState(false);

  const { scale, fontSize, maxContentWidth } = useScreenSize();

  async function save() {
    await AsyncStorage.multiSet([
      [KEYS.STATION_HOST, host],
      [KEYS.STATION_PORT, port],
      [KEYS.VPN_DETECT, String(vpnDetect)],
      [KEYS.DEEP_SCAN, String(deepScan)],
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
        placeholderTextColor="#8b949e" autoCapitalize="none"
      />
      <Text style={[styles.label, { fontSize: fontSize(13) }]}>Station Probe Port</Text>
      <TextInput
        style={[styles.input, { fontSize: fontSize(14), paddingHorizontal: scale(12), paddingVertical: scale(8) }]}
        value={port} onChangeText={setPort}
        keyboardType="number-pad" placeholderTextColor="#8b949e"
      />

      <Text style={[styles.section, { fontSize: fontSize(13) }]}>Detection</Text>
      <View style={styles.row}>
        <Text style={[styles.toggleLabel, { fontSize: fontSize(14) }]}>VPN/Proxy IP detection</Text>
        <Switch value={vpnDetect} onValueChange={setVpnDetect}
          trackColor={{ false: '#30363d', true: '#1f6feb' }} thumbColor="#e6edf3" />
      </View>
      <View style={styles.row}>
        <Text style={[styles.toggleLabel, { fontSize: fontSize(14) }]}>Deep filesystem scan (slower)</Text>
        <Switch value={deepScan} onValueChange={setDeepScan}
          trackColor={{ false: '#30363d', true: '#1f6feb' }} thumbColor="#e6edf3" />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { borderRadius: scale(6), padding: scale(12), marginTop: scale(24) }]}
        onPress={save}
      >
        <Icon name={saved ? 'check' : 'content-save'} size={scale(18)} color="#0d1117" />
        <Text style={[styles.saveBtnTxt, { fontSize: fontSize(15) }]}>{saved ? ' Saved' : ' Save Settings'}</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { fontSize: fontSize(11), marginTop: scale(24) }]}>
        LBS FieldGuard v{APP_VERSION}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#0d1117' },
  content:      { padding: 16 },
  title:        { fontSize: 20, fontWeight: '700', color: '#e6edf3', marginBottom: 12 },
  section:      { fontSize: 13, fontWeight: '600', color: '#58a6ff', marginTop: 20, marginBottom: 8 },
  label:        { fontSize: 13, color: '#8b949e', marginTop: 8, marginBottom: 4 },
  input:        { backgroundColor: '#161b22', borderRadius: 6, borderWidth: 1, borderColor: '#30363d', color: '#e6edf3', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  toggleLabel:  { color: '#e6edf3', fontSize: 14 },
  saveBtn:      { flexDirection: 'row', backgroundColor: '#238636', borderRadius: 6, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnTxt:   { color: '#0d1117', fontWeight: '700', fontSize: 15 },
  version:      { color: '#8b949e', fontSize: 11, textAlign: 'center', marginTop: 24 },
});
