package com.lbs.fieldguard.notify;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.lbs.fieldguard.MainActivity;
import com.lbs.fieldguard.R;

public class FieldGuardNotifyModule extends ReactContextBaseJavaModule {
    private static final String CHANNEL_MONITOR = "fieldguard.monitor";
    private static final String CHANNEL_ALERTS  = "fieldguard.alerts";
    private static final String CHANNEL_UPDATES = "fieldguard.updates";
    private static final int ID_MONITOR    = 41101;
    private static final int ID_UPDATE     = 41099;
    private static final int ID_ALERT_BASE = 41200;

    private final ReactApplicationContext ctx;

    public FieldGuardNotifyModule(ReactApplicationContext context) {
        super(context);
        this.ctx = context;
        ensureChannels();
    }

    @Override
    public String getName() {
        return "FieldGuardNotify";
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        promise.resolve(true);
    }

    @ReactMethod
    public void startMonitoringNotification(String mode, String detail, Promise promise) {
        try {
            ensureChannels();
            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_MONITOR)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("FieldGuard monitoring active")
                .setContentText(mode + " — " + detail)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(mode + " — " + detail))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(openAppIntent());

            notify(ID_MONITOR, builder.build());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERR_NOTIFY_START", e.getMessage());
        }
    }

    @ReactMethod
    public void stopMonitoringNotification(Promise promise) {
        try {
            NotificationManagerCompat.from(ctx).cancel(ID_MONITOR);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERR_NOTIFY_STOP", e.getMessage());
        }
    }

    /**
     * Fire a one-time "update available" notification.
     * Tapping it opens downloadUrl directly in the device browser.
     */
    @ReactMethod
    public void notifyUpdate(String version, String downloadUrl, Promise promise) {
        try {
            ensureChannels();

            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getActivity(ctx, ID_UPDATE, browserIntent, piFlags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_UPDATES)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("FieldGuard " + version + " available")
                .setContentText("Tap to open the download page and install the latest update.")
                .setStyle(new NotificationCompat.BigTextStyle()
                    .bigText("A new version of LBS FieldGuard (" + version + ") is available. "
                           + "Tap to open the secure download page and install the update."))
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pi);

            notify(ID_UPDATE, builder.build());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERR_NOTIFY_UPDATE", e.getMessage());
        }
    }

    @ReactMethod
    public void notifyThreat(String title, String detail, String severity, Promise promise) {
        try {
            ensureChannels();

            int priority = NotificationCompat.PRIORITY_HIGH;
            if ("critical".equalsIgnoreCase(severity)) priority = NotificationCompat.PRIORITY_MAX;

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ALERTS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(detail)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(detail))
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(priority)
                .setContentIntent(openAppIntent());

            int id = ID_ALERT_BASE + (int) (System.currentTimeMillis() % 10000);
            notify(id, builder.build());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERR_NOTIFY_ALERT", e.getMessage());
        }
    }

    private PendingIntent openAppIntent() {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, 0, intent, flags);
    }

    private void notify(int id, android.app.Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            int granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS);
            if (granted != PackageManager.PERMISSION_GRANTED) return;
        }
        NotificationManagerCompat.from(ctx).notify(id, notification);
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel monitor = new NotificationChannel(
            CHANNEL_MONITOR,
            "FieldGuard Monitoring",
            NotificationManager.IMPORTANCE_LOW
        );
        monitor.setDescription("Persistent notification while telemetry monitoring is active");
        monitor.setShowBadge(false);
        nm.createNotificationChannel(monitor);

        NotificationChannel alerts = new NotificationChannel(
            CHANNEL_ALERTS,
            "FieldGuard Threat Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        alerts.setDescription("Threat alerts for verified suspicious inbound telecom payloads");
        alerts.setShowBadge(true);
        nm.createNotificationChannel(alerts);

        NotificationChannel updates = new NotificationChannel(
            CHANNEL_UPDATES,
            "FieldGuard App Updates",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        updates.setDescription("Notifies when a new signed FieldGuard release is available");
        updates.setShowBadge(true);
        nm.createNotificationChannel(updates);
    }
}
