import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Icon from '../components/Icon';
import { useCommsStore } from '../../comms/store';
import { fetchDMMessages, sendDMMessage, fetchMemberKey } from '../../comms/api';
import { encryptAndSign, decryptAndVerify } from '../../comms/pgp';
import { useAppStore } from '../../store/appStore';
import type { DirectMessage, CommsDMMessage } from '../../comms/types';

interface Props {
  dm:       DirectMessage;
  password: string;
  onBack:   () => void;
}

export default function CommsDMScreen({ dm, password, onBack }: Props) {
  const { session, keyring, dmMessages, upsertDMMessages, updateDMMessagePlaintext } = useCommsStore();
  const relayUrl  = useAppStore((s) => s.settings.relayUrl);
  const [compose, setCompose]   = useState('');
  const [sending, setSending]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [peerKey, setPeerKey]   = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const msgs: CommsDMMessage[] = dmMessages[dm.dmId] ?? [];

  useEffect(() => {
    if (session) {
      fetchMemberKey(relayUrl, session.token, dm.peer.userId).then(setPeerKey);
    }
  }, [session, relayUrl, dm.peer.userId]);

  const decryptAll = useCallback(async (list: CommsDMMessage[]) => {
    if (!keyring || !session || !peerKey) return;
    for (const msg of list) {
      if (msg.decrypted) continue;
      const senderKey = msg.fromUserId === session.userId ? keyring.publicKeyArmored : peerKey;
      try {
        const { plaintext, verified } = await decryptAndVerify(
          msg.ciphertext,
          keyring.privateKeyArmored,
          password,
          senderKey,
        );
        updateDMMessagePlaintext(dm.dmId, msg.msgId, plaintext, verified);
      } catch {
        updateDMMessagePlaintext(dm.dmId, msg.msgId, '[decryption failed]', false);
      }
    }
  }, [keyring, session, peerKey, password, dm.dmId, updateDMMessagePlaintext]);

  const sync = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const latest  = msgs.at(-1)?.timestamp;
      const fetched = await fetchDMMessages(relayUrl, session.token, dm.dmId, latest);
      if (fetched.length) {
        await upsertDMMessages(dm.dmId, fetched);
        await decryptAll(fetched);
      }
    } catch {} finally { setSyncing(false); }
  }, [session, dm.dmId, msgs, relayUrl, upsertDMMessages, decryptAll]);

  useEffect(() => {
    sync();
    decryptAll(msgs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerKey]);

  async function handleSend() {
    if (!compose.trim() || !keyring || !session || !peerKey) return;
    setSending(true);
    try {
      // Encrypt to both parties so each can decrypt
      const ciphertext = await encryptAndSign(
        compose.trim(),
        [peerKey, keyring.publicKeyArmored],
        keyring.privateKeyArmored,
        password,
      );
      const { msgId, timestamp } = await sendDMMessage(relayUrl, session.token, dm.dmId, ciphertext);
      const newMsg: CommsDMMessage = {
        msgId,
        dmId: dm.dmId,
        fromUserId: session.userId,
        timestamp,
        ciphertext,
        plaintext:  compose.trim(),
        verified:   true,
        decrypted:  true,
      };
      await upsertDMMessages(dm.dmId, [newMsg]);
      setCompose('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      Alert.alert('Send Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: CommsDMMessage }) {
    const isMe = item.fromUserId === session?.userId;
    const time  = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          {item.decrypted
            ? <Text style={[s.msgText, isMe ? s.msgTextMe : s.msgTextThem]}>{item.plaintext}</Text>
            : <ActivityIndicator size="small" color="#94a3b8" style={{ margin: 4 }} />}
          <View style={s.msgMeta}>
            <Text style={[s.timeText, isMe ? s.timeMe : s.timeThem]}>{time}</Text>
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

  const noPeerKey = !peerKey;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={s.avatarCircle}>
          <Text style={s.avatarText}>{dm.peer.displayName.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={s.headerCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.headerTitle}>{dm.peer.displayName}</Text>
            {dm.peer.isLbsMember && (
              <View style={s.lbsBadge}><Text style={s.lbsBadgeText}>LBS</Text></View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={peerKey ? 'lock' : 'lock-open-variant'} size={11} color={peerKey ? '#16a34a' : '#f59e0b'} />
            <Text style={[s.headerSub, { color: peerKey ? '#16a34a' : '#f59e0b' }]}>
              {peerKey ? 'PGP key verified · E2EE' : 'Waiting for peer key…'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={sync} style={s.syncBtn}>
          {syncing ? <ActivityIndicator size="small" color="#2563eb" /> : <Icon name="refresh" size={20} color="#2563eb" />}
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.msgId}
        renderItem={renderMessage}
        contentContainerStyle={s.msgList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={s.empty}>
            <Icon name="lock-outline" size={36} color="#94a3b8" />
            <Text style={s.emptyText}>No messages yet</Text>
            <Text style={s.emptyHint}>Messages are end-to-end encrypted</Text>
          </View>
        }
      />

      <View style={s.composeBar}>
        {noPeerKey && (
          <Text style={s.noKeyWarn}>Peer hasn't set up encryption yet — waiting for their key.</Text>
        )}
        <View style={s.composeRow}>
          <TextInput
            style={s.composeInput}
            placeholder={noPeerKey ? 'Waiting for peer key…' : 'Encrypted message…'}
            placeholderTextColor="#94a3b8"
            value={compose}
            onChangeText={setCompose}
            multiline
            maxLength={4000}
            editable={!noPeerKey}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!compose.trim() || sending || noPeerKey) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!compose.trim() || sending || noPeerKey}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Icon name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: '#f8fafc' },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 10 },
  backBtn:       { padding: 4 },
  avatarCircle:  { width: 38, height: 38, borderRadius: 19, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarText:    { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  headerSub:     { fontSize: 11 },
  lbsBadge:      { backgroundColor: '#2563eb', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  lbsBadgeText:  { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  syncBtn:       { padding: 6 },
  msgList:       { padding: 16, paddingBottom: 8, gap: 8 },
  msgRow:        { flexDirection: 'row' },
  msgRowMe:      { justifyContent: 'flex-end' },
  msgRowThem:    { justifyContent: 'flex-start' },
  bubble:        { maxWidth: '78%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleMe:      { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleThem:    { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  msgText:       { fontSize: 14, lineHeight: 20 },
  msgTextMe:     { color: '#fff' },
  msgTextThem:   { color: '#0f172a' },
  msgMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  timeText:      { fontSize: 10 },
  timeMe:        { color: '#bfdbfe' },
  timeThem:      { color: '#94a3b8' },
  composeBar:    { backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  noKeyWarn:     { fontSize: 11, color: '#f59e0b', textAlign: 'center', marginBottom: 6 },
  composeRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composeInput:  { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', maxHeight: 120, borderWidth: 1, borderColor: '#e2e8f0' },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:{ opacity: 0.4 },
  empty:         { alignItems: 'center', paddingTop: 60 },
  emptyText:     { fontSize: 15, color: '#94a3b8', marginTop: 12 },
  emptyHint:     { fontSize: 12, color: '#cbd5e1', marginTop: 4 },
});
