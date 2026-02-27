package com.lbs.fieldguard.ril;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;

/**
 * RILBridge — React Native NativeModule
 *
 * Registers a BroadcastReceiver for android.provider.Telephony.SMS_RECEIVED
 * and android.provider.Telephony.SMS_CB_RECEIVED.
 *
 * For each inbound PDU, emits an 'onRILMessage' event to JS with:
 *   { type: "SMS_DELIVER", hex: "<full PDU hex including SMSC>" }
 *
 * Requires:
 *   <uses-permission android:name="android.permission.RECEIVE_SMS" />
 *   <uses-permission android:name="android.permission.READ_PHONE_STATE" />
 */
public class RILBridgeModule extends ReactContextBaseJavaModule {
    private static final String TAG = "FieldGuard:RILBridge";
    private final ReactApplicationContext reactContext;
    private BroadcastReceiver smsReceiver;

    public RILBridgeModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "RILBridge";
    }

    // Required by NativeEventEmitter in RN 0.65+
    @ReactMethod
    public void addListener(String eventName) { /* no-op */ }

    @ReactMethod
    public void removeListeners(int count) { /* no-op */ }

    @ReactMethod
    public void startMonitor(Promise promise) {
        try {
            smsReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    if ("android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
                        Bundle bundle = intent.getExtras();
                        if (bundle == null) return;
                        Object[] pdus = (Object[]) bundle.get("pdus");
                        String format = bundle.getString("format", "3gpp");
                        if (pdus == null) return;
                        for (Object pdu : pdus) {
                            byte[] pduBytes = (byte[]) pdu;
                            String hex = bytesToHex(pduBytes);
                            emitRILMessage("SMS_DELIVER", hex);
                        }
                    } else if ("android.provider.Telephony.SMS_CB_RECEIVED".equals(intent.getAction())) {
                        Bundle bundle = intent.getExtras();
                        if (bundle == null) return;
                        byte[] pdu = bundle.getByteArray("pdu");
                        if (pdu != null) emitRILMessage("CBS", bytesToHex(pdu));
                    }
                }
            };

            android.content.IntentFilter filter = new android.content.IntentFilter();
            filter.addAction("android.provider.Telephony.SMS_RECEIVED");
            filter.addAction("android.provider.Telephony.SMS_CB_RECEIVED");
            filter.setPriority(Integer.MAX_VALUE);

            // API 33+ requires RECEIVER_EXPORTED / RECEIVER_NOT_EXPORTED flag
            ContextCompat.registerReceiver(
                reactContext,
                smsReceiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED
            );
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERR_RIL", e.getMessage());
        }
    }

    @ReactMethod
    public void stopMonitor() {
        if (smsReceiver != null) {
            try {
                reactContext.unregisterReceiver(smsReceiver);
            } catch (Exception ignored) {}
            smsReceiver = null;
        }
    }

    private void emitRILMessage(String type, String hex) {
        try {
            JSONObject event = new JSONObject();
            event.put("type", type);
            event.put("hex", hex);
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onRILMessage", event.toString());
        } catch (Exception e) {
            Log.e(TAG, "emitRILMessage error", e);
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
