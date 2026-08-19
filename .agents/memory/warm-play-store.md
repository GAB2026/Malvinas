---
name: Warm Play Store
description: Play Store configuration and assets for the Warmie app on Google Play.
---

## App identity
- **Package:** `com.funapp.warm`
- **App name (store):** `Warmie`
- **Developer:** FunApp SAS
- **Contact email:** `sasfunapp@gmail.com`
- **Category:** Salud y bienestar
- **Target age:** 18+, restricted to minors

## Privacy policy
URL: `https://gab2026.github.io/Malvinas/warm-privacy.html`
Source: `docs/warm-privacy.html` in repo root (served via GitHub Pages from `/docs` on `main`).

## Generated assets (in attached_assets/)
- `warmie-icon-512.png` — 512×512 app icon
- `warmie-feature-graphic.png` — 1024×500 feature graphic

## In-app product
- ID: `warm_premium_lifetime`
- Type: Compra única (one-time)
- Price: USD 4.99
- Status: must be created in Play Console → Monetización → Productos integrados

## Play Store setup status (as of v3.50)
Completed: Política de privacidad ✓, Clasificación de contenido ✓, Público objetivo ✓, Seguridad de datos ✓, Contenido de la app ✓, Categoría ✓
Pending: Ficha completa (screenshots), Precios/distribución, Subir AAB a Prueba Interna, Crear producto IAP

## Internal billing verification
An internal tester completed the one-time Premium purchase with Google Play's always-approves test card and received no charge.

**Why:** This confirms the active product configuration and the app's Billing bridge work together in the Play-distributed build.

**How to apply:** Test purchases must use the Play internal-testing installation and an account included in license testing. After a successful purchase, Premium should remain unlocked across all duration buttons.

## Premium paywall wording
When the paywall copy is next revised, describe the benefit as “Sesiones de 5, 10 y 15 minutos” rather than “Intensidad Media y Alta”.

**Why:** Premium now unlocks the three session durations; intensity wording does not describe the entitlement clearly.

**How to apply:** Update the localized Premium benefit text while retaining the unlimited-therapies benefit.

## Signing for the first internal bundle
Google Play App Signing is enabled. The Play Console showed no upload-key certificate because no application bundle had yet been uploaded, so a new upload key was created for the first AAB.

**Why:** The Google-managed app-signing key is the identity users receive from Play; the separately held upload key only authorizes uploads and can be reset if needed.

**How to apply:** Upload a release AAB through the internal-testing track. A device with a QR-installed debug APK must uninstall it before installing the Play-distributed build because their signatures differ. Do not change the Google-managed app-signing key.
