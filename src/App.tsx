/**
 * LBS FieldGuard — Root App Component
 *
 * Provides navigation shell and global store initialisation.
 * Platform-aware: Android gets RIL monitor; Windows gets packet sniffer.
 */

import React, { useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import RootNavigator from './ui/RootNavigator';
import { useAppStore } from './store/appStore';
import { initProbe } from './probe/ProbeClient';
import { loadSignatures } from './scanner/SignatureDB';
import { startRILMonitor } from './android/RILMonitor';
import { startPacketCapture } from './network/PacketAnalyser';
import UpdateBanner from './ui/components/UpdateBanner';

// Must be called before any navigation rendering
enableScreens();

// ── Error Boundary ─────────────────────────────────────────────
interface EBState { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FieldGuard] Uncaught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ color: '#f85149', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Something went wrong</Text>
          <Text style={{ color: '#8b949e', fontSize: 13, textAlign: 'center' }}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const DARK_BG = '#0d1117';

export default function App() {
  const { setProbeConnected, setSignaturesLoaded } = useAppStore();

  useEffect(() => {
    let mounted = true;

    // Async init — non-blocking and crash-safe
    (async () => {
      try {
        const count = await loadSignatures();
        if (mounted) setSignaturesLoaded(count);
      } catch (error) {
        console.error('[FieldGuard] loadSignatures failed:', error);
      }

      try {
        const connected = await initProbe();
        if (mounted) setProbeConnected(connected);
      } catch (error) {
        console.error('[FieldGuard] initProbe failed:', error);
        if (mounted) setProbeConnected(false);
      }

      try {
        if (Platform.OS === 'android') {
          startRILMonitor();
        } else if (Platform.OS === 'windows') {
          startPacketCapture();
        }
      } catch (error) {
        console.error('[FieldGuard] platform monitor init failed:', error);
      }
    })().catch((error) => {
      console.error('[FieldGuard] app init fatal:', error);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <NavigationContainer theme={{ dark: true, colors: { background: DARK_BG, border: '#30363d', card: '#161b22', notification: '#f0883e', primary: '#58a6ff', text: '#e6edf3' } }}>
            <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
            <View style={styles.root}>
              <RootNavigator />
              {/* Auto-update notification — fires 3 s after launch */}
              <UpdateBanner checkDelayMs={3_000} />
            </View>
          </NavigationContainer>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_BG },
});
