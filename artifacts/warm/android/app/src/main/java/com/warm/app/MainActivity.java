package com.warm.app;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private View reloadOverlay;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPlugin.class);
        super.onCreate(savedInstanceState);
        setupReloadOverlay();
    }

    /**
     * Dark overlay placed on top of the WebView.
     *
     * When Android 12/13 kills the WebView renderer process in the background
     * the WebView is blank on resume.  Instead of showing that blank flash, we
     * instantly cover the screen with a solid view that matches the app's
     * background colour (#0C0A09), reload the Capacitor local URL behind it,
     * and then fade the overlay out once React has had time to mount (~2 s
     * from local assets).  The user never sees white or black — the screen
     * appears to resume seamlessly.
     */
    private void setupReloadOverlay() {
        reloadOverlay = new View(this);
        reloadOverlay.setBackgroundColor(0xFF0C0A09); // --background in the app
        reloadOverlay.setVisibility(View.GONE);
        ViewGroup root = (ViewGroup) getWindow().getDecorView().getRootView();
        root.addView(reloadOverlay, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;
        String url = webView.getUrl();
        if (url == null || url.equals("about:blank")) {
            showOverlayAndReload(webView);
        }
    }

    private void showOverlayAndReload(WebView webView) {
        if (reloadOverlay != null) {
            reloadOverlay.setAlpha(1f);
            reloadOverlay.setVisibility(View.VISIBLE);
        }
        webView.loadUrl(this.bridge.getLocalUrl());
        // 2 000 ms: enough for local Capacitor assets to load + React to mount.
        // Followed by a 300 ms fade so the transition feels intentional.
        if (reloadOverlay != null) {
            reloadOverlay.postDelayed(this::hideOverlay, 2000);
        }
    }

    private void hideOverlay() {
        if (reloadOverlay == null) return;
        reloadOverlay.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction(() -> {
                reloadOverlay.setVisibility(View.GONE);
                reloadOverlay.setAlpha(1f);
            })
            .start();
    }
}
