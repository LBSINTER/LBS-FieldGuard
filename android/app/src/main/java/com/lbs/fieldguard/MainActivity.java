package com.lbs.fieldguard;

import android.os.Bundle;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends ReactActivity {

    @Override
    protected String getMainComponentName() {
        return "LBSFieldGuard";
    }

    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            false  // new architecture disabled
        );
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(null); // prevent react-navigation crash on restore
    }
}
