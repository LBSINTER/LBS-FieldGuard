/**
 * LBS FieldGuard — Secure Comms: Group thread + member list
 *
 * Decrypts messages locally using the stored private key.
 * Verifies signatures against the sender's registered public key.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Icon from '../components/Icon';
import { useCommsStore } from '../../comms/store';
import { fetchMessages, fetchMemberKey, sendMessage } from '../../comms/api';
import { encryptAndSign, decryptAndVerify } from '../../comms/pgp';
import { useAppStore } from '../../store/appStore';
import type { CommsGroup, CommsMessage } from '../../comms/types';

interface Props {
  group: CommsGroup;
  password: string; // passed in-memory from login — never persisted
  onBack: () => void;
}

export default function CommsGroupScreen({ group, password, onBack }: Props) {
  const { session, keyring, messages, upsertMessages, updateMessagePlaintext } = useCommsStore();
  const relayUrl = useAppStore((s) => s.settings.relayUrl);
  const [tab, setTab]         = useState<'thread' | 'members'>('thread');
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const listRef = useRef<FlatList>(null);

  const groupMsgs: CommsMessage[] = messages[group.groupId] ?? [];

  const decryptAll = useCallback(async (msgs: CommsMessage[]) => {
    if (!keyring || !session) return;
    for (const msg of msgs) {
      if (msg.decrypted) continue;
      const sender = group.members.find((m) => m.userId === msg.fromUserId);
      try {
        const senderKey = sender?.publicKey ?? (await fetchMemberKey(relayUrl, session.token, msg.fromUserId));
        const { plaintext, verified } = await decryptAndVerify(
          msg.ciphertext,
          keyring.privateKeyArmored,
          password,
          senderKey,
        );
        updateMessagePlaintext(group.groupId, msg.msgId, plaintext, verified);
      } catch (_) {
        updateMessagePlaintext(group.groupId, msg.msgId, '[decryption failed]', false);
      }
    }
  }, [keyring, session, group, password, relayUrl, updateMessagePlaintext]);

  const sync = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const latest = groupMsgs.at(-1)?.timestamp;
      const fetched = await fetchMessages(relayUrl, session.token, group.groupId, latest);
      if (fetched.length) {
        await upsertMessages(group.groupId, fetched);
        await decryptAll(fetched);
      }
    } catch (_) {} finally {
      setSyncing(false);
    }
  }, [session, group.groupId, groupMsgs, relayUrl, upsertMessages, decryptAll]);

  useEffect(() => {
    sync();
    // Also decrypt any cached-but-not-yet-decrypted messages
    decryptAll(groupMsgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    if (!compose.trim() || !keyring || !session) return;
    setSending(true);
    try {
      const recipientKeys = group.members.map((m) => m.publicKey).filter((k): k is string => !!k);
      if (!recipientKeys.includes(keyring.publicKeyArmored)) {
        recipientKeys.push(keyring.publicKeyArmored); // encrypt to self so we can read our own messages
      }
      const ciphertext = await encryptAndSign(
        compose.trim(),
        recipientKeys,
        keyring.privateKeyArmored,
        password,
      );
      const { msgId, timestamp } = await sendMessage(relayUrl, session.token, group.groupId, ciphertext);
      const newMsg: CommsMessage = {
        msgId,
        groupId: group.groupId,
        fromUserId: session.userId,
        fromDisplayName: session.displayName,
        timestamp,
        ciphertext,
        plaintext: compose.trim(),
        verified: true,
        decrypted: true,
      };
      await upsertMessages(group.groupId, [newMsg]);
      setCompose('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      Alert.alert('Send Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: CommsMessage }) {
    const isMe = item.fromUserId === session?.userId;
    const sender = group.members.find((m) => m.userId === item.fromUserId);
    const displayName = sender?.displayName ?? item.fromDisplayName;
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          {!isMe && <Text style={s.senderName}>{displayName}</Text>}
          {item.decrypted
            ? <Text style={[s.msgText, isMe ? s.msgTextMe : s.msgTextThem]}>{item.plaintext}</Text>
            : <ActivityIndicator size="small" color="#94a3b8" style={{ margin: 4 }} />}
          <View style={s.msgMeta}>
            <Text style={[s.timeText, isMe ? s.timeTextMe : s.timeTextThem]}>{time}</Text>
            {item.decrypted && (
              <Icon
                name={item.verified ? 'shield-check' : 'shield-alert'}
                size={11}
                color={item.verified ? (isMe ? '#93c5fd' : '#16a34a') : '#dc2626'}
              />
            )}
          </View>
        </View>
      </View>
    );
  }

  function renderMember({ item }: { item: typeof group.members[0] }) {
    return (
      <View style={s.memberRow}>
        <View style={s.memberAvatar}>
          <Icon name="account" size={20} color="#2563eb" />
        </View>
        <View style={s.memberBody}>
          <Text style={s.memberName}>{item.displayName}</Text>
          <Text style={s.memberEmail}>{item.email}</Text>
          {item.fingerprint && (
            <Text style={s.fingerprint}>…{item.fingerprint.slice(-16)}</Text>
          )}
        </View>
        <View style={[s.onlineDot, item.online ? s.online : s.offline]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{group.name}</Text>
          <Text style={s.headerSub}>{group.members.length} members · E2EE PGP</Text>
        </View>
        <TouchableOpacity onPress={sync} style={s.syncBtn}>
          {syncing ? <ActivityIndicator size="small" color="#2563eb" /> : <Icon name="refresh" size={20} color="#2563eb" />}
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabs}>
        {(['thread', 'members'] as const).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'thread' ? 'Thread' : `Members (${group.members.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'thread' ? (
        <>
          <FlatList
            ref={listRef}
            data={groupMsgs}
            keyExtractor={(m) => m.msgId}
            renderItem={renderMessage}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.empty}>
                <Icon name="lock-outline" size={36} color="#94a3b8" />
                <Text style={s.emptyText}>No messages yet</Text>
                <Text style={s.emptyHint}>All messages are encrypted end-to-end</Text>
              </View>
            }
          />
          <View style={s.composeBar}>
            <TextInput
              style={s.composeInput}
              placeholder="Type encrypted message…"
              placeholderTextColor="#94a3b8"
              value={compose}
              onChangeText={setCompose}
              multiline
              maxLength={4000}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!compose.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!compose.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={group.members}
          keyExtractor={(m) => m.userId}
          renderItem={renderMember}
          contentContainerStyle={s.memberList}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: '#f8fafc' },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  backBtn:       { padding: 4, marginRight: 8 },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  headerSub:     { fontSize: 11, color: '#64748b' },
  syncBtn:       { padding: 6 },
  tabs:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tab:           { flex: 1, padding: 12, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderColor: '#2563eb' },
  tabText:       { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  msgList:       { padding: 16, paddingBottom: 8, gap: 8 },
  msgRow:        { flexDirection: 'row' },
  msgRowMe:      { justifyContent: 'flex-end' },
  msgRowThem:    { justifyContent: 'flex-start' },
  bubble:        { maxWidth: '78%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleMe:      { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleThem:    { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  senderName:    { fontSize: 11, fontWeight: '600', color: '#2563eb', marginBottom: 3 },
  msgText:       { fontSize: 14, lineHeight: 20 },
  msgTextMe:     { color: '#fff' },
  msgTextThem:   { color: '#0f172a' },
  msgMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  timeText:      { fontSize: 10 },
  timeTextMe:    { color: '#bfdbfe' },
  timeTextThem:  { color: '#94a3b8' },
  composeBar:    { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0' },
  composeInput:  { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', maxHeight: 120, borderWidth: 1, borderColor: '#e2e8f0' },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  memberList:    { padding: 16, gap: 8 },
  memberRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  memberAvatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  memberBody:    { flex: 1 },
  memberName:    { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  memberEmail:   { fontSize: 12, color: '#64748b' },
  fingerprint:   { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  onlineDot:     { width: 10, height: 10, borderRadius: 5 },
  online:        { backgroundColor: '#16a34a' },
  offline:       { backgroundColor: '#94a3b8' },
  empty:         { alignItems: 'center', paddingTop: 60 },
  emptyText:     { fontSize: 15, color: '#94a3b8', marginTop: 12 },
  emptyHint:     { fontSize: 12, color: '#cbd5e1', marginTop: 4 },
});
