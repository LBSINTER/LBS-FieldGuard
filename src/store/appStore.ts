/**
 * LBS FieldGuard — Global App Store (Zustand)
 *
 * Holds runtime state: connection status, active threats, scan results,
 * PDU log, RIL event queue, station probe status.
 */

import { create } from 'zustand';
import { Alert, ScanResult, RILEvent, PDURecord, ProbeStatus } from '../types';

interface AppState {
  /* Initialisation */
  signaturesLoaded: number;         // count of loaded byte-pattern signatures
  probeConnected: boolean;

  /* Threat feed */
  alerts: Alert[];
  scanResults: ScanResult[];

  /* RIL monitor */
  rilEvents: RILEvent[];

  /* PDU log */
  pduLog: PDURecord[];

  /* Probe */
  probeStatus: ProbeStatus;
  probeLatencyMs: number;

  /* Actions */
  setSignaturesLoaded: (n: number) => void;
  setProbeConnected: (v: boolean) => void;
  addAlert: (a: Alert) => void;
  clearAlerts: () => void;
  addScanResult: (r: ScanResult) => void;
  clearScanResults: () => void;
  addRILEvent: (e: RILEvent) => void;
  addPDURecord: (r: PDURecord) => void;
  setProbeStatus: (s: ProbeStatus, latencyMs?: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  signaturesLoaded: 0,
  probeConnected: false,
  alerts: [],
  scanResults: [],
  rilEvents: [],
  pduLog: [],
  probeStatus: 'disconnected',
  probeLatencyMs: -1,

  setSignaturesLoaded: (n) => set({ signaturesLoaded: n }),
  setProbeConnected: (v) => set({ probeConnected: v }),

  addAlert: (a) =>
    set((s) => ({ alerts: [a, ...s.alerts].slice(0, 500) })),
  clearAlerts: () => set({ alerts: [] }),

  addScanResult: (r) =>
    set((s) => ({ scanResults: [r, ...s.scanResults].slice(0, 200) })),
  clearScanResults: () => set({ scanResults: [] }),

  addRILEvent: (e) =>
    set((s) => ({ rilEvents: [e, ...s.rilEvents].slice(0, 1000) })),

  addPDURecord: (r) =>
    set((s) => ({ pduLog: [r, ...s.pduLog].slice(0, 300) })),

  setProbeStatus: (s, latencyMs) =>
    set((state) => ({
      probeStatus: s,
      probeLatencyMs: latencyMs !== undefined ? latencyMs : state.probeLatencyMs,
    })),
}));
