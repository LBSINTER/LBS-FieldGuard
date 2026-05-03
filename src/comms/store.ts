import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommsSession, CommsGroup, CommsMessage, LocalKeyring, DirectMessage, CommsDMMessage } from './types';

const KEY_SESSION = '@comms_session';
const KEY_KEYRING = '@comms_keyring';
const KEY_GROUPS  = '@comms_groups';
const KEY_DMS     = '@comms_dms';
const MSG_PREFIX  = '@comms_msgs_';
const DM_PREFIX   = '@comms_dm_';

interface CommsState {
  session:    CommsSession | null;
  keyring:    LocalKeyring | null;
  groups:     CommsGroup[];
  dms:        DirectMessage[];
  messages:   Record<string, CommsMessage[]>;
  dmMessages: Record<string, CommsDMMessage[]>;
  synced:     boolean;
  lastSyncAt: string | null;

  setSession:              (s: CommsSession | null) => Promise<void>;
  setKeyring:              (k: LocalKeyring | null) => Promise<void>;
  setGroups:               (gs: CommsGroup[]) => Promise<void>;
  setDMs:                  (dms: DirectMessage[]) => Promise<void>;
  upsertMessages:          (groupId: string, msgs: CommsMessage[]) => Promise<void>;
  upsertDMMessages:        (dmId: string, msgs: CommsDMMessage[]) => Promise<void>;
  updateMessagePlaintext:  (groupId: string, msgId: string, plaintext: string, verified: boolean) => void;
  updateDMMessagePlaintext:(dmId: string, msgId: string, plaintext: string, verified: boolean) => void;
  setSynced:               (v: boolean) => void;
  logout:                  () => Promise<void>;
  hydrate:                 () => Promise<void>;
}

export const useCommsStore = create<CommsState>((set, get) => ({
  session:    null,
  keyring:    null,
  groups:     [],
  dms:        [],
  messages:   {},
  dmMessages: {},
  synced:     false,
  lastSyncAt: null,

  setSession: async (s) => {
    set({ session: s });
    if (s) await AsyncStorage.setItem(KEY_SESSION, JSON.stringify(s));
    else    await AsyncStorage.removeItem(KEY_SESSION);
  },

  setKeyring: async (k) => {
    set({ keyring: k });
    if (k) await AsyncStorage.setItem(KEY_KEYRING, JSON.stringify(k));
    else   await AsyncStorage.removeItem(KEY_KEYRING);
  },

  setGroups: async (gs) => {
    set({ groups: gs });
    await AsyncStorage.setItem(KEY_GROUPS, JSON.stringify(gs));
  },

  setDMs: async (dms) => {
    set({ dms });
    await AsyncStorage.setItem(KEY_DMS, JSON.stringify(dms));
  },

  upsertMessages: async (groupId, msgs) => {
    const current = get().messages[groupId] ?? [];
    const ids = new Set(current.map((m) => m.msgId));
    const merged = [...current, ...msgs.filter((m) => !ids.has(m.msgId))]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    set((s) => ({ messages: { ...s.messages, [groupId]: merged } }));
    const toStore = merged.map(({ plaintext: _p, verified: _v, decrypted: _d, ...rest }) => rest);
    await AsyncStorage.setItem(MSG_PREFIX + groupId, JSON.stringify(toStore));
  },

  upsertDMMessages: async (dmId, msgs) => {
    const current = get().dmMessages[dmId] ?? [];
    const ids = new Set(current.map((m) => m.msgId));
    const merged = [...current, ...msgs.filter((m) => !ids.has(m.msgId))]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    set((s) => ({ dmMessages: { ...s.dmMessages, [dmId]: merged } }));
    const toStore = merged.map(({ plaintext: _p, verified: _v, decrypted: _d, ...rest }) => rest);
    await AsyncStorage.setItem(DM_PREFIX + dmId, JSON.stringify(toStore));
  },

  updateMessagePlaintext: (groupId, msgId, plaintext, verified) => {
    set((s) => {
      const msgs = (s.messages[groupId] ?? []).map((m) =>
        m.msgId === msgId ? { ...m, plaintext, verified, decrypted: true } : m,
      );
      return { messages: { ...s.messages, [groupId]: msgs } };
    });
  },

  updateDMMessagePlaintext: (dmId, msgId, plaintext, verified) => {
    set((s) => {
      const msgs = (s.dmMessages[dmId] ?? []).map((m) =>
        m.msgId === msgId ? { ...m, plaintext, verified, decrypted: true } : m,
      );
      return { dmMessages: { ...s.dmMessages, [dmId]: msgs } };
    });
  },

  setSynced: (v) => set({ synced: v, lastSyncAt: v ? new Date().toISOString() : get().lastSyncAt }),

  logout: async () => {
    const keys = await AsyncStorage.getAllKeys();
    const commsKeys = keys.filter((k) => k.startsWith('@comms_'));
    if (commsKeys.length) await AsyncStorage.multiRemove(commsKeys);
    set({ session: null, keyring: null, groups: [], dms: [], messages: {}, dmMessages: {}, synced: false, lastSyncAt: null });
  },

  hydrate: async () => {
    const [rawSession, rawKeyring, rawGroups, rawDMs] = await Promise.all([
      AsyncStorage.getItem(KEY_SESSION),
      AsyncStorage.getItem(KEY_KEYRING),
      AsyncStorage.getItem(KEY_GROUPS),
      AsyncStorage.getItem(KEY_DMS),
    ]);

    const session = rawSession ? JSON.parse(rawSession) as CommsSession : null;
    const keyring = rawKeyring ? JSON.parse(rawKeyring) as LocalKeyring  : null;
    const groups  = rawGroups  ? JSON.parse(rawGroups)  as CommsGroup[]  : [];
    const dms     = rawDMs     ? JSON.parse(rawDMs)     as DirectMessage[]: [];

    const allKeys = await AsyncStorage.getAllKeys();
    const messages:   Record<string, CommsMessage[]>    = {};
    const dmMessages: Record<string, CommsDMMessage[]>  = {};

    for (const key of allKeys) {
      if (key.startsWith(MSG_PREFIX)) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) messages[key.slice(MSG_PREFIX.length)] = JSON.parse(raw);
      }
      if (key.startsWith(DM_PREFIX)) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) dmMessages[key.slice(DM_PREFIX.length)] = JSON.parse(raw);
      }
    }

    const validSession = session && new Date(session.expiresAt) > new Date() ? session : null;
    set({ session: validSession, keyring, groups, dms, messages, dmMessages });
  },
}));
