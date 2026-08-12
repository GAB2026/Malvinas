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
     * Fires 'native-pause' in the WebView JS context the moment Android moves
     * the activity to the background.
     *
     * document.visibilitychange is NOT reliably dispatched on many Android OEM
     * builds (Samsung, Xiaomi, etc.) when the user presses Home or switches apps.
     * Bridging onPause() via evaluateJavascript is the only guaranteed signal.
     *
     * The useWarmSession hook listens for window 'native-pause' and calls
     * stopWith('tab-hidden') before the renderer can enter a degraded state.
     * clearSession() runs synchronously, so localStorage is clean before the
     * renderer may be suspended or killed by the OS.
     */
    @Override
    public void onPause() {
        super.onPause();
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;
        webView.post(() ->
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('native-pause'));",
                null
            )
        );
    }

    /**
     * Dark overlay placed on top of the WebView.
     *
     * When Android kills the WebView renderer in the background the WebView is
     * blank on resume.  We cover the screen with a solid #0C0A09 view, reload
     * the Capacitor local URL behind it, and fade out once React has mounted.
     * The user never sees a blank or corrupted frame.
     */
    private void setupReloadOverlay() {
        reloadOverlay = new View(this);
        reloadOverlay.setBackgroundColor(0xFF0C0A09);
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

        // Case 1: renderer was killed and URL is blank/null
        if (url == null || url.equals("about:blank") || url.isEmpty()) {
            showOverlayAndReload(webView);
            return;
        }

        // Case 2: renderer may have been killed but URL is still set.
        // Probe via evaluateJavascript — if the renderer is dead the callback
        // never fires, so a 1.5 s timeout triggers a forced reload instead.
        final boolean[] probeAnswered = {false};
        Runnable timeoutReload = () -> {
            if (!probeAnswered[0]) showOverlayAndReload(webView);
        };
        webView.postDelayed(timeoutReload, 1500);
        webView.evaluateJavascript("document.readyState", value -> {
            probeAnswered[0] = true;
            webView.removeCallbacks(timeoutReload);
            if (value == null || value.equals("null")) showOverlayAndReload(webView);
        });
    }

    private void showOverlayAndReload(WebView webView) {
        if (reloadOverlay != null) {
            reloadOverlay.setAlpha(1f);
            reloadOverlay.setVisibility(View.VISIBLE);
        }
        webView.loadUrl(this.bridge.getLocalUrl());
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
