# LBS FieldGuard

Multi-platform mobile forensics and SS7 threat detection tool.

Platforms: **Android APK** + **Windows** (react-native-windows)

---

## What it does

LBS FieldGuard runs on an Android device or Windows workstation and provides:

- **Byte-pattern scanner** — scans the device filesystem for known malware, SS7 RAT payloads, Pegasus/NSO Group signatures
- **RIL monitor** — intercepts inbound SMS PDUs at the Android RIL layer, classifying Type-0 silent SMS, SIM OTA commands (IEI 0x70/0x71), STK ProactiveCommand (PID=0x7F), binary SMS, and Class-0 flash SMS
- **Packet analyser** — Android VPN TUN or Windows Npcap/WinPcap capture; detects NSO/Pegasus C2 IP contacts, SS7-over-IP (SIGTRAN ports), rogue GTP tunnels, ICMP redirects
- **PDU Builder** — construct SMS-SUBMIT PDUs from templates (Type-0, STK, OTA, binary, WAP Push, custom) for testing and verification
- **SS7 payload catalogue** — pre-loaded database of 15+ known attack types with PID/DCS/UDH classification and mitigation references
- **Station probe** — persistent TCP connection to main LBS station (140.82.39.182:5556) for signature updates and remote alert relay

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  LBS FieldGuard (React Native)                       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Scanner  │  │  RIL     │  │  Network Analyser  │ │
│  │ (TS)     │  │  Monitor │  │  (TS + NativeModule│ │
│  └──────────┘  │  (TS +   │  │   PCAPBridge.cs /  │ │
│                │  Java    │  │   rn-tcp-socket)   │ │
│                │  RIL     │  └────────────────────┘ │
│                │  Bridge) │                          │
│                └──────────┘                          │
│  ┌──────────────────────────────────────────────────┐│
│  │  Signature DB  │  SS7 Payload Catalogue          ││
│  │  (JSON asset)  │  (PayloadCatalogue.ts)          ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │  Probe Client (TCP → 140.82.39.182:5556)         ││
│  │  Signature updates · Remote alerts · Telemetry   ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │  Zustand Store  │  React Navigation              ││
│  │  Dashboard · Scanner · PDU Builder · Alerts      ││
│  │  Probe · Settings                                ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## Project Layout

```
LBS-FieldGuard/
├── src/
│   ├── App.tsx                    — root component
│   ├── scanner/
│   │   ├── SignatureDB.ts         — byte-pattern loader and matcher
│   │   └── FileScanner.ts         — chunked file scanner
│   ├── android/
│   │   ├── PDUCodec.ts            — full SMS PDU encode/decode
│   │   └── RILMonitor.ts          — RIL event monitor + classifier
│   ├── network/
│   │   └── PacketAnalyser.ts      — packet capture + NSO/SS7 detection
│   ├── probe/
│   │   └── ProbeClient.ts         — TCP probe to LBS station
│   ├── ss7/
│   │   └── PayloadCatalogue.ts    — SS7 RAT payload database (15+ entries)
│   ├── store/
│   │   └── appStore.ts            — Zustand global state
│   ├── types/
│   │   └── index.ts               — all shared TypeScript types
│   ├── ui/
│   │   ├── RootNavigator.tsx
│   │   ├── components/Icon.tsx
│   │   └── screens/
│   │       ├── DashboardScreen.tsx
│   │       ├── ScannerScreen.tsx
│   │       ├── PDUBuilderScreen.tsx
│   │       ├── AlertsScreen.tsx
│   │       ├── ProbeScreen.tsx
│   │       └── SettingsScreen.tsx
│   └── utils/
│       ├── crypto.ts
│       └── id.ts
├── android/
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   └── java/com/lbs/fieldguard/ril/
│   │       ├── RILBridgeModule.java   — SMS BroadcastReceiver NativeModule
│   │       └── RILBridgePackage.java
├── windows/
│   ├── LBSFieldGuard/
│   │   └── PCAPBridgeModule.cs        — WinPcap/Npcap NativeModule (C#)
│   └── LBSFieldGuard.Package/
│       └── LBSFieldGuardPackage.cs
├── assets/
│   └── signatures/db.json             — bundled byte-pattern signature DB
├── __tests__/
│   ├── PDUCodec.test.ts
│   ├── SignatureDB.test.ts
│   └── PayloadCatalogue.test.ts
├── package.json
├── tsconfig.json
├── babel.config.js
└── metro.config.js
```

---

## Build

### Android APK

```bash
# Install dependencies
npm install

# Debug build (device/emulator)
npx react-native run-android

# Release APK
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

**Prerequisites:** Android Studio, NDK r25+, Java 17+

### Windows

```bash
npm install
npx react-native run-windows
```

**Prerequisites:** Visual Studio 2022 with UWP workload, Npcap (https://npcap.com) installed.

---

## Native Modules

### Android — RILBridgeModule (Java)

- Registers a `BroadcastReceiver` for `SMS_RECEIVED` and `SMS_CB_RECEIVED`
- Priority: `Integer.MAX_VALUE` to intercept before other apps
- Emits `onRILMessage` events to JS with full PDU hex
- Required permissions: `RECEIVE_SMS`, `READ_PHONE_STATE`

Register in `MainApplication.java`:
```java
packages.add(new RILBridgePackage());
```

### Windows — PCAPBridgeModule (C#)

- Uses SharpPcap + PacketDotNet NuGet packages
- Opens promiscuous capture on first available Npcap adapter
- Emits `onPacket` events with `{ srcIp, dstIp, proto, srcPort, dstPort, payloadHex }`
- Requires Npcap installed on target machine

Register in `App.cpp`:
```cpp
PackageProviders().Append(winrt::make<LBSFieldGuardPackage>());
```

---

## Signature DB

`assets/signatures/db.json` — compiled into the app bundle.

Signature fields:
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Human-readable name |
| `category` | string | `stk` / `sim_ota` / `pegasus` / `ss7_map` / `ss7` / `gtp` / `malware` |
| `severity` | string | `info` / `low` / `medium` / `high` / `critical` |
| `pattern` | string | Hex bytes space-separated |
| `mask` | string | Optional byte mask (FF=must match, 00=wildcard) |
| `description` | string | Attack description |

Update signatures via station probe (MSG_SIG_UPDATE) or replace `db.json` and rebuild.

---

## SS7 Payload Catalogue

`src/ss7/PayloadCatalogue.ts` — 15+ entries covering:

| ID | Layer | Attack |
|----|-------|--------|
| SILENT_TYPE0 | SMS-PP | Type-0 silent SMS (PID=0x40) |
| FLASH_CLASS0 | SMS-PP | Class-0 flash SMS (social engineering) |
| SIM_OTA_UDH70 | SIM-OTA | SIM OTA command (IEI=0x70) |
| SIM_OTA_UDH71 | SIM-OTA | SIM OTA response (IEI=0x71) |
| STK_PROACTIVE_7F | STK | STK ProactiveCommand (PID=0x7F) |
| STK_SEND_SMS | STK | SEND SHORT MESSAGE (exfiltration) |
| STK_LAUNCH_BROWSER | STK | LAUNCH BROWSER (drive-by exploit) |
| USSD_PUSH_HIJACK | USSD | MAP USSD push (credential theft) |
| MAP_SRILSM | SS7-MAP | SRI-SM (IMSI harvesting) |
| MAP_ATI | SS7-MAP | AnyTimeInterrogation (real-time location) |
| MAP_ISD | SS7-MAP | InsertSubscriberData (call forwarding inject) |
| GTP_HIJACK | GTP | GTPv1 session spoofing |
| NSO_PEGASUS_STAGERHEX | SMS-PP | Pegasus stage-1 binary SMS indicator |

---

## Station Probe Protocol

Wire format (matches CollectedNET transport v1):

```
2B  MSG_TYPE
4B  PAYLOAD_LEN
NB  JSON payload
```

Message types:
| Type | Direction | Description |
|------|-----------|-------------|
| 0x0001 | Client→Station | PROBE_HELLO (device_id, platform, version) |
| 0x0003 | Client→Station | PING |
| 0x0004 | Station→Client | PONG (echo timestamp for latency) |
| 0x0005 | Station→Client | SIG_UPDATE (signature DB patch JSON) |
| 0x0002 | Station→Client | ALERT (station-pushed alert) |

---

## Tests

```bash
npm test
```

Tests cover:
- PDU encode/decode round-trip (GSM-7, binary, Type-0, STK)
- Signature DB loading and byte matching
- Payload catalogue classification

---

## Requirements

| Component | Minimum |
|-----------|---------|
| Node.js | 18 |
| React Native | 0.73 |
| Android SDK | API 26 (Android 8) |
| Windows | 10 1903+ with Npcap |
| Java | 17 |
| Visual Studio | 2022 (UWP workload) |
