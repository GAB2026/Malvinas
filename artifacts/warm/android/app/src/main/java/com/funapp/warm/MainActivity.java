package com.funapp.warm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private View reloadOverlay;
    private BillingClient billingClient;
    private static final String PRODUCT_ID = "warm_premium_lifetime";

    /**
     * True only when onStop() has fired — meaning the app truly went to the
     * background (process may be killed).  A plain screen-off via the power
     * button only calls onPause()/onResume() without touching onStop(), so we
     * skip the renderer-reload probe in that case to avoid the blank-screen flicker.
     */
    private boolean appWasStopped = false;
    private BroadcastReceiver screenOffReceiver;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPlugin.class);
        super.onCreate(savedInstanceState);
        setupReloadOverlay();
        setupBilling();
        setupScreenOffReceiver();
        // Expose billing bridge to JS — must be done after super.onCreate() so
        // the WebView exists.  The interface is available for the lifetime of the
        // WebView; re-attaching on each load is not needed.
        this.bridge.getWebView().addJavascriptInterface(new WarmBillingInterface(), "WarmBilling");
    }

    /**
     * Fire native-pause BEFORE super.onPause() so the JS session stops while
     * timers are still active. super.onPause() → webView.onPause() calls
     * PauseTimers(), which would freeze JS execution. Anything queued after
     * that point only runs after onResume() — too late.
     *
     * By dispatching the event first, the WebView enters its paused state
     * already showing the "session stopped" UI. When the screen turns back on
     * and onResume() calls webView.onResume() / ResumeTimers(), the WebView
     * redraws the stopped state immediately — no blank flash, no flicker.
     * This covers both screen-off (power button) and true background.
     */
    @Override
    public void onPause() {
        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('native-pause'));",
                    null
                );
            }
        }
        super.onPause();
    }

    /**
     * onStop fires only for true background (home button / app switch).
     * Screen-off (power button) does NOT call onStop.
     * We use this flag in onResume() to decide whether to check the URL.
     */
    @Override
    public void onStop() {
        super.onStop();
        appWasStopped = true;
    }

    @Override
    public void onStart() {
        super.onStart();
        // Reset here rather than in onResume so the flag is still readable
        // during the onResume call that follows onStart.
    }

    /**
     * On resume: reload only if the renderer is clearly dead (URL blank/null).
     * Avoid the evaluateJavascript timeout probe — it caused flicker when the
     * callback returned null during normal background→foreground transitions.
     *
     * Screen-off (power button) never calls onStop(), so appWasStopped stays
     * false and we skip even the URL check — WebView is healthy in that case.
     * Always re-query Play billing regardless of how we resumed.
     */
    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;

        // Re-query billing — catches purchases finalised in Play Store dialog.
        queryPurchasesInternal();

        // Screen-off/on (power button): onStop() never fired → WebView is
        // still alive → nothing more to do.
        if (!appWasStopped) return;
        appWasStopped = false;

        // True background return: only reload if renderer is clearly dead.
        // Do NOT use a timed JS probe — it causes flicker on normal resumes.
        String url = webView.getUrl();
        if (url == null || url.equals("about:blank") || url.isEmpty()) {
            showOverlayAndReload(webView);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (billingClient != null) billingClient.endConnection();
        if (screenOffReceiver != null) unregisterReceiver(screenOffReceiver);
    }

    /**
     * Fires native-pause the moment the OS detects screen-off — BEFORE
     * onPause() / webView.onPause() / PauseTimers().
     *
     * Why this helps with GPU texture corruption:
     *   When the screen turns off, Android's SurfaceFlinger detaches the
     *   display and the GPU compositor may reclaim the WebView's texture.
     *   If the WebView's last rendered frame was the active therapy animation
     *   (running flame, heat gradient), that texture can appear corrupted
     *   (green/red fragments) when the screen turns back on.
     *
     *   By stopping the session here — before onPause() freezes JS timers —
     *   React has extra time to flush setRunning(false) / setPhase('idle')
     *   and the WebView renders a clean static idle frame BEFORE the GPU
     *   texture is frozen.  The compositor then caches that clean frame.
     *
     * onPause() still fires native-pause afterward for true background
     * (home button / app switch) — calling stopWith() twice is a no-op
     * because it guards on runningRef.current.
     */
    private void setupScreenOffReceiver() {
        screenOffReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (bridge == null) return;
                WebView wv = bridge.getWebView();
                if (wv == null) return;

                if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    // Fire native-pause BEFORE onPause()/PauseTimers() so React
                    // renders a clean idle frame while JS timers are still alive.
                    wv.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('native-pause'));", null);

                } else if (Intent.ACTION_SCREEN_ON.equals(action)) {
                    // The screen is turning on.  Android's SurfaceFlinger is
                    // re-connecting the display; the WebView's GPU texture may
                    // be in a corrupted state (green/red/yellow fragments) from
                    // the screen-off period.
                    //
                    // Strategy: immediately cover any corrupted frame with the
                    // opaque overlay, force the WebView to invalidate (schedule
                    // a fresh GPU composite), then fade the overlay out once the
                    // WebView has had time to produce a clean frame.
                    runOnUiThread(() -> {
                        if (reloadOverlay != null) {
                            reloadOverlay.setAlpha(1f);
                            reloadOverlay.setVisibility(View.VISIBLE);
                        }
                        // Ask the View system to re-draw the WebView.
                        wv.invalidate();
                        // Give the compositor ~400 ms to produce a clean frame,
                        // then fade the overlay out.
                        wv.postDelayed(() -> hideOverlay(), 400);
                    });
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        registerReceiver(screenOffReceiver, filter);
    }

    // ── Billing setup ─────────────────────────────────────────────────────────

    private void setupBilling() {
        PurchasesUpdatedListener purchasesUpdatedListener = (billingResult, purchases) -> {
            int code = billingResult.getResponseCode();
            if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
                for (Purchase purchase : purchases) {
                    handlePurchase(purchase, "PURCHASE_SUCCESS");
                }
            } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
                dispatchToJs("{\"type\":\"PURCHASE_CANCELLED\"}");
            } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                // User already owns the product — query to confirm and unlock
                queryPurchasesInternal();
            } else {
                dispatchToJs("{\"type\":\"PURCHASE_ERROR\",\"code\":" + code + "}");
            }
        };

        billingClient = BillingClient.newBuilder(this)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases()
            .build();

        connectBillingClient();
    }

    private void connectBillingClient() {
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    // Connection ready — query purchases immediately so JS gets
                    // the correct premium state on first load.
                    queryPurchasesInternal();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Play Store disconnected — will reconnect on next operation.
            }
        });
    }

    /**
     * Queries active INAPP purchases from Play and dispatches a billing-result
     * event to JS.  Always uses Play's servers as source of truth.
     */
    private void queryPurchasesInternal() {
        if (!billingClient.isReady()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchaseList) -> {
            boolean hasPremium = false;
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (Purchase purchase : purchaseList) {
                    if (purchase.getProducts().contains(PRODUCT_ID)
                            && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        // Acknowledge any unacknowledged purchase (safe to call multiple times)
                        if (!purchase.isAcknowledged()) {
                            AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                                .setPurchaseToken(purchase.getPurchaseToken())
                                .build();
                            billingClient.acknowledgePurchase(ackParams, r -> {});
                        }
                        hasPremium = true;
                        break;
                    }
                }
            }
            dispatchToJs("{\"type\":\"PURCHASES_QUERIED\",\"hasPremium\":" + hasPremium + "}");
        });
    }

    /**
     * Acknowledges a purchase and dispatches a billing-result event to JS.
     * Handles the PENDING state separately so the UI can show a waiting message.
     */
    private void handlePurchase(Purchase purchase, String eventType) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.getPurchaseToken())
                    .build();
                billingClient.acknowledgePurchase(params, result -> {
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        dispatchToJs("{\"type\":\"" + eventType + "\",\"hasPremium\":true}");
                    } else {
                        dispatchToJs("{\"type\":\"PURCHASE_ERROR\",\"code\":" + result.getResponseCode() + "}");
                    }
                });
            } else {
                dispatchToJs("{\"type\":\"" + eventType + "\",\"hasPremium\":true}");
            }
        } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            // Payment is processing (e.g. cash payment at store) — not unlocked yet.
            dispatchToJs("{\"type\":\"PURCHASE_PENDING\"}");
        }
    }

    /**
     * Dispatches a CustomEvent('billing-result', { detail }) to the WebView JS
     * context on the UI thread.
     */
    private void dispatchToJs(String jsonDetail) {
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('billing-result',{detail:" + jsonDetail + "}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    // ── JavaScript interface ──────────────────────────────────────────────────

    /**
     * Exposed to JS as window.WarmBilling.
     * Methods are called from a background thread by the WebView — all UI
     * operations must be dispatched to the main thread via runOnUiThread().
     */
    private class WarmBillingInterface {

        /**
         * Query all active INAPP purchases for this user.
         * Result arrives as billing-result { type: 'PURCHASES_QUERIED', hasPremium: bool }.
         * Used on app start and for restore purchases.
         */
        @JavascriptInterface
        public void queryPurchases() {
            if (!billingClient.isReady()) {
                // Try to reconnect; JS will hear a result once connection succeeds.
                connectBillingClient();
                dispatchToJs("{\"type\":\"PURCHASES_QUERIED\",\"hasPremium\":false,\"notReady\":true}");
                return;
            }
            queryPurchasesInternal();
        }

        /**
         * Open the Play Store billing dialog for warm_premium_lifetime.
         * Result arrives as billing-result with type PURCHASE_SUCCESS,
         * PURCHASE_CANCELLED, PURCHASE_PENDING or PURCHASE_ERROR.
         */
        @JavascriptInterface
        public void launchBillingFlow() {
            if (!billingClient.isReady()) {
                connectBillingClient();
                dispatchToJs("{\"type\":\"PURCHASE_ERROR\",\"code\":-1,\"message\":\"Billing not ready\"}");
                return;
            }

            List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
            productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(PRODUCT_ID)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            );
            QueryProductDetailsParams productParams = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

            billingClient.queryProductDetailsAsync(productParams, (billingResult, productDetailsList) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK
                        || productDetailsList.isEmpty()) {
                    dispatchToJs("{\"type\":\"PURCHASE_ERROR\",\"code\":" + billingResult.getResponseCode() + "}");
                    return;
                }
                ProductDetails productDetails = productDetailsList.get(0);
                List<BillingFlowParams.ProductDetailsParams> detailsParamsList = new ArrayList<>();
                detailsParamsList.add(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .build()
                );
                BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(detailsParamsList)
                    .build();
                // launchBillingFlow must run on the UI thread
                runOnUiThread(() -> billingClient.launchBillingFlow(MainActivity.this, flowParams));
            });
        }
    }

    // ── Reload overlay (renderer crash recovery) ──────────────────────────────

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
