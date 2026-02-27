/**
 * LBS FieldGuard — Root App Component
 *
 * Provides navigation shell and global store initialisation.
 * Platform-aware: Android gets RIL monitor; Windows gets packet sniffer.
 */

import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './ui/RootNavigator';
import { useAppStore } from './store/appStore';
import { initProbe } from './probe/ProbeClient';
import { loadSignatures } from './scanner/SignatureDB';
import { startRILMonitor } from './android/RILMonitor';
import { startPacketCapture } from './network/PacketAnalyser';

const DARK_BG = '#0d1117';

export default function App() {
  const { setProbeConnected, setSignaturesLoaded } = useAppStore();

  useEffect(() => {
    // Async init — non-blocking
    (async () => {
      // Load byte-pattern signatures from bundled asset
      const count = await loadSignatures();
      setSignaturesLoaded(count);

      // Connect to the LBS station probe relay
      const connected = await initProbe();
      setProbeConnected(connected);

      // Platform-specific monitors
      if (Platform.OS === 'android') {
        startRILMonitor();
      } else if (Platform.OS === 'windows') {
        startPacketCapture();
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={{ dark: true, colors: { background: DARK_BG, border: '#30363d', card: '#161b22', notification: '#f0883e', primary: '#58a6ff', text: '#e6edf3' } }}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        <View style={styles.root}>
          <RootNavigator />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_BG },
});
