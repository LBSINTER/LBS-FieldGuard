import { UDHHeader } from '../types';

export interface DocumentationEntry {
  id: string;
  group: string;
  icon: string;
  title: string;
  spec: string;
  detectable: boolean;
  sendableInBuilder: boolean;
  rawPduCapable: boolean;
  description: string;
  pid?: number;
  dcs?: number;
  ucs2?: boolean;
  udh?: UDHHeader[];
  textSample?: string;
  binarySampleHex?: string;
}

export const GROUPS = [
  'Core SMS',
  'PID / Special',
  'DCS Classes',
  'DCS Coding Groups',
  'MWI (Message Waiting)',
  'UDH & Concatenation',
  'App Port Addressing',
  'SIM OTA / STK',
  'STK Proactive Commands',
  'WAP / OMA',
  'EMS / Rich Content',
  'vCard / vCalendar',
  'Cell Broadcast / ETWS',
] as const;

export type GroupName = typeof GROUPS[number];

export const DOCUMENTATION_ENTRIES: DocumentationEntry[] = [

  // ═══════ CORE SMS ═══════
  {
    id: 'sms_submit', group: 'Core SMS', icon: 'send', title: 'SMS-SUBMIT (GSM-7)',
    spec: '3GPP TS 23.040 \u00A79.2.2.2', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Mobile-originated PDU to SMSC with GSM 7-bit default alphabet encoding.',
    pid: 0x00, dcs: 0x00, textSample: 'Test message',
  },
  {
    id: 'sms_submit_ucs2', group: 'Core SMS', icon: 'translate', title: 'SMS-SUBMIT (UCS-2)',
    spec: '3GPP TS 23.040 \u00A79.2.2.2', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'SMS-SUBMIT with UCS-2 (UTF-16BE) encoding for non-Latin scripts.',
    pid: 0x00, dcs: 0x08, ucs2: true, textSample: 'Test UCS-2',
  },
  {
    id: 'sms_submit_8bit', group: 'Core SMS', icon: 'file-binary', title: 'SMS-SUBMIT (8-bit binary)',
    spec: '3GPP TS 23.040 \u00A79.2.2.2', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'SMS-SUBMIT with 8-bit data coding for raw binary payloads.',
    pid: 0x00, dcs: 0x04, binarySampleHex: '48656C6C6F',
  },

  // ═══════ PID / SPECIAL ═══════
  {
    id: 'type0', group: 'PID / Special', icon: 'eye-off-outline', title: 'Type-0 Silent SMS',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x40 silent ping; handset ACKs and discards. Used for subscriber presence probing.',
    pid: 0x40, dcs: 0x00, textSample: 'silent',
  },
  {
    id: 'replace_sm1', group: 'PID / Special', icon: 'refresh', title: 'Replace SM (Slot 1)',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x41 replaces stored message slot 1 of same originator.',
    pid: 0x41, dcs: 0x00, textSample: 'replace-slot-1',
  },
  {
    id: 'replace_sm2', group: 'PID / Special', icon: 'refresh', title: 'Replace SM (Slot 2)',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x42 replaces stored message slot 2.',
    pid: 0x42, dcs: 0x00, textSample: 'replace-slot-2',
  },
  {
    id: 'replace_sm7', group: 'PID / Special', icon: 'refresh', title: 'Replace SM (Slot 7)',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x47 replaces stored message slot 7.',
    pid: 0x47, dcs: 0x00, textSample: 'replace-slot-7',
  },
  {
    id: 'return_call', group: 'PID / Special', icon: 'phone-return', title: 'Return Call Message',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x5F indicates the originator requests a return call.',
    pid: 0x5F, dcs: 0x00, textSample: 'Please call back',
  },
  {
    id: 'depersonalization', group: 'PID / Special', icon: 'cellphone-key', title: 'ME Depersonalization',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x3E ME depersonalization SMS.',
    pid: 0x3E, dcs: 0x04, binarySampleHex: '0102030405',
  },
  {
    id: 'sim_dl', group: 'PID / Special', icon: 'sim', title: 'SIM Data Download',
    spec: '3GPP TS 31.111 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x7F with binary UD forwarded to SIM toolkit for OTA processing.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0118103011300820281828D050447A1B2C3',
  },
  {
    id: 'me_dl', group: 'PID / Special', icon: 'cellphone-cog', title: 'ME Data Download',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x7E data download to ME for device-side processing.',
    pid: 0x7E, dcs: 0xF6, binarySampleHex: '0102030405',
  },
  {
    id: 'ansi136_rdata', group: 'PID / Special', icon: 'radio-tower', title: 'ANSI-136 R-DATA',
    spec: '3GPP TS 23.040 \u00A79.2.3.9', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'PID 0x7C ANSI-136 R-DATA interworking message.',
    pid: 0x7C, dcs: 0x04, binarySampleHex: '0102030405',
  },

  // ═══════ DCS CLASSES ═══════
  {
    id: 'flash_class0', group: 'DCS Classes', icon: 'message-alert-outline', title: 'Class-0 Flash (GSM-7)',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Immediate display class (DCS 0x10). Appears on screen without user storage.',
    pid: 0x00, dcs: 0x10, textSample: 'Flash notification',
  },
  {
    id: 'flash_class0_ucs2', group: 'DCS Classes', icon: 'message-alert-outline', title: 'Class-0 Flash (UCS-2)',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Flash SMS with UCS-2 encoding (DCS 0x18).',
    pid: 0x00, dcs: 0x18, ucs2: true, textSample: 'Flash UCS-2',
  },
  {
    id: 'class1', group: 'DCS Classes', icon: 'message-text-outline', title: 'Class-1 ME Storage (GSM-7)',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'ME default storage class (DCS 0x11).',
    pid: 0x00, dcs: 0x11, textSample: 'Class1 payload',
  },
  {
    id: 'class1_ucs2', group: 'DCS Classes', icon: 'message-text-outline', title: 'Class-1 ME (UCS-2)',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Class-1 UCS-2 encoded (DCS 0x19).',
    pid: 0x00, dcs: 0x19, ucs2: true, textSample: 'Class1 UCS2',
  },
  {
    id: 'class2', group: 'DCS Classes', icon: 'sim-outline', title: 'Class-2 SIM (GSM-7)',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'SIM storage class (DCS 0x12) for EF_SMS. Critical for OTA.',
    pid: 0x00, dcs: 0x12, textSample: 'Class2 payload',
  },
  {
    id: 'class2_binary', group: 'DCS Classes', icon: 'sim-outline', title: 'Class-2 SIM (8-bit)',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Class-2 with 8-bit binary DCS (0xF6). Used for SIM Data Download.',
    pid: 0x00, dcs: 0xF6, binarySampleHex: 'D0118103011300820281828D050447A1B2C3',
  },
  {
    id: 'class3', group: 'DCS Classes', icon: 'laptop', title: 'Class-3 TE SMS',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Terminal equipment directed class (DCS 0x13).',
    pid: 0x00, dcs: 0x13, textSample: 'Class3 payload',
  },

  // ═══════ DCS CODING GROUPS ═══════
  {
    id: 'dcs_compressed_gsm7', group: 'DCS Coding Groups', icon: 'zip-box-outline', title: 'Compressed GSM-7',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0x20 compressed GSM-7.',
    pid: 0x00, dcs: 0x20, textSample: 'Compressed GSM7',
  },
  {
    id: 'dcs_compressed_ucs2', group: 'DCS Coding Groups', icon: 'zip-box-outline', title: 'Compressed UCS-2',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0x28 compressed UCS-2.',
    pid: 0x00, dcs: 0x28, ucs2: true, textSample: 'Compressed UCS2',
  },
  {
    id: 'dcs_f0_class0', group: 'DCS Coding Groups', icon: 'message-flash-outline', title: 'Group 1111 Class-0 GSM-7',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xF0 (coding group 1111, class 0, GSM-7). Some handsets differ from 0x10.',
    pid: 0x00, dcs: 0xF0, textSample: 'DCS F0 class0',
  },
  {
    id: 'dcs_f1_class1', group: 'DCS Coding Groups', icon: 'message-flash-outline', title: 'Group 1111 Class-1 GSM-7',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xF1 (coding group 1111, class 1, GSM-7).',
    pid: 0x00, dcs: 0xF1, textSample: 'DCS F1 class1',
  },
  {
    id: 'dcs_f4_class0_8bit', group: 'DCS Coding Groups', icon: 'file-binary', title: 'Group 1111 Class-0 8-bit',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xF4 (coding group 1111, class 0, 8-bit data).',
    pid: 0x00, dcs: 0xF4, binarySampleHex: '48656C6C6F',
  },
  {
    id: 'dcs_f5_class1_8bit', group: 'DCS Coding Groups', icon: 'file-binary', title: 'Group 1111 Class-1 8-bit',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xF5 (coding group 1111, class 1, 8-bit data).',
    pid: 0x00, dcs: 0xF5, binarySampleHex: '48656C6C6F',
  },

  // ═══════ MWI (MESSAGE WAITING) ═══════
  {
    id: 'mwi_discard_vm', group: 'MWI (Message Waiting)', icon: 'voicemail', title: 'MWI Discard - Voicemail',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xC0 discard message, set voicemail waiting indicator.',
    pid: 0x00, dcs: 0xC0, textSample: 'Voicemail waiting',
  },
  {
    id: 'mwi_discard_fax', group: 'MWI (Message Waiting)', icon: 'fax', title: 'MWI Discard - Fax',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xC1 discard message, set fax waiting indicator.',
    pid: 0x00, dcs: 0xC1, textSample: 'Fax waiting',
  },
  {
    id: 'mwi_discard_email', group: 'MWI (Message Waiting)', icon: 'email-outline', title: 'MWI Discard - Email',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xC2 discard message, set email waiting indicator.',
    pid: 0x00, dcs: 0xC2, textSample: 'Email waiting',
  },
  {
    id: 'mwi_discard_other', group: 'MWI (Message Waiting)', icon: 'bell-outline', title: 'MWI Discard - Other',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xC3 discard message, set other waiting indicator.',
    pid: 0x00, dcs: 0xC3, textSample: 'MWI other',
  },
  {
    id: 'mwi_store_gsm7_vm', group: 'MWI (Message Waiting)', icon: 'voicemail', title: 'MWI Store GSM-7 - Voicemail',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xD0 store GSM-7 text with voicemail indicator.',
    pid: 0x00, dcs: 0xD0, textSample: 'Voicemail stored',
  },
  {
    id: 'mwi_store_ucs2_vm', group: 'MWI (Message Waiting)', icon: 'voicemail', title: 'MWI Store UCS-2 - Voicemail',
    spec: '3GPP TS 23.038 \u00A74', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'DCS 0xE0 store UCS-2 text with voicemail indicator.',
    pid: 0x00, dcs: 0xE0, ucs2: true, textSample: 'VM UCS2',
  },

  // ═══════ UDH & CONCATENATION ═══════
  {
    id: 'concat8', group: 'UDH & Concatenation', icon: 'view-sequential', title: 'Concat SMS (8-bit ref)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.1', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Multipart SMS using UDH IEI 0x00 with 8-bit reference.',
    pid: 0x00, dcs: 0x00, udh: [{ iei: 0x00, data: 'AA0201' }], textSample: 'Part 1/2',
  },
  {
    id: 'concat16', group: 'UDH & Concatenation', icon: 'view-sequential-outline', title: 'Concat SMS (16-bit ref)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.8', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Multipart SMS using UDH IEI 0x08 with 16-bit reference.',
    pid: 0x00, dcs: 0x00, udh: [{ iei: 0x08, data: 'A1B20201' }], textSample: 'Part 1/2',
  },
  {
    id: 'concat8_ucs2', group: 'UDH & Concatenation', icon: 'view-sequential', title: 'Concat UCS-2 (8-bit ref)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.1', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Multipart UCS-2 with 8-bit concat reference.',
    pid: 0x00, dcs: 0x08, ucs2: true, udh: [{ iei: 0x00, data: 'BB0201' }], textSample: 'UCS2 Part',
  },
  {
    id: 'concat8_binary', group: 'UDH & Concatenation', icon: 'view-sequential', title: 'Concat Binary (8-bit ref)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.1', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Multipart binary 8-bit with concat header.',
    pid: 0x00, dcs: 0x04, udh: [{ iei: 0x00, data: 'CC0201' }], binarySampleHex: '48656C6C6F',
  },

  // ═══════ APP PORT ADDRESSING ═══════
  {
    id: 'port16_wap', group: 'App Port Addressing', icon: 'lan-connect', title: 'Port 16-bit: WAP (2948)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.4', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x05 dest port 2948 (0x0B84) for WAP Push SI/SL.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '0B840000' }], binarySampleHex: '0605040B8423F0',
  },
  {
    id: 'port16_oma_cp', group: 'App Port Addressing', icon: 'lan-connect', title: 'Port 16-bit: OMA CP (49999)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.4', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x05 port 49999 (0xC34F) for OMA Client Provisioning.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: 'C34F0000' }], binarySampleHex: '030B6A0045C6',
  },
  {
    id: 'port8', group: 'App Port Addressing', icon: 'lan-connect', title: 'Port 8-bit Addressing',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.3', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x04 with 8-bit dest/src port pair.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x04, data: 'E200' }], binarySampleHex: '48656C6C6F',
  },
  {
    id: 'port16_vcard', group: 'App Port Addressing', icon: 'card-account-details-outline', title: 'Port 16-bit: vCard (9204)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.4', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x05 port 9204 (0x23F4) for vCard over SMS.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '23F40000' }], binarySampleHex: '424547494E3A56434152440D0A',
  },
  {
    id: 'port16_vcal', group: 'App Port Addressing', icon: 'calendar-outline', title: 'Port 16-bit: vCalendar (9205)',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.4', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x05 port 9205 (0x23F5) for vCalendar over SMS.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '23F50000' }], binarySampleHex: '424547494E3A5643414C0D0A',
  },

  // ═══════ SIM OTA / STK ═══════
  {
    id: 'ota_cmd_70', group: 'SIM OTA / STK', icon: 'shield-key-outline', title: 'OTA Command (IEI 0x70)',
    spec: '3GPP TS 31.111', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'SIM OTA command packet delivered to UICC applet via UDH IEI 0x70.',
    pid: 0x7F, dcs: 0xF6, udh: [{ iei: 0x70, data: '01020304' }], binarySampleHex: 'D0118103011300820281828D050447A1B2C3',
  },
  {
    id: 'ota_resp_71', group: 'SIM OTA / STK', icon: 'reply-outline', title: 'OTA Response (IEI 0x71)',
    spec: '3GPP TS 31.111 \u00A77.1.2', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'SIM OTA response from SIM applet context.',
    pid: 0x7F, dcs: 0xF6, udh: [{ iei: 0x71, data: '0001' }], binarySampleHex: '9000',
  },
  {
    id: 'ota_secured_des', group: 'SIM OTA / STK', icon: 'shield-lock-outline', title: 'OTA Secured Cmd (DES MAC)',
    spec: '3GPP TS 31.115', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'OTA command with DES CBC MAC security header. Typical of carrier OTA updates.',
    pid: 0x7F, dcs: 0xF6, udh: [{ iei: 0x70, data: '00000013' }],
    binarySampleHex: '027000001302700000000D10A0AA4004011003B0A101000D2F',
  },

  // ═══════ STK PROACTIVE COMMANDS ═══════
  {
    id: 'stk_send_sms', group: 'STK Proactive Commands', icon: 'message-arrow-right-outline', title: 'STK SEND SMS',
    spec: 'ETSI TS 102 223 \u00A76.4.10', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x13: SIM instructs ME to send an SMS.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0128103011300820281828D050447112233',
  },
  {
    id: 'stk_launch_browser', group: 'STK Proactive Commands', icon: 'web', title: 'STK LAUNCH BROWSER',
    spec: 'ETSI TS 102 223 \u00A76.4.26', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x15: SIM instructs ME to open a URL.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0138103011500820281828D06056874747073',
  },
  {
    id: 'stk_setup_call', group: 'STK Proactive Commands', icon: 'phone-outgoing', title: 'STK SET UP CALL',
    spec: 'ETSI TS 102 223 \u00A76.4.13', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x10: SIM instructs ME to set up a voice call.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D01C8103011000820281838502002B313939393939393939',
  },
  {
    id: 'stk_send_ussd', group: 'STK Proactive Commands', icon: 'pound', title: 'STK SEND USSD',
    spec: 'ETSI TS 102 223 \u00A76.4.12', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x12: Send USSD string via SIM.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0158103011200820281838A06042A31303023',
  },
  {
    id: 'stk_send_ss', group: 'STK Proactive Commands', icon: 'phone-settings', title: 'STK SEND SS',
    spec: 'ETSI TS 102 223 \u00A76.4.11', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x11: Send Supplementary Service string.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0128103011100820281838904002A3231230D',
  },
  {
    id: 'stk_display_text', group: 'STK Proactive Commands', icon: 'card-text-outline', title: 'STK DISPLAY TEXT',
    spec: 'ETSI TS 102 223 \u00A76.4.1', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x21: Display text to user.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0148103012100820281028D0904044869207468657265',
  },
  {
    id: 'stk_get_input', group: 'STK Proactive Commands', icon: 'form-textbox', title: 'STK GET INPUT',
    spec: 'ETSI TS 102 223 \u00A76.4.3', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x23: Request text input from user.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0168103012300820281028D0704044869210091020C0F',
  },
  {
    id: 'stk_play_tone', group: 'STK Proactive Commands', icon: 'bell-ring-outline', title: 'STK PLAY TONE',
    spec: 'ETSI TS 102 223 \u00A76.4.5', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x20: Play a tone.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D00F8103012000820281030E010184020102',
  },
  {
    id: 'stk_provide_local', group: 'STK Proactive Commands', icon: 'map-marker-outline', title: 'STK PROVIDE LOCAL INFO',
    spec: 'ETSI TS 102 223 \u00A76.4.15', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x26: Request location info (MCC/MNC/LAC/CID) from ME.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D009810301260082028182',
  },
  {
    id: 'stk_setup_menu', group: 'STK Proactive Commands', icon: 'menu', title: 'STK SET UP MENU',
    spec: 'ETSI TS 102 223 \u00A76.4.8', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Proactive command (D0) 0x25: Install application menu on device.',
    pid: 0x7F, dcs: 0xF6, binarySampleHex: 'D0148103012500820281828F030104416E79',
  },

  // ═══════ WAP / OMA ═══════
  {
    id: 'wap_push_si', group: 'WAP / OMA', icon: 'access-point', title: 'WAP Push SI',
    spec: 'WAP-167 Service Indication', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Port-addressed binary for WSP Service Indication payload.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '0B840000' }],
    binarySampleHex: '2F06037073683A2F2F6578616D706C652E636F6D00',
  },
  {
    id: 'wap_push_sl', group: 'WAP / OMA', icon: 'access-point-network', title: 'WAP Push SL',
    spec: 'WAP-168 Service Loading', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Service Loading: auto-loads URL without user interaction on vulnerable handsets.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '0B840000' }],
    binarySampleHex: '0206036170706C69636174696F6E2F766E642E7761702E736C632000',
  },
  {
    id: 'oma_cp', group: 'WAP / OMA', icon: 'cellphone-cog', title: 'OMA Client Provisioning',
    spec: 'OMA-TS-ProvCont-V1_1', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'Binary provisioning (APN/MMS/email settings injection).',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '0B840000' }],
    binarySampleHex: '030B6A0045C6F6D612D637000',
  },
  {
    id: 'oma_dm', group: 'WAP / OMA', icon: 'cellphone-arrow-down', title: 'OMA Device Management',
    spec: 'OMA-TS-DM_Notification-V1_2', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'OMA DM notification for device management bootstrap.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '0B840000' }],
    binarySampleHex: '01066170706C69636174696F6E2F766E642E73796E636D6C2E646D00',
  },
  {
    id: 'mms_notification', group: 'WAP / OMA', icon: 'message-image-outline', title: 'MMS Notification',
    spec: 'OMA-TS-MMS_ENC-V1_3', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'MMS notification PDU (m-notification-ind) via WAP Push port 2948.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '0B840000' }],
    binarySampleHex: '8C82984F363639393435343300',
  },

  // ═══════ EMS / RICH CONTENT ═══════
  {
    id: 'ems_text_fmt', group: 'EMS / Rich Content', icon: 'format-text', title: 'EMS Text Formatting',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.10.1.1', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x0A text formatting: bold, italic, size, colour.',
    pid: 0x00, dcs: 0x00, udh: [{ iei: 0x0A, data: '000403000100' }], textSample: 'Bold text',
  },
  {
    id: 'ems_predef_sound', group: 'EMS / Rich Content', icon: 'volume-high', title: 'EMS Predefined Sound',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.10.1.2', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x0B predefined sound selection.',
    pid: 0x00, dcs: 0x00, udh: [{ iei: 0x0B, data: '0001' }], textSample: 'Sound',
  },
  {
    id: 'ems_predef_anim', group: 'EMS / Rich Content', icon: 'animation-outline', title: 'EMS Predefined Animation',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.10.1.4', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x0D predefined animation selection.',
    pid: 0x00, dcs: 0x00, udh: [{ iei: 0x0D, data: '0002' }], textSample: 'Animation',
  },
  {
    id: 'ems_user_sound', group: 'EMS / Rich Content', icon: 'music-note', title: 'EMS User-Defined Sound',
    spec: '3GPP TS 23.040 \u00A79.2.3.24.10.1.3', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'UDH IEI 0x0C user-defined iMelody sound data.',
    pid: 0x00, dcs: 0x00, udh: [{ iei: 0x0C, data: '004249455349' }], textSample: 'iMelody',
  },

  // ═══════ vCard / vCalendar ═══════
  {
    id: 'vcard_sms', group: 'vCard / vCalendar', icon: 'card-account-details-outline', title: 'vCard via SMS',
    spec: 'WAP vCard Spec', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'vCard data sent over SMS application port 9204.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '23F40000' }],
    binarySampleHex: '424547494E3A56434152440D0A56455253494F4E3A322E310D0A454E443A56434152440D0A',
  },
  {
    id: 'vcal_sms', group: 'vCard / vCalendar', icon: 'calendar-outline', title: 'vCalendar via SMS',
    spec: 'WAP vCalendar Spec', detectable: true, sendableInBuilder: true, rawPduCapable: true,
    description: 'vCalendar event via SMS port 9205.',
    pid: 0x00, dcs: 0xF5, udh: [{ iei: 0x05, data: '23F50000' }],
    binarySampleHex: '424547494E3A5643414C454E4441520D0A454E443A5643414C454E4441520D0A',
  },

  // ═══════ CELL BROADCAST / ETWS ═══════
  {
    id: 'cb_etws_primary', group: 'Cell Broadcast / ETWS', icon: 'alert-octagon-outline', title: 'ETWS Primary Notification',
    spec: '3GPP TS 23.041 \u00A79.4.1.2', detectable: true, sendableInBuilder: false, rawPduCapable: false,
    description: 'Earthquake/Tsunami Warning primary notification. Broadcast-only, not sendable via SMS-SUBMIT.',
  },
  {
    id: 'cb_etws_secondary', group: 'Cell Broadcast / ETWS', icon: 'alert-octagon', title: 'ETWS Secondary Notification',
    spec: '3GPP TS 23.041 \u00A79.4.1.2.2', detectable: true, sendableInBuilder: false, rawPduCapable: false,
    description: 'ETWS secondary notification with detailed warning text.',
  },
  {
    id: 'cb_cmas_presidential', group: 'Cell Broadcast / ETWS', icon: 'shield-alert-outline', title: 'CMAS Presidential Alert',
    spec: '3GPP TS 23.041', detectable: true, sendableInBuilder: false, rawPduCapable: false,
    description: 'CMAS Presidential-level alert. Message ID 4370.',
  },
  {
    id: 'cb_cmas_extreme', group: 'Cell Broadcast / ETWS', icon: 'weather-hurricane', title: 'CMAS Extreme Alert',
    spec: '3GPP TS 23.041', detectable: true, sendableInBuilder: false, rawPduCapable: false,
    description: 'CMAS Extreme Threat alert. Message ID 4371-4372.',
  },
  {
    id: 'cb_cmas_severe', group: 'Cell Broadcast / ETWS', icon: 'cloud-alert', title: 'CMAS Severe Alert',
    spec: '3GPP TS 23.041', detectable: true, sendableInBuilder: false, rawPduCapable: false,
    description: 'CMAS Severe Threat alert. Message ID 4373-4378.',
  },
];

export function getSendableEntries(): DocumentationEntry[] {
  return DOCUMENTATION_ENTRIES.filter((e) => e.sendableInBuilder);
}

export function getDetectableEntries(): DocumentationEntry[] {
  return DOCUMENTATION_ENTRIES.filter((e) => e.detectable);
}

export function getGroups(): string[] {
  const seen = new Set<string>();
  const r: string[] = [];
  for (const e of DOCUMENTATION_ENTRIES) {
    if (!seen.has(e.group)) { seen.add(e.group); r.push(e.group); }
  }
  return r;
}

export function getSendableGroups(): string[] {
  const seen = new Set<string>();
  const r: string[] = [];
  for (const e of DOCUMENTATION_ENTRIES) {
    if (e.sendableInBuilder && !seen.has(e.group)) { seen.add(e.group); r.push(e.group); }
  }
  return r;
}
