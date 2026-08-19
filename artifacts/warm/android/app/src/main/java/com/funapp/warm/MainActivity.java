package com.funapp.warm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
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
     * Google Play Billing opens an external Activity.  It is not an app exit,
     * so lifecycle callbacks from that flow must never finish Warm.
     */
    private volatile boolean billingFlowInProgress = false;
    private volatile boolean sessionActive = false;
    private boolean finishPending = false;
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
     * When a session is active we must close the Activity here (not in
     * onStop) because stopSessionThenFinish() dispatches a CustomEvent to JS
     * that needs the JS engine still running.  If we wait until onStop, the
     * WebView timers are already paused and the event may not be delivered
     * reliably.  Closing from onPause (before super) keeps the engine hot for
     * the teardown event while still finalising the Activity.
     */
    @Override
    public void onPause() {
        if (!billingFlowInProgress && !finishPending) {
            if (sessionActive) {
                // Session running — close the Activity.  Dispatch native-pause
                // while JS timers are still active so React can clean up state
                // before finishAndRemoveTask() is called.
                stopSessionThenFinish();
            } else {
                // No active session — notify JS (no-op if nothing is running).
                dispatchNativePause();
            }
        }
        super.onPause();
    }

    /**
     * Fallback close in case onPause did not catch a session (e.g. if
     * sessionActive was set between onPause and onStop).  finishPending guards
     * against a double close.
     */
    @Override
    public void onStop() {
        super.onStop();
        if (!billingFlowInProgress && sessionActive && !finishPending) {
            stopSessionThenFinish();
        }
    }

    /**
     * There is no renderer-recovery path on resume.  A screen-off closes the
     * Activity below, and every true background transition closes it from
     * onStop. The next launch consequently starts with a fresh WebView.
     */
    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;

        // Re-query billing — catches purchases finalised in Play Store dialog.
        queryPurchasesInternal();

    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (billingClient != null) billingClient.endConnection();
        if (screenOffReceiver != null) unregisterReceiver(screenOffReceiver);
    }

    /**
     * A screen-off is terminal for a Warm session.  Stop the session while JS
     * still runs, then finish the Activity.  This avoids any screen-on attempt
     * to reuse the previous WebView's GPU texture.
     */
    private void setupScreenOffReceiver() {
        screenOffReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) return;
                if (!billingFlowInProgress && sessionActive) stopSessionThenFinish();
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenOffReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenOffReceiver, filter);
        }
    }

    /**
     * Stop the session before destroying its WebView.  The JavaScript event
     * handler runs synchronously once evaluated, so its callback is the normal
     * completion path.  A short fallback covers renderer callbacks that never
     * arrive after an Android lifecycle transition.
     */
    private void stopSessionThenFinish() {
        if (isFinishing() || finishPending) return;
        finishPending = true;
        if (bridge == null || bridge.getWebView() == null) {
            finishAfterSessionStop();
            return;
        }
        WebView webView = bridge.getWebView();
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('native-pause'));",
            ignored -> finishAfterSessionStop()
        );
        getWindow().getDecorView().postDelayed(() -> {
            finishAfterSessionStop();
        }, 500);
    }

    private void finishAfterSessionStop() {
        if (isFinishing() || !finishPending) return;
        if (billingFlowInProgress) {
            return;
        }
        finishPending = false;
        finishAndRemoveTask();
    }

    private void clearBillingFlow() {
        runOnUiThread(() -> {
            billingFlowInProgress = false;
            // If the user left while an external Play Activity was active,
            // complete that deferred foreground-only shutdown now.
            finishAfterSessionStop();
        });
    }

    private void dispatchNativePause() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('native-pause'));",
            null
        );
    }

    // ── Billing setup ─────────────────────────────────────────────────────────

    private void setupBilling() {
        PurchasesUpdatedListener purchasesUpdatedListener = (billingResult, purchases) -> {
            clearBillingFlow();
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
         * Called by JS whenever the session running state changes.
         * Controls whether background/screen-off events close the Activity.
         */
        @JavascriptInterface
        public void notifySessionState(boolean active) {
            sessionActive = active;
        }

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
            if (billingFlowInProgress) return;
            if (!billingClient.isReady()) {
                connectBillingClient();
                dispatchToJs("{\"type\":\"PURCHASE_ERROR\",\"code\":-1,\"message\":\"Billing not ready\"}");
                return;
            }
            // Protect the entire async product lookup and the external Play
            // Activity from the foreground-only shutdown lifecycle.
            billingFlowInProgress = true;

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
                    clearBillingFlow();
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
                // launchBillingFlow must run on the UI thread. Its external
                // Play Activity is not a user-initiated exit from Warm.
                runOnUiThread(() -> {
                    BillingResult launchResult =
                        billingClient.launchBillingFlow(MainActivity.this, flowParams);
                    if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        clearBillingFlow();
                        dispatchToJs("{\"type\":\"PURCHASE_ERROR\",\"code\":"
                            + launchResult.getResponseCode() + "}");
                    }
                });
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
