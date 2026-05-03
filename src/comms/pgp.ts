/**
 * LBS FieldGuard — Secure Comms: PGP operations
 *
 * All crypto runs locally. Private keys never leave the device.
 * Uses Ed25519 signing + X25519 ECDH encryption (OpenPGP RFC 4880bis).
 */

import * as openpgp from 'openpgp';
import { LocalKeyring } from './types';

export async function generateKeypair(email: string, passphrase: string): Promise<LocalKeyring> {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'ed25519',
    userIDs: [{ email }],
    passphrase,
    format: 'armored',
  });

  const parsed = await openpgp.readKey({ armoredKey: publicKey });
  const fingerprint = parsed.getFingerprint().toUpperCase();

  return {
    email,
    privateKeyArmored: privateKey,
    publicKeyArmored: publicKey,
    fingerprint,
    createdAt: new Date().toISOString(),
  };
}

export async function encryptAndSign(
  plaintext: string,
  recipientPublicKeys: string[],
  senderPrivateKeyArmored: string,
  passphrase: string,
): Promise<string> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: senderPrivateKeyArmored }),
    passphrase,
  });

  const publicKeys = await Promise.all(
    recipientPublicKeys.map((a) => openpgp.readKey({ armoredKey: a })),
  );

  const message = await openpgp.createMessage({ text: plaintext });

  return openpgp.encrypt({
    message,
    encryptionKeys: publicKeys,
    signingKeys: privateKey,
    format: 'armored',
  }) as Promise<string>;
}

export interface DecryptResult {
  plaintext: string;
  verified: boolean;
  signerFingerprint: string | null;
}

export async function decryptAndVerify(
  ciphertext: string,
  recipientPrivateKeyArmored: string,
  passphrase: string,
  senderPublicKeyArmored: string | null,
): Promise<DecryptResult> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: recipientPrivateKeyArmored }),
    passphrase,
  });

  const message = await openpgp.readMessage({ armoredMessage: ciphertext });

  const verificationKeys = senderPublicKeyArmored
    ? [await openpgp.readKey({ armoredKey: senderPublicKeyArmored })]
    : [];

  const { data, signatures } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
    verificationKeys,
  });

  let verified = false;
  let signerFingerprint: string | null = null;
  if (signatures.length > 0) {
    try {
      await signatures[0].verified;
      verified = true;
      const keyId = signatures[0].keyID.toHex().toUpperCase();
      signerFingerprint = keyId;
    } catch (_) {
      verified = false;
    }
  }

  return { plaintext: String(data), verified, signerFingerprint };
}

export async function getPublicKeyFingerprint(armoredKey: string): Promise<string> {
  const key = await openpgp.readKey({ armoredKey });
  return key.getFingerprint().toUpperCase();
}
