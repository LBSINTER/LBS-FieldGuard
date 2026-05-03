import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal, Switch,
} from 'react-native';
import Icon from '../components/Icon';
import { useCommsStore } from '../../comms/store';
import { fetchGroups, fetchDMs, createGroup, openDM, searchUsers } from '../../comms/api';
import { useAppStore } from '../../store/appStore';
import type { CommsGroup, DirectMessage } from '../../comms/types';

const LBS_DOMAIN = 'lbs-int.com';

interface Props {
  onOpenGroup: (group: CommsGroup) => void;
  onOpenDM:    (dm: DirectMessage) => void;
}

export default function CommsScreen({ onOpenGroup, onOpenDM }: Props) {
  const { session, groups, dms, keyring, setGroups, setDMs, setSynced, synced } = useCommsStore();
  const relayUrl = useAppStore((s) => s.settings.relayUrl);

  const [tab, setTab]               = useState<'groups' | 'messages'>('groups');
  const [loading, setLoading]       = useState(false);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [newPrivate, setNewPrivate] = useState(false);
  const [creating, setCreating]     = useState(false);

  // New DM / search modal
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery]           = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ userId: string; displayName: string; isLbsMember: boolean }>>([]);
  const [searching, setSearching]   = useState(false);

  const sync = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [gs, ds] = await Promise.all([
        fetchGroups(relayUrl, session.token),
        fetchDMs(relayUrl, session.token),
      ]);
      await setGroups(gs);
      await setDMs(ds);
      setSynced(true);
    } catch {
      setSynced(false);
    } finally {
      setLoading(false);
    }
  }, [session, relayUrl, setGroups, setDMs, setSynced]);

  useEffect(() => { sync(); }, [sync]);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await searchUsers(relayUrl, session!.token, q);
      setSearchResults(results.filter((u) => u.userId !== session?.userId));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  async function handleOpenDM(peerId: string) {
    setShowSearch(false);
    setQuery('');
    setSearchResults([]);
    try {
      const { dmId } = await openDM(relayUrl, session!.token, peerId);
      const peer = searchResults.find((u) => u.userId === peerId)!;
      const dm: DirectMessage = { dmId, peer, unreadCount: 0 };
      onOpenDM(dm);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not open conversation.');
    }
  }

  async function handleCreateGroup() {
    if (!newName.trim()) { Alert.alert('Required', 'Group name is required.'); return; }
    setCreating(true);
    try {
      await createGroup(relayUrl, session!.token, newName.trim(), newDesc.trim(), newPrivate);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewPrivate(false);
      await sync();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create group.');
    } finally {
      setCreating(false);
    }
  }

  function renderGroup({ item }: { item: CommsGroup }) {
    const isLbs = item.groupType === 'lbs-internal';
    return (
      <TouchableOpacity style={s.card} onPress={() => onOpenGroup(item)} activeOpacity={0.7}>
        <View style={[s.cardIcon, isLbs && s.cardIconLbs]}>
          <Icon name={isLbs ? 'shield-lock' : 'account-group'} size={22} color={isLbs ? '#2563eb' : '#0891b2'} />
        </View>
        <View style={s.cardBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.cardName}>{item.name}</Text>
            {isLbs && (
              <View style={s.lbsBadge}>
                <Text style={s.lbsBadgeText}>LBS</Text>
              </View>
            )}
            {item.groupType === 'private' && (
              <Icon name="lock" size={12} color="#94a3b8" />
            )}
          </View>
          <Text style={s.cardDesc} numberOfLines={1}>{item.description || `${item.members.length} member${item.members.length !== 1 ? 's' : ''}`}</Text>
        </View>
        <View style={s.cardRight}>
          {item.unreadCount > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>{item.unreadCount}</Text></View>
          )}
          <Icon name="chevron-right" size={18} color="#94a3b8" />
        </View>
      </TouchableOpacity>
    );
  }

  function renderDM({ item }: { item: DirectMessage }) {
    const initials = item.peer.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    return (
      <TouchableOpacity style={s.card} onPress={() => onOpenDM(item)} activeOpacity={0.7}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={s.cardBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.cardName}>{item.peer.displayName}</Text>
            {item.peer.isLbsMember && (
              <View style={s.lbsBadge}><Text style={s.lbsBadgeText}>LBS</Text></View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="lock" size={11} color="#94a3b8" />
            <Text style={s.cardDesc}>End-to-end encrypted</Text>
          </View>
        </View>
        <View style={s.cardRight}>
          {item.unreadCount > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>{item.unreadCount}</Text></View>
          )}
          <Icon name="chevron-right" size={18} color="#94a3b8" />
        </View>
      </TouchableOpacity>
    );
  }

  const isLbs = session?.email?.endsWith('@' + LBS_DOMAIN);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.title}>Secure Comms</Text>
            {isLbs && <View style={s.lbsBadge}><Text style={s.lbsBadgeText}>LBS</Text></View>}
          </View>
          <Text style={s.subtitle}>{session?.displayName}</Text>
        </View>
        <View style={s.headerRight}>
          {keyring && (
            <View style={s.keyChip}>
              <Icon name="key-variant" size={12} color="#2563eb" />
              <Text style={s.keyChipText}>…{keyring.fingerprint.slice(-8)}</Text>
            </View>
          )}
          {synced
            ? <Icon name="cloud-check" size={18} color="#16a34a" />
            : <Icon name="cloud-off-outline" size={18} color="#dc2626" />}
        </View>
      </View>

      {/* Tab pills */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabPill, tab === 'groups' && s.tabPillActive]} onPress={() => setTab('groups')}>
          <Icon name="account-group" size={15} color={tab === 'groups' ? '#2563eb' : '#94a3b8'} />
          <Text style={[s.tabPillText, tab === 'groups' && s.tabPillTextActive]}>Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabPill, tab === 'messages' && s.tabPillActive]} onPress={() => setTab('messages')}>
          <Icon name="message-outline" size={15} color={tab === 'messages' ? '#2563eb' : '#94a3b8'} />
          <Text style={[s.tabPillText, tab === 'messages' && s.tabPillTextActive]}>Messages</Text>
          {dms.some((d) => d.unreadCount > 0) && <View style={s.tabDot} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tabAction}
          onPress={() => tab === 'groups' ? setShowCreate(true) : setShowSearch(true)}
        >
          <Icon name="plus" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {tab === 'groups' ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.groupId}
          renderItem={renderGroup}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={sync} tintColor="#2563eb" />}
          ListEmptyComponent={
            loading
              ? <ActivityIndicator style={{ marginTop: 48 }} color="#2563eb" />
              : (
                <View style={s.empty}>
                  <Icon name="forum-outline" size={40} color="#94a3b8" />
                  <Text style={s.emptyText}>No groups yet</Text>
                  <Text style={s.emptyHint}>Tap + to create one</Text>
                </View>
              )
          }
        />
      ) : (
        <FlatList
          data={dms}
          keyExtractor={(d) => d.dmId}
          renderItem={renderDM}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={sync} tintColor="#2563eb" />}
          ListEmptyComponent={
            loading
              ? <ActivityIndicator style={{ marginTop: 48 }} color="#2563eb" />
              : (
                <View style={s.empty}>
                  <Icon name="message-plus-outline" size={40} color="#94a3b8" />
                  <Text style={s.emptyText}>No conversations yet</Text>
                  <Text style={s.emptyHint}>Tap + to find someone</Text>
                </View>
              )
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Group</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Icon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={s.label}>Group Name</Text>
            <TextInput style={s.input} placeholder="e.g. Project Alpha" placeholderTextColor="#94a3b8" value={newName} onChangeText={setNewName} />
            <Text style={s.label}>Description (optional)</Text>
            <TextInput style={s.input} placeholder="What's this group for?" placeholderTextColor="#94a3b8" value={newDesc} onChangeText={setNewDesc} />
            <View style={s.switchRow}>
              <View>
                <Text style={s.switchLabel}>Private group</Text>
                <Text style={s.switchHint}>Invite-only — not discoverable</Text>
              </View>
              <Switch value={newPrivate} onValueChange={setNewPrivate} trackColor={{ true: '#2563eb' }} />
            </View>
            <TouchableOpacity style={[s.btn, creating && s.btnDisabled]} onPress={handleCreateGroup} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Group</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New DM / Search Modal */}
      <Modal visible={showSearch} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Message</Text>
              <TouchableOpacity onPress={() => { setShowSearch(false); setQuery(''); setSearchResults([]); }}>
                <Icon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={s.searchBox}>
              <Icon name="magnify" size={18} color="#94a3b8" />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name…"
                placeholderTextColor="#94a3b8"
                autoFocus
                value={query}
                onChangeText={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching && <ActivityIndicator size="small" color="#2563eb" />}
            </View>
            <Text style={s.searchHint}>Search is by display name only — email addresses are never shared.</Text>
            {searchResults.map((u) => (
              <TouchableOpacity key={u.userId} style={s.searchResult} onPress={() => handleOpenDM(u.userId)}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarText}>{u.displayName.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={s.searchResultName}>{u.displayName}</Text>
                {u.isLbsMember && <View style={s.lbsBadge}><Text style={s.lbsBadgeText}>LBS</Text></View>}
                <Icon name="chevron-right" size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ))}
            {query.length >= 2 && !searching && searchResults.length === 0 && (
              <Text style={s.noResults}>No users found</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f8fafc' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:           { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  subtitle:        { fontSize: 12, color: '#64748b', marginTop: 2 },
  lbsBadge:        { backgroundColor: '#2563eb', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  lbsBadgeText:    { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  keyChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: '#bfdbfe' },
  keyChipText:     { fontSize: 10, color: '#1d4ed8', fontFamily: 'monospace' },
  tabRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabPill:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabPillActive:   { backgroundColor: '#eff6ff' },
  tabPillText:     { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  tabPillTextActive:{ color: '#2563eb', fontWeight: '600' },
  tabDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb', marginLeft: 2 },
  tabAction:       { marginLeft: 'auto', padding: 6 },
  list:            { padding: 14, gap: 10 },
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  cardIcon:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center' },
  cardIconLbs:     { backgroundColor: '#eff6ff' },
  cardBody:        { flex: 1 },
  cardName:        { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  cardDesc:        { fontSize: 12, color: '#64748b' },
  cardRight:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge:           { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  badgeText:       { color: '#fff', fontSize: 11, fontWeight: '700' },
  avatarCircle:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarText:      { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  empty:           { alignItems: 'center', paddingTop: 80 },
  emptyText:       { fontSize: 16, color: '#94a3b8', marginTop: 12 },
  emptyHint:       { fontSize: 13, color: '#cbd5e1', marginTop: 4 },
  // Modals
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:      { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  label:           { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input:           { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  switchRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingVertical: 4 },
  switchLabel:     { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  switchHint:      { fontSize: 12, color: '#64748b', marginTop: 2 },
  btn:             { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled:     { opacity: 0.6 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 15 },
  searchBox:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  searchInput:     { flex: 1, fontSize: 15, color: '#0f172a' },
  searchHint:      { fontSize: 11, color: '#94a3b8', marginBottom: 12 },
  searchResult:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  searchResultName:{ fontSize: 15, color: '#0f172a', fontWeight: '500', flex: 1 },
  noResults:       { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontSize: 14 },
});
