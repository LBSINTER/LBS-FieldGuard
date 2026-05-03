/**
 * LBS FieldGuard — Onboarding / First-Launch Consent Screen
 * Light theme matching lbs-int.com.
 */

import React, { useRef, useState } from 'react';
import { PC_BRIDGE_VIEWER_URL } from '../../config/build';
import {
  Animated, Dimensions, FlatList, Pressable, StyleSheet, Switch, Text, View, ViewToken,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../store/appStore';
import { Severity } from '../../types';

const { width: SCREEN_W } = Dimensions.get('window');

const SEVERITY_OPTIONS: { label: string; value: Severity }[] = [
  { label: 'CRITICAL only',    value: 'critical' },
  { label: 'HIGH + CRITICAL',  value: 'high' },
  { label: 'MEDIUM and above', value: 'medium' },
];

function StepWelcome() {
  const DETECT_LIST = [
    'Type-0 silent SMS (PID 0x40) \u2014 subscriber presence probing',
    'SIM OTA commands (UDH IEI 0x70/0x71) \u2014 silent SIM firmware operations',
    'STK proactive commands (tag D0) \u2014 SIM-initiated calls, SMSes, USSD',
    'WAP Push (OMA-CP/OMA-DM) \u2014 device configuration injection',
    'SS7 MAP SRI-SM/ATI/ISD \u2014 IMSI harvest and location tracking',
    'Pegasus/NSO indicators (CitizenLab/Amnesty 2021 IOCs)',
    'Flash SMS (DCS class 0) \u2014 can be used for social engineering',
    'Rogue BTS / IMSI catcher indicators',
    'SIGTRAN M2PA/SCCP/TCAP anomalies',
  ];

  return (
    <View style={s.stepContainer}>
      <Text style={s.logoText}>FieldGuard</Text>
      <Text style={s.stepTitle}>What does FieldGuard detect?</Text>
      <Text style={s.stepSubtitle}>
        FieldGuard monitors SMS PDUs, RIL events, and raw network packets in real time.
        It matches them against a signature database of documented attack techniques.
      </Text>
      <View style={s.listBox}>
        {DETECT_LIST.map((item) => (
          <View style={s.listRow} key={item}>
            <Text style={s.bullet}>\u203A</Text>
            <Text style={s.listItem}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={s.footnote}>
        FieldGuard does not make calls, send messages, or access contacts. It is a passive
        monitoring tool. Root access is optional and only used for raw PDU sending in the
        PDU Builder.
      </Text>
    </View>
  );
}

interface StepConsentProps {
  shareEnabled: boolean; setShareEnabled: (v: boolean) => void;
  minSeverity: Severity; setMinSeverity: (v: Severity) => void;
  shareLow: boolean; setShareLow: (v: boolean) => void;
}

function StepConsent({ shareEnabled, setShareEnabled, minSeverity, setMinSeverity, shareLow, setShareLow }: StepConsentProps) {
  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Threat intelligence sharing</Text>
      <Text style={s.stepSubtitle}>Help improve detection for everyone. Sharing is completely optional.</Text>

      <View style={s.consentCard}>
        <View style={s.consentRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.consentLabel}>Share anonymised threat reports</Text>
            <Text style={s.consentDesc}>
              When a detection fires, send the matching signature, PDU hex bytes, and
              signal cell ID to the FieldGuard global database. No MSISDN, IMEI, contacts,
              or message text is included.
            </Text>
          </View>
          <Switch value={shareEnabled} onValueChange={setShareEnabled}
            thumbColor={shareEnabled ? '#2563eb' : '#f1f5f9'} trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} />
        </View>
        {shareEnabled && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Minimum severity to share</Text>
            <View style={s.severitySelector}>
              {SEVERITY_OPTIONS.map((opt) => (
                <Pressable key={opt.value}
                  style={[s.sevChip, minSeverity === opt.value && s.sevChipActive]}
                  onPress={() => setMinSeverity(opt.value)}
                >
                  <Text style={[s.sevChipText, minSeverity === opt.value && s.sevChipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[s.consentRow, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.consentLabel}>Also share low-priority alerts</Text>
                <Text style={s.consentDesc}>
                  INFO and LOW severity events (noise scans, scanner hits on benign packets). Off by default to reduce volume.
                </Text>
              </View>
              <Switch value={shareLow} onValueChange={setShareLow}
                thumbColor={shareLow ? '#2563eb' : '#f1f5f9'} trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} />
            </View>
          </>
        )}
      </View>

      <View style={s.privacyBox}>
        <Text style={s.privacyTitle}>Privacy guarantee</Text>
        <Text style={s.privacyText}>
          Shared data is limited to: detection category \u00B7 signature ID \u00B7 matched hex bytes \u00B7
          serving cell MCC/MNC/LAC/CID \u00B7 alert severity.{'\n\n'}
          No personal data, no MSISDN, no IMEI, no call records, no SMS content.
        </Text>
      </View>
    </View>
  );
}

function StepSession() {
  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>PC / Web session pairing</Text>
      <Text style={s.stepSubtitle}>View captured packets live on your PC or in any browser.</Text>

      <View style={s.howCard}>
        <HowStep n="1" text='Open the PC Bridge tab \u2192 tap "Create Session". A 6-digit PIN is generated on the phone.' />
        <HowStep
          n="2"
          text={
            'On your PC or phone browser, open our viewer (same host as the relay): ' +
            PC_BRIDGE_VIEWER_URL +
            '. The page will ask for the PIN before joining the session.'
          }
        />
        <HowStep n="3" text="Enter the 6-digit PIN from the app when prompted. Payloads are end-to-end encrypted with your PGP keys." />
        <HowStep n="4" text='To share a session publicly, tap "Share URL". Anyone with the link can view.' />
      </View>

      <View style={s.privacyBox}>
        <Text style={s.privacyTitle}>How pairing works</Text>
        <Text style={s.privacyText}>
          Sessions are E2E encrypted using PGP (openpgp.js on the browser side, react-native-openpgp
          on device). The relay at fieldguard.lbs-int.com forwards AES-256-GCM ciphertext only; pairing
          happens in the browser after you enter the PIN on the viewer page. Sessions expire after 7 days.
        </Text>
      </View>

      <Text style={s.footnote}>You can skip pairing now and set it up any time from the PC Bridge tab.</Text>
    </View>
  );
}

function HowStep({ n, text }: { n: string; text: string }) {
  return (
    <View style={s.howRow}>
      <View style={s.howNum}><Text style={s.howNumText}>{n}</Text></View>
      <Text style={s.howText}>{text}</Text>
    </View>
  );
}

interface Props { onComplete: () => void; }

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [shareEnabled, setShareEnabled] = useState(false);
  const [minSeverity,  setMinSeverity]  = useState<Severity>('high');
  const [shareLow,     setShareLow]     = useState(false);

  const { setSettings, setOnboardingDone } = useAppStore();

  const STEPS = [
    <StepWelcome key="welcome" />,
    <StepConsent key="consent"
      shareEnabled={shareEnabled} setShareEnabled={setShareEnabled}
      minSeverity={minSeverity} setMinSeverity={setMinSeverity}
      shareLow={shareLow} setShareLow={setShareLow}
    />,
    <StepSession key="session" />,
  ];

  const goToStep = (n: number) => {
    flatRef.current?.scrollToIndex({ index: n, animated: true });
    Animated.timing(progressAnim, { toValue: (n + 1) / STEPS.length, duration: 300, useNativeDriver: false }).start();
    setStep(n);
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) { goToStep(step + 1); }
    else {
      setSettings({ shareReports: shareEnabled, shareMinSeverity: minSeverity, shareLowEnabled: shareLow });
      await AsyncStorage.setItem('fg_settings', JSON.stringify({ shareReports: shareEnabled, shareMinSeverity: minSeverity, shareLowEnabled: shareLow }));
      setOnboardingDone(true);
      onComplete();
    }
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.root}>
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { width: progressWidth }]} />
      </View>
      <View style={s.dotsRow}>
        {STEPS.map((_, i) => <View key={i} style={[s.dot, i === step && s.dotActive]} />)}
      </View>
      <FlatList
        ref={flatRef} data={STEPS} keyExtractor={(_, i) => String(i)}
        horizontal pagingEnabled scrollEnabled={false} showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <View style={{ width: SCREEN_W }}>{item}</View>}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
      />
      <View style={s.footer}>
        {step > 0 && (
          <Pressable style={s.btnBack} onPress={() => goToStep(step - 1)}>
            <Text style={s.btnBackText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={s.btnNext} onPress={handleNext}>
          <Text style={s.btnNextText}>{step === STEPS.length - 1 ? 'Get started' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f8fafc' },
  progressTrack: { height: 3, backgroundColor: '#e2e8f0', marginTop: 44 },
  progressFill:  { height: 3, backgroundColor: '#2563eb' },
  dotsRow:       { flexDirection: 'row', justifyContent: 'center', marginVertical: 12, gap: 8 },
  dot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  dotActive:     { backgroundColor: '#2563eb' },

  stepContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  logoText:      { fontSize: 32, textAlign: 'center', marginBottom: 8, color: '#0f172a', fontWeight: '700' },
  stepTitle:     { fontSize: 20, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 6 },
  stepSubtitle:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, marginBottom: 16 },

  listBox:  { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  listRow:  { flexDirection: 'row', gap: 6 },
  bullet:   { color: '#2563eb', fontSize: 14, marginTop: 1 },
  listItem: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 17 },

  footnote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 14, lineHeight: 16 },

  consentCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  consentRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  consentLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 3 },
  consentDesc:  { fontSize: 12, color: '#64748b', lineHeight: 17 },
  divider:      { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },

  sectionLabel:    { fontSize: 12, color: '#64748b', marginBottom: 8 },
  severitySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sevChip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  sevChipActive:   { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  sevChipText:     { fontSize: 12, color: '#64748b' },
  sevChipTextActive: { color: '#2563eb', fontWeight: '600' },

  privacyBox:   { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  privacyTitle: { fontSize: 12, fontWeight: '700', color: '#16a34a', marginBottom: 6 },
  privacyText:  { fontSize: 12, color: '#166534', lineHeight: 17 },

  howCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  howRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howNum:  { width: 24, height: 24, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  howNumText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  howText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },

  footer:    { flexDirection: 'row', padding: 20, gap: 12 },
  btnBack:   { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  btnBackText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  btnNext:   { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  btnNextText: { fontSize: 15, color: '#ffffff', fontWeight: '700' },
});
