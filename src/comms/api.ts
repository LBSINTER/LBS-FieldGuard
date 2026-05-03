import axios from 'axios';
import { CommsGroup, CommsDMMessage, CommsMessage, DirectMessage } from './types';

const TIMEOUT = 12_000;

function client(baseUrl: string, token: string) {
  return axios.create({
    baseURL: baseUrl.replace(/\/$/, '') + '/comms',
    timeout: TIMEOUT,
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function authLogin(
  baseUrl: string,
  email: string,
  password: string,
): Promise<{ token: string; userId: string; displayName: string; isLbsMember: boolean; expiresAt: string }> {
  const r = await axios.post(
    baseUrl.replace(/\/$/, '') + '/comms/auth',
    { email, password },
    { timeout: TIMEOUT },
  );
  return r.data;
}

export async function authRegister(
  baseUrl: string,
  email: string,
  password: string,
  displayName: string,
): Promise<{ token: string; userId: string; displayName: string; isLbsMember: boolean; expiresAt: string }> {
  const r = await axios.post(
    baseUrl.replace(/\/$/, '') + '/comms/auth',
    { email, password, displayName, register: true },
    { timeout: TIMEOUT },
  );
  return r.data;
}

export async function publishPublicKey(
  baseUrl: string,
  token: string,
  publicKeyArmored: string,
  fingerprint: string,
): Promise<void> {
  await client(baseUrl, token).post('/keys/publish', { publicKeyArmored, fingerprint });
}

export async function fetchGroups(baseUrl: string, token: string): Promise<CommsGroup[]> {
  const r = await client(baseUrl, token).get('/groups');
  return r.data.groups;
}

export async function createGroup(
  baseUrl: string,
  token: string,
  name: string,
  description: string,
  isPrivate: boolean,
): Promise<{ groupId: string }> {
  const r = await client(baseUrl, token).post('/groups/create', { name, description, isPrivate });
  return r.data;
}

export async function inviteToGroup(
  baseUrl: string,
  token: string,
  groupId: string,
  userId: string,
): Promise<void> {
  await client(baseUrl, token).post(`/groups/${groupId}/invite`, { userId });
}

export async function fetchMessages(
  baseUrl: string,
  token: string,
  groupId: string,
  since?: string,
): Promise<CommsMessage[]> {
  const r = await client(baseUrl, token).get(`/groups/${groupId}/messages`, {
    params: since ? { since } : undefined,
  });
  return r.data.messages;
}

export async function sendMessage(
  baseUrl: string,
  token: string,
  groupId: string,
  ciphertext: string,
): Promise<{ msgId: string; timestamp: string }> {
  const r = await client(baseUrl, token).post(`/groups/${groupId}/messages`, { ciphertext });
  return r.data;
}

export async function fetchMemberKey(
  baseUrl: string,
  token: string,
  userId: string,
): Promise<string | null> {
  try {
    const r = await client(baseUrl, token).get(`/keys/${userId}`);
    return r.data.publicKeyArmored ?? null;
  } catch {
    return null;
  }
}

export async function searchUsers(
  baseUrl: string,
  token: string,
  query: string,
): Promise<Array<{ userId: string; displayName: string; isLbsMember: boolean }>> {
  const r = await client(baseUrl, token).get('/users/search', { params: { q: query } });
  return r.data.users;
}

export async function openDM(
  baseUrl: string,
  token: string,
  peerId: string,
): Promise<{ dmId: string }> {
  const r = await client(baseUrl, token).post('/dms/open', { userId: peerId });
  return r.data;
}

export async function fetchDMs(baseUrl: string, token: string): Promise<DirectMessage[]> {
  const r = await client(baseUrl, token).get('/dms');
  return r.data.dms;
}

export async function fetchDMMessages(
  baseUrl: string,
  token: string,
  dmId: string,
  since?: string,
): Promise<CommsDMMessage[]> {
  const r = await client(baseUrl, token).get(`/dms/${dmId}/messages`, {
    params: since ? { since } : undefined,
  });
  return r.data.messages;
}

export async function sendDMMessage(
  baseUrl: string,
  token: string,
  dmId: string,
  ciphertext: string,
): Promise<{ msgId: string; timestamp: string }> {
  const r = await client(baseUrl, token).post(`/dms/${dmId}/messages`, { ciphertext });
  return r.data;
}
