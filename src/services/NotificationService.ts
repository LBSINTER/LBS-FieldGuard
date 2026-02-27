import { NativeModules, Platform } from 'react-native';
import type { Severity } from '../types';

type NativeNotify = {
  isAvailable: () => Promise<boolean>;
  startMonitoringNotification: (mode: string, detail: string) => Promise<boolean>;
  stopMonitoringNotification: () => Promise<boolean>;
  notifyThreat: (title: string, detail: string, severity: string) => Promise<boolean>;
};

const mod = NativeModules.FieldGuardNotify as NativeNotify | undefined;

export async function startStickyMonitoring(mode: string, detail: string): Promise<void> {
  if (Platform.OS !== 'android' || !mod) return;
  try {
    await mod.startMonitoringNotification(mode, detail);
  } catch {}
}

export async function stopStickyMonitoring(): Promise<void> {
  if (Platform.OS !== 'android' || !mod) return;
  try {
    await mod.stopMonitoringNotification();
  } catch {}
}

export async function notifyThreatAlert(title: string, detail: string, severity: Severity): Promise<void> {
  if (Platform.OS !== 'android' || !mod) return;
  try {
    await mod.notifyThreat(title, detail, severity);
  } catch {}
}

export function isNotifyAvailable(): boolean {
  return Platform.OS === 'android' && !!mod;
}
