package com.warm.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * On Android 12/13 the OS can kill the WebView renderer process while the
     * app is in the background.  When the user returns, the WebView is blank
     * (url == "about:blank" or null).  We detect this in onResume and reload
     * the Capacitor local URL so the app recovers automatically.
     */
    @Override
    protected void onResume() {
        super.onResume();
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;
        String url = webView.getUrl();
        if (url == null || url.equals("about:blank")) {
            webView.loadUrl(this.bridge.getLocalUrl());
        }
    }
}
