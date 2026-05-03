/**
 * LBS FieldGuard — Update Available Banner + Native Notification
 *
 * When a newer version is detected:
 *  1. Fires a native Android notification (visible from lock screen / notification shade)
 *     with a tap action that opens the download URL directly in the device browser.
 *  2. Renders a dismissible in-app banner at the bottom of the screen.
 *
 * "Download APK" opens fieldguard.lbs-int.com/dl/android — our own mirror that serves
 * the signed APK directly. "View release notes" opens the landing page for confirmation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated, Linking, NativeModules, Platform, StyleSheet,
  Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { UpdateInfo, checkAndCacheUpdate, RELEASE_PAGE_URL } from '../../utils/UpdateChecker';

const { FieldGuardNotify } = NativeModules;

interface Props {
  checkDelayMs?: number;
}

export default function UpdateBanner({ checkDelayMs = 3_000 }: Props) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [visible, setVisible]       = useState(false);
  const slideAnim = useState(() => new Animated.Value(80))[0];
  const { width } = useWindowDimensions();

  const showBanner = useCallback((info: UpdateInfo) => {
    setUpdateInfo(info);
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  }, [slideAnim]);

  const fireNativeNotification = useCallback((info: UpdateInfo) => {
    if (Platform.OS !== 'android' || !FieldGuardNotify?.notifyUpdate) return;
    const version = info.latestVersion ?? 'new version';
    const url     = info.downloadUrl   ?? RELEASE_PAGE_URL;
    // Fire and forget — user may dismiss it and re-enter the app
    FieldGuardNotify.notifyUpdate(`v${version}`, url).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const info = await checkAndCacheUpdate();
      if (info.updateAvailable) {
        showBanner(info);
        fireNativeNotification(info);
      }
    }, checkDelayMs);
    return () => clearTimeout(timer);
  }, [checkDelayMs, showBanner, fireNativeNotification]);

  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, { toValue: 100, duration: 200, useNativeDriver: true })
      .start(() => setVisible(false));
  }, [slideAnim]);

  const openDownload = useCallback(async () => {
    const url = updateInfo?.downloadUrl ?? RELEASE_PAGE_URL;
    try { await Linking.openURL(url); } catch {}
    dismiss();
  }, [updateInfo, dismiss]);

  const openReleasePage = useCallback(async () => {
    const url = updateInfo?.releasePageUrl ?? RELEASE_PAGE_URL;
    try { await Linking.openURL(url); } catch {}
  }, [updateInfo]);

  if (!visible || !updateInfo) return null;

  const maxW = Math.min(width - 32, 560);
  const firstNote = updateInfo.releaseNotes
    ? updateInfo.releaseNotes.split('\n').find(l => l.trim().length > 0)?.replace(/^#+\s*/, '')
    : undefined;

  return (
    <Animated.View
      style={[s.container, { transform: [{ translateY: slideAnim }], maxWidth: maxW, alignSelf: 'center', width: '100%' }]}
      accessibilityRole="alert"
    >
      <View style={s.textGroup}>
        <View style={s.titleRow}>
          <View style={s.vBadge}><Text style={s.vBadgeText}>v{updateInfo.latestVersion}</Text></View>
          <Text style={s.title}>Update available</Text>
        </View>
        <Text style={s.subtitle} numberOfLines={2}>
          {firstNote ?? `You're on v${updateInfo.currentVersion}. Install the latest signed build.`}
        </Text>
        <TouchableOpacity onPress={openReleasePage} activeOpacity={0.7}>
          <Text style={s.viewNotes}>View release notes ↗</Text>
        </TouchableOpacity>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={s.btnUpdate}
          onPress={openDownload}
          activeOpacity={0.8}
          accessibilityLabel="Download update"
        >
          <Text style={s.btnUpdateText}>
            {Platform.OS === 'android' ? 'Download APK' : 'View Release'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnDismiss} onPress={dismiss} accessibilityLabel="Dismiss">
          <Text style={s.btnDismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position:          'absolute',
    bottom:            16,
    left:              16,
    right:             16,
    flexDirection:     'row',
    alignItems:        'flex-start',
    backgroundColor:   '#0f1a15',
    borderWidth:       1,
    borderColor:       '#2ea043',
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   12,
    zIndex:            9999,
    elevation:         14,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.45,
    shadowRadius:      10,
    gap:               12,
  },
  textGroup:     { flex: 1, gap: 3 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 1 },
  vBadge:        { backgroundColor: '#2ea043', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  vBadgeText:    { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.3 },
  title:         { color: '#aff3c0', fontWeight: '700', fontSize: 13 },
  subtitle:      { color: '#8b949e', fontSize: 11, lineHeight: 16 },
  viewNotes:     { color: '#58a6ff', fontSize: 10, marginTop: 3 },
  actions:       { flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, paddingTop: 2 },
  btnUpdate:     { backgroundColor: '#238636', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnUpdateText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnDismiss:    { padding: 4 },
  btnDismissText:{ color: '#8b949e', fontSize: 16, fontWeight: '600' },
});
