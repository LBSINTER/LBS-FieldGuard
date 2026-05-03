import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Icon from '../components/Icon';
import { useCommsStore } from '../../comms/store';
import { authLogin, authRegister, publishPublicKey } from '../../comms/api';
import { generateKeypair } from '../../comms/pgp';
import { useAppStore } from '../../store/appStore';

const LBS_DOMAIN = 'lbs-int.com';

export default function CommsAuthScreen({ onSuccess }: { onSuccess: (password: string) => void }) {
  const [mode, setMode]           = useState<'login' | 'register'>('login');
  const [email, setEmail]         = useState('');
  const [displayName, setDisplay] = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);

  const { setSession, setKeyring, keyring } = useCommsStore();
  const relayUrl = useAppStore((s) => s.settings.relayUrl);

  async function handleSubmit() {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail.includes('@') || !trimEmail.includes('.')) {
      Alert.alert('Invalid', 'Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Invalid', 'Password must be at least 8 characters.');
      return;
    }
    if (mode === 'register') {
      if (!displayName.trim()) {
        Alert.alert('Invalid', 'Display name is required.');
        return;
      }
      if (password !== confirm) {
        Alert.alert('Invalid', 'Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      let result;
      if (mode === 'register') {
        result = await authRegister(relayUrl, trimEmail, password, displayName.trim());
      } else {
        result = await authLogin(relayUrl, trimEmail, password);
      }

      await setSession({
        token:        result.token,
        userId:       result.userId,
        email:        trimEmail,
        displayName:  result.displayName,
        isLbsMember:  result.isLbsMember,
        expiresAt:    result.expiresAt,
      });

      let ring = keyring;
      if (!ring || ring.email !== trimEmail) {
        ring = await generateKeypair(trimEmail, password);
        await setKeyring(ring);
        await publishPublicKey(relayUrl, result.token, ring.publicKeyArmored, ring.fingerprint);
      }

      onSuccess(password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('401') || msg.includes('403')) {
        Alert.alert('Failed', mode === 'login' ? 'Incorrect email or password.' : 'Registration not permitted.');
      } else if (msg.includes('Network') || msg.includes('ECONNREFUSED')) {
        Alert.alert('Offline', 'Cannot reach server. Check your connection.');
      } else if (msg.includes('409')) {
        Alert.alert('Account exists', 'An account with that email already exists. Sign in instead.');
        setMode('login');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        <View style={s.iconRow}>
          <Icon name="shield-lock" size={48} color="#2563eb" />
        </View>
        <Text style={s.title}>Secure Comms</Text>
        <Text style={s.subtitle}>End-to-end PGP encrypted messaging</Text>

        {/* Mode switcher */}
        <View style={s.modePills}>
          <TouchableOpacity
            style={[s.pill, mode === 'login' && s.pillActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[s.pillText, mode === 'login' && s.pillTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.pill, mode === 'register' && s.pillActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[s.pillText, mode === 'register' && s.pillTextActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {mode === 'register' && (
            <>
              <Text style={s.label}>Display Name</Text>
              <TextInput
                style={s.input}
                placeholder="Your name"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                value={displayName}
                onChangeText={setDisplay}
              />
            </>
          )}

          <Text style={s.label}>Password</Text>
          <View style={s.passRow}>
            <TextInput
              style={[s.input, s.flex]}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
              returnKeyType={mode === 'login' ? 'go' : 'next'}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Icon name={showPass ? 'eye-off' : 'eye'} size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {mode === 'register' && (
            <>
              <Text style={s.label}>Confirm Password</Text>
              <TextInput
                style={s.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPass}
                value={confirm}
                onChangeText={setConfirm}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
            </>
          )}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>}
          </TouchableOpacity>
        </View>

        {/* LBS team note */}
        <View style={s.lbsNote}>
          <Icon name="shield-star" size={14} color="#2563eb" />
          <Text style={s.lbsText}>
            <Text style={{ fontWeight: '600' }}>@{LBS_DOMAIN}</Text> team members receive a verified badge
            and access to internal LBS channels.
          </Text>
        </View>

        <View style={s.infoRow}>
          <Icon name="lock" size={14} color="#64748b" />
          <Text style={s.infoText}>
            Your private key is generated locally and never transmitted.
            All messages are encrypted before leaving this device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: '#f8fafc' },
  container:     { padding: 24, flexGrow: 1, justifyContent: 'center' },
  iconRow:       { alignItems: 'center', marginBottom: 16 },
  title:         { fontSize: 24, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  subtitle:      { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  modePills:     { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4, marginBottom: 20 },
  pill:          { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  pillActive:    { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  pillText:      { fontSize: 14, color: '#64748b', fontWeight: '500' },
  pillTextActive:{ color: '#0f172a', fontWeight: '600' },
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  label:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input:         { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  passRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:        { padding: 8 },
  btn:           { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
  lbsNote:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 20, padding: 12, backgroundColor: '#eff6ff', borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  lbsText:       { flex: 1, fontSize: 12, color: '#1d4ed8', lineHeight: 18 },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  infoText:      { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18 },
});
