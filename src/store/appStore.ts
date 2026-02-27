/**
 * LBS FieldGuard — Global App Store (Zustand)
 *
 * No mock/demo data is ever inserted here — all state comes from real device events.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert, ScanResult, RILEvent, PDURecord, ProbeStatus,
  BridgeSession, LogBundle, UploadState, AppSettings, Severity,
  CellMeasurement, IMSICatcherEvent, ATCommandRecord, ATDevice,
  ATModemInfo, CapabilityResult, SubscriberInfo, AuthEvent,
} from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  probeHost:          '10.0.0.1',
  probePort:          '9999',
  relayUrl:           'https://fieldguard.lbs-int.com/api.php',
  connectedNetUrl:    'https://fieldguard.connectednet.com/api.php',
  shareReports:       false,
  shareMinSeverity:   'high',
  shareLowEnabled:    false,
  deviceId:           '',
  onboardingDone:     false,
  darkMode:           true,
  deepScan:           false,
  vpnDetect:          false,
};

interface AppState {
  signaturesLoaded: number;
  probeConnected: boolean;
  alerts: Alert[];
  scanResults: ScanResult[];
  rilEvents: RILEvent[];
  pduLog: PDURecord[];
  probeStatus: ProbeStatus;
  probeLatencyMs: number;
  bridgeSession: BridgeSession | null;
  bridgeError: string | null;
  uploadState: UploadState;
  lastBundle: LogBundle | null;
  uploadError: string | null;
  settings: AppSettings;
  onboardingDone: boolean;
  monitoringMode: string;
  monitoringDetail: string;

  // Cell measurement & IMSI catcher
  cellMeasurements:   CellMeasurement[];
  imsiCatcherEvents:  IMSICatcherEvent[];
  addCellMeasurement: (m: CellMeasurement) => void;
  addIMSICatcherEvent:(e: IMSICatcherEvent) => void;
  clearCellData:      () => void;

  // AT command interface
  atDevices:    ATDevice[];
  atLog:        ATCommandRecord[];
  atModemInfo:  ATModemInfo | null;
  setATDevices: (d: ATDevice[]) => void;
  addATRecord:  (r: ATCommandRecord) => void;
  setATModemInfo:(i: ATModemInfo) => void;
  clearATLog:   () => void;

  // Device capability
  capabilityResult:   CapabilityResult | null;
  setCapabilityResult:(r: CapabilityResult) => void;

  // Subscriber identity
  subscriberInfo:     SubscriberInfo | null;
  setSubscriberInfo:  (i: SubscriberInfo) => void;

  // Auth event monitor
  authEvents:    AuthEvent[];
  addAuthEvent:  (e: AuthEvent) => void;
  clearAuthEvents: () => void;

  setSignaturesLoaded: (n: number) => void;
  setProbeConnected: (v: boolean) => void;
  setProbeStatus: (s: ProbeStatus, latencyMs?: number) => void;
  addAlert: (a: Alert) => void;
  clearAlerts: () => void;
  addScanResult: (r: ScanResult) => void;
  clearScanResults: () => void;
  addRILEvent: (e: RILEvent) => void;
  addPDURecord: (r: PDURecord) => void;
  setBridgeSession: (s: BridgeSession | null) => void;
  setBridgeError: (e: string | null) => void;
  updateBridgePCStatus: (connected: boolean) => void;
  setUploadState: (s: UploadState) => void;
  setLastBundle: (b: LogBundle | null) => void;
  setUploadError: (e: string | null) => void;
  clearLogsAfterConfirm: () => void;
  setSettings: (s: Partial<AppSettings>) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setOnboardingDone: (done: boolean) => void;
  setMonitoringCapabilities: (mode: string, detail: string) => void;
  loadSettingsFromStorage: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  signaturesLoaded: 0,
  probeConnected: false,
  alerts: [],
  scanResults: [],
  rilEvents: [],
  pduLog: [],
  probeStatus: 'disconnected',
  probeLatencyMs: -1,
  bridgeSession: null,
  bridgeError: null,
  uploadState: 'idle',
  lastBundle: null,
  uploadError: null,
  settings: { ...DEFAULT_SETTINGS },
  onboardingDone: false,
  monitoringMode: 'Not started',
  monitoringDetail: 'Monitoring pipeline has not started yet.',

  cellMeasurements: [],
  imsiCatcherEvents: [],
  atDevices: [],
  atLog: [],
  atModemInfo: null,
  capabilityResult: null,
  subscriberInfo: null,
  authEvents: [],

  setSignaturesLoaded: (n) => set({ signaturesLoaded: n }),
  setProbeConnected:   (v) => set({ probeConnected: v }),
  setProbeStatus: (s, latencyMs) =>
    set((state) => ({
      probeStatus:    s,
      probeLatencyMs: latencyMs !== undefined ? latencyMs : state.probeLatencyMs,
    })),

  addAlert:         (a) => set((s) => ({ alerts:      [a, ...s.alerts].slice(0, 500) })),
  clearAlerts:      ()  => set({ alerts: [] }),
  addScanResult:    (r) => set((s) => ({ scanResults: [r, ...s.scanResults].slice(0, 200) })),
  clearScanResults: ()  => set({ scanResults: [] }),
  addRILEvent:      (e) => set((s) => ({ rilEvents:   [e, ...s.rilEvents].slice(0, 1000) })),
  addPDURecord:     (r) => set((s) => ({ pduLog:      [r, ...s.pduLog].slice(0, 300) })),

  setBridgeSession:     (s) => set({ bridgeSession: s, bridgeError: null }),
  setBridgeError:       (e) => set({ bridgeError: e }),
  updateBridgePCStatus: (connected) =>
    set((state) => ({
      bridgeSession: state.bridgeSession
        ? { ...state.bridgeSession, pcConnected: connected }
        : null,
    })),

  setUploadState: (s) => set({ uploadState: s }),
  setLastBundle:  (b) => set({ lastBundle: b }),
  setUploadError: (e) => set({ uploadError: e }),

  // Safe-clear: ONLY allowed when server confirmed checksum match
  clearLogsAfterConfirm: () => {
    const { uploadState } = get();
    if (uploadState !== 'confirmed') {
      console.warn('[FieldGuard] clearLogsAfterConfirm blocked — not yet confirmed by server');
      return;
    }
    set({
      alerts: [], rilEvents: [], pduLog: [], scanResults: [],
      uploadState: 'idle', lastBundle: null,
    });
  },

  // Cell
  addCellMeasurement: (m) => set((s) => ({ cellMeasurements: [m, ...s.cellMeasurements].slice(0, 2000) })),
  addIMSICatcherEvent:(e) => set((s) => ({ imsiCatcherEvents: [e, ...s.imsiCatcherEvents].slice(0, 500) })),
  clearCellData:      () => set({ cellMeasurements: [], imsiCatcherEvents: [] }),

  // AT
  setATDevices:   (d) => set({ atDevices: d }),
  addATRecord:    (r) => set((s) => ({ atLog: [r, ...s.atLog].slice(0, 500) })),
  setATModemInfo: (i) => set({ atModemInfo: i }),
  clearATLog:     ()  => set({ atLog: [] }),

  // Capability
  setCapabilityResult: (r) => set({ capabilityResult: r }),

  // Subscriber
  setSubscriberInfo: (i) => set({ subscriberInfo: i }),

  // Auth events
  addAuthEvent:   (e) => set((s) => ({ authEvents: [e, ...s.authEvents].slice(0, 200) })),
  clearAuthEvents: ()  => set({ authEvents: [] }),

  setSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  updateSetting: (key, value) =>
    set((s) => {
      const next = { ...s.settings, [key]: value };
      AsyncStorage.setItem('fg_settings', JSON.stringify(next)).catch(() => {});
      return { settings: next };
    }),

  setOnboardingDone: (done) => {
    AsyncStorage.setItem('fg_onboarding_done', done ? '1' : '0').catch(() => {});
    set({ onboardingDone: done });
  },

  setMonitoringCapabilities: (mode, detail) =>
    set({ monitoringMode: mode, monitoringDetail: detail }),

  loadSettingsFromStorage: async () => {
    try {
      const [raw, ob] = await Promise.all([
        AsyncStorage.getItem('fg_settings'),
        AsyncStorage.getItem('fg_onboarding_done'),
      ]);
      const saved = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
      set({
        settings:      { ...DEFAULT_SETTINGS, ...saved },
        onboardingDone: ob === '1',
      });
    } catch {
      // keep defaults
    }
  },
}));
