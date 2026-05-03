export interface CommsSession {
  token: string;
  userId: string;
  email: string;
  displayName: string;
  isLbsMember: boolean;
  expiresAt: string;
}

export interface CommsUser {
  userId: string;
  displayName: string;
  isLbsMember: boolean;
}

export interface CommsMember {
  userId: string;
  email?: string;
  displayName: string;
  publicKey?: string;
  fingerprint: string;
  isLbsMember: boolean;
  online: boolean;
}

export interface CommsGroup {
  groupId: string;
  name: string;
  description: string;
  groupType: 'lbs-internal' | 'public' | 'private';
  createdBy?: string;
  members: CommsMember[];
  unreadCount: number;
}

export interface CommsMessage {
  msgId: string;
  groupId: string;
  fromUserId: string;
  fromDisplayName: string;
  timestamp: string;
  ciphertext: string;
  plaintext?: string;
  verified?: boolean;
  decrypted?: boolean;
}

export interface DirectMessage {
  dmId: string;
  peer: CommsUser;
  unreadCount: number;
  lastTimestamp?: string;
}

export interface CommsDMMessage {
  msgId: string;
  dmId: string;
  fromUserId: string;
  timestamp: string;
  ciphertext: string;
  plaintext?: string;
  verified?: boolean;
  decrypted?: boolean;
}

export interface LocalKeyring {
  email: string;
  privateKeyArmored: string;
  publicKeyArmored: string;
  fingerprint: string;
  createdAt: string;
}
