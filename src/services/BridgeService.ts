/**
 * LBS FieldGuard — PC Bridge Service
 *
 * Handles the PIN-based relay session between the Android app and the
 * fieldguard.lbs-int.com relay server.
 *
 * Flow:
 *   1. createSession()  — POST to server → receive PIN + token
 *   2. Show PIN to user → PC operator opens viewer.html#pin on the same origin as api.php
 *   3. Push events to relay at regular intervals
 *   4. Poll session_status to update pcConnected flag
 *   5. On demand: upload log bundle via LogUploader
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/appStore';
import { BridgeSession } from '../types';
import { RELAY_BASE_URL } from '../config/build';

const PUSH_INTERVAL_MS   = 5_000;   // push accumulated events every 5s
const STATUS_POLL_MS     = 10_000;  // check if PC has joined every 10s
const KEY_SESSION        = 'fg_bridge_session';
const KEY_DEVICE_ID      = 'fg_device_id';

// Pending events waiting to be pushed
let _pendingEvents: object[] = [];
let _pushTimer: ReturnType<typeof setInterval> | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _relayUrl = RELAY_BASE_URL;

// ── Load relay URL from settings (overridden in Settings screen) ──────────────
async function _getRelayUrl(): Promise<string> {
  const saved = await AsyncStorage.getItem('fg_relay_url');
  return saved ?? RELAY_BASE_URL;
}

// ── Create a new relay session — returns PIN ─────────────────────────────────
export async function createBridgeSession(): Promise<BridgeSession> {
  const { setBridgeSession, setBridgeError } = useAppStore.getState();
  _relayUrl = await _getRelayUrl();
  const deviceId = (await AsyncStorage.getItem(KEY_DEVICE_ID)) ?? 'unknown';

  const res = await _api('session_create', 'POST', { device_id: deviceId });
  if (!res.ok) throw new Error(res.error ?? 'session_create failed');

  const session: BridgeSession = {
    pin:         res.pin,
    token:       res.token,
    expiresAt:   res.expires_at,
    pcConnected: false,
    sessionId:   res.session_id ?? '',
    publicShare: false,
  };

  await AsyncStorage.setItem(KEY_SESSION, JSON.stringify(session));
  setBridgeSession(session);
  setBridgeError(null);
  _startPush(session.token);
  _startStatusPoll(session.token);
  return session;
}

// ── End the bridge session ────────────────────────────────────────────────────
export async function endBridgeSession(): Promise<void> {
  _stopTimers();
  await AsyncStorage.removeItem(KEY_SESSION);
  useAppStore.getState().setBridgeSession(null);
  _pendingEvents = [];
}

// ── Restore a saved session on app restart ────────────────────────────────────
export async function restoreBridgeSession(): Promise<BridgeSession | null> {
  const raw = await AsyncStorage.getItem(KEY_SESSION);
  if (!raw) return null;
  try {
    const session: BridgeSession = JSON.parse(raw);
    if (new Date(session.expiresAt) < new Date()) {
      await AsyncStorage.removeItem(KEY_SESSION);
      return null;
    }
    _relayUrl = await _getRelayUrl();
    useAppStore.getState().setBridgeSession(session);
    _startPush(session.token);
    _startStatusPoll(session.token);
    return session;
  } catch (_) { return null; }
}

// ── Enqueue an event for relay to PC viewer ───────────────────────────────────
export function enqueueEvent(event: object) {
  _pendingEvents.push(event);
  // Keep memory bounded (1000 events max in queue)
  if (_pendingEvents.length > 1000) _pendingEvents = _pendingEvents.slice(-1000);
}

// ── Background push loop ──────────────────────────────────────────────────────
function _startPush(token: string) {
  if (_pushTimer) return;
  _pushTimer = setInterval(async () => {
    if (_pendingEvents.length === 0) return;
    const batch = _pendingEvents.splice(0, 100);
    try {
      await _api('push_events', 'POST', { events: batch }, token);
    } catch (_) {
      // Re-queue on failure
      _pendingEvents = batch.concat(_pendingEvents);
    }
  }, PUSH_INTERVAL_MS);
}

// ── Session status poll ───────────────────────────────────────────────────────
function _startStatusPoll(token: string) {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    try {
      const res = await _api('session_status', 'GET', null, token);
      if (res.ok) {
        useAppStore.getState().updateBridgePCStatus(!!res.pc_connected);
      }
    } catch (_) {}
  }, STATUS_POLL_MS);
}

function _stopTimers() {
  if (_pushTimer) { clearInterval(_pushTimer); _pushTimer = null; }
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function _api(
  action: string,
  method: 'GET' | 'POST',
  body: object | null,
  token?: string,
): Promise<any> {
  const url = `${_relayUrl}?action=${action}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-FG-Token'] = token;
  const opts: RequestInit = { method, headers };
  if (method === 'POST' && body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}
