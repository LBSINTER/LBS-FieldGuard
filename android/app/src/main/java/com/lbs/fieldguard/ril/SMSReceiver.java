package com.lbs.fieldguard.ril;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

/**
 * Static SMS BroadcastReceiver declared in AndroidManifest.xml.
 *
 * This receiver is registered with highest priority so the app can intercept
 * inbound SMS PDUs even when the React Native bridge is not yet initialised.
 *
 * Once the bridge is up, the RILBridgeModule.startMonitor() method registers
 * a dynamic receiver that forwards events to the JS layer.  This static
 * receiver is kept intentionally lightweight — it only logs for now.
 */
public class SMSReceiver extends BroadcastReceiver {

    private static final String TAG = "FieldGuard:SMSReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        Log.d(TAG, "onReceive: " + action);

        // The heavy lifting (PDU parsing, event emission) is handled by
        // RILBridgeModule once the React bridge is alive.  This static
        // receiver can be extended later for pre-bridge buffering.
    }
}
