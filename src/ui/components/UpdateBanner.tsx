/**
 * LBS FieldGuard — Update Available Banner
 *
 * Renders a dismissible bottom banner when a newer version is available.
 * Tapping "Update" opens the APK download URL or GitHub release page in the
 * device browser. The banner stays dismissed for the current app session.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { UpdateInfo, checkAndCacheUpdate } from '../../utils/UpdateChecker';

// ── Component ─────────────────────────────────────────────────────────────────

const ACCENT   = '#58a6ff';
const WARN_BG  = '#1c2a1e';
const WARN_BOR = '#2ea043';

interface Props {
  /** Delay in ms before the update check fires (default 3 000) */
  checkDelayMs?: number;
}

export default function UpdateBanner({ checkDelayMs = 3_000 }: Props) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useState(() => new Animated.Value(80))[0];
  const { width } = useWindowDimensions();

  // ── Run update check after a short delay so it doesn't block app start ──
  useEffect(() => {
    const timer = setTimeout(async () => {
      const info = await checkAndCacheUpdate();
      if (info.updateAvailable) {
        setUpdateInfo(info);
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }).start();
      }
    }, checkDelayMs);

    return () => clearTimeout(timer);
  }, [checkDelayMs, slideAnim]);

  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [slideAnim]);

  const openDownload = useCallback(async () => {
    const url = updateInfo?.downloadUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // fallback — do nothing silently
    }
    dismiss();
  }, [updateInfo, dismiss]);

  if (!visible || !updateInfo) return null;

  const maxW = Math.min(width - 32, 560);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }], maxWidth: maxW, alignSelf: 'center', width: '100%' },
      ]}
      accessibilityRole="alert"
    >
      {/* Left: icon + text */}
      <View style={styles.textGroup}>
        <Text style={styles.title}>
          🚀 Update available — v{updateInfo.latestVersion}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          You are on v{updateInfo.currentVersion}.
          {updateInfo.releaseNotes
            ? '  ' + updateInfo.releaseNotes.split('\n')[0].replace(/^#+\s*/, '')
            : ''}
        </Text>
      </View>

      {/* Right: actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btnUpdate}
          onPress={openDownload}
          activeOpacity={0.8}
          accessibilityLabel="Download update"
        >
          <Text style={styles.btnUpdateText}>
            {Platform.OS === 'android' ? 'Download APK' : 'View Release'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnDismiss}
          onPress={dismiss}
          activeOpacity={0.7}
          accessibilityLabel="Dismiss update banner"
        >
          <Text style={styles.btnDismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WARN_BG,
    borderWidth: 1,
    borderColor: WARN_BOR,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    gap: 12,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#aff3c0',
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  btnUpdate: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnUpdateText: {
    color: '#0d1117',
    fontWeight: '700',
    fontSize: 12,
  },
  btnDismiss: {
    padding: 4,
  },
  btnDismissText: {
    color: '#8b949e',
    fontSize: 16,
    fontWeight: '600',
  },
});
