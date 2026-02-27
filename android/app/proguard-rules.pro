# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified in
# the default ProGuard configuration supplied by the Android SDK Tools.

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# RILBridge NativeModule
-keep class com.lbs.fieldguard.ril.** { *; }

# Prevent obfuscation of models used via JSON reflection
-keepclassmembers class ** {
    @com.facebook.react.bridge.ReactMethod *;
}

-dontwarn com.facebook.react.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
