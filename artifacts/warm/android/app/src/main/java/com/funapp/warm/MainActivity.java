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
     * Set to true by onStop() — means the app truly went to the background
     * (home button / app switch). Screen-off (power button) never calls onStop,
     * so this stays false for that case. Used in onResume() to pick the right
     * recovery path.
     */
    private boolean appWasStopped = false;

    /**
     * Detects ACTION_SCREEN_OFF, which Android broadcasts BEFORE onPause() when
     * the power button is pressed. We use this to show the dark overlay early —
     * before the WebView surface is paused — so the user never sees a white flash.
     *
     * evaluateJavascript() is asynchronous: even called before super.onPause(),
     * PauseTimers() inside webView.onPause() freezes JS execution before the
     * script can run. Firing native-pause from onPause() is therefore unreliable.
     * Instead we fire it from onResume() where the WebView is guaranteed active.
     */
    private boolean screenOffPending = false;
    private BroadcastReceiver screenStateReceiver;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPlugin.class);
        super.onCreate(savedInstanceState);
        setupReloadOverlay();
        setupBilling();
        setupScreenReceiver();

        WebView wv = this.bridge.getWebView();
        // Keep hardware acceleration as the default — GPU rendering is required for
        // smooth Framer Motion animations and CSS keyframe compositing.
        //
        // LAYER_TYPE_SOFTWARE is switched in dynamically only during the screen-off
        // window (ACTION_SCREEN_OFF → onResume) to prevent GPU texture corruption.
        // See setupScreenReceiver() and onResume() for the switching logic.
        wv.addJavascriptInterface(new WarmBillingInterface(), "WarmBilling");
    }

    /**
     * Tracks when the power button turned the screen off so onResume() can
     * distinguish a screen-off return from a billing-dialog return (both have
     * appWasStopped == false).
     */
    private void setupScreenReceiver() {
        screenStateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    screenOffPending = true;
                    // Switch to software rendering NOW — before onPause() →
                    // webView.onPause() pauses the GPU compositor.  This releases
                    // the GPU texture cleanly.  We switch back to hardware in
                    // onResume() under the dark overlay so the fresh GPU texture
                    // is ready before the user can see it.
                    if (bridge != null) {
                        WebView wv = bridge.getWebView();
                        if (wv != null) wv.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
                    }
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        registerReceiver(screenStateReceiver, filter);
    }

    @Override
    public void onPause() {
        super.onPause();
        // evaluateJavascript is not called here: super.onPause() → webView.onPause()
        // → PauseTimers() freezes JS.  native-pause is fired in onResume() (screen-off)
        // or onStop() (background), where JS timers are guaranteed active.
    }

    /**
     * onStop fires for true background (home / app switch) but NOT for screen-off.
     */
    @Override
    public void onStop() {
        super.onStop();
        appWasStopped = true;
        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                // Call evaluateJavascript DIRECTLY on the main thread — no webView.post().
                //
                // webView.post() enqueues a Runnable on the main-thread message queue.
                // With LAYER_TYPE_SOFTWARE, the WebView draws everything on the CPU/main
                // thread.  When Web Workers are actively burning CPU (heat engine), the
                // main thread is already under pressure; the posted Runnable can be
                // delayed indefinitely — workers keep running into the background,
                // saturate all CPU cores, and on resume the main thread cannot render,
                // making the app appear frozen.
                //
                // Calling evaluateJavascript() directly here stops the workers
                // immediately.  PauseTimers() (called by super.onPause() earlier) freezes
                // setTimeout/setInterval but does NOT block evaluateJavascript() itself,
                // and window.dispatchEvent() is synchronous so the native-pause handler
                // executes inline.
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('native-pause'));", null);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume(); // → webView.onResume() → ResumeTimers() → JS active
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;

        queryPurchasesInternal();

        if (screenOffPending) {
            // Screen-off return.
            // We are currently in LAYER_TYPE_SOFTWARE (set in ACTION_SCREEN_OFF).
            // 1. Show the dark overlay so the user sees nothing while GPU reinits.
            // 2. Fire native-pause to stop any running session.
            // 3. Switch back to LAYER_TYPE_HARDWARE — GPU creates a fresh, clean
            //    texture from the current software bitmap.  The overlay hides the
            //    one or two GPU-warmup frames that might flicker.
            // 4. Hide the overlay after 500 ms — enough for GPU compositing to settle.
            screenOffPending = false;
            if (reloadOverlay != null) {
                reloadOverlay.setAlpha(1f);
                reloadOverlay.setVisibility(View.VISIBLE);
            }
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('native-pause'));", null);
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            webView.postDelayed(this::hideOverlay, 500);
            return;
        }

        if (!appWasStopped) return; // billing dialog / other brief pause — nothing to do
        appWasStopped = false;

        // Safety net: fire native-pause again in case the onStop() evaluateJavascript
        // was lost (e.g. WebView was not yet ready, or the call raced with a reload).
        // stopWith() in JS is idempotent — it guards on runningRef.current.
        // super.onResume() above already called webView.onResume() → ResumeTimers(),
        // so JS timers and evaluateJavascript are fully active at this point.
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('native-pause'));", null);

        // With LAYER_TYPE_SOFTWARE the WebView's content lives in a CPU bitmap that
        // survives background suspension intact — no GPU texture loss, no blank frame.
        // Only reload if the renderer process was actually killed (URL gone blank).
        String url = webView.getUrl();
        if (url == null || url.equals("about:blank") || url.isEmpty()) {
            showOverlayAndReload(webView);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (billingClient != null) billingClient.endConnection();
        if (screenStateReceiver != null) unregisterReceiver(screenStateReceiver);
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
