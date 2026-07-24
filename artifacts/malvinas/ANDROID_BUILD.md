# Guía de compilación — APK Android

## Estado actual del proyecto

El directorio `android/` **ya está generado y listo** con:

| Componente | Estado |
|---|---|
| Proyecto Android (Gradle) | ✅ Generado con `cap add android` |
| App ID | `ar.malvinas.distancia` |
| App Name | `Distancia a Las Malvinas` |
| Web assets sincronizados | ✅ Build de producción en `assets/public/` |
| Permisos de ubicación | ✅ `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` |
| Íconos del launcher | ✅ mdpi → xxxhdpi + adaptive icon (API 26+) |
| GitHub Actions workflow | ✅ `.github/workflows/build-apk.yml` |

---

## Opción A — GitHub Actions (recomendada, sin instalar nada)

1. Conectá este repo a GitHub (Git → Push)
2. Entrá a **GitHub → Actions → Build Android APK**
3. Hacé click en **Run workflow**
4. Al terminar, descargá el APK desde la sección **Artifacts**

El workflow corre automáticamente con cada push a `main` que modifique archivos en `artifacts/malvinas/`.

---

## Opción B — Android Studio local

### Requisitos

| Herramienta | Versión |
|---|---|
| Java JDK | 17 (Temurin recomendado) |
| Android Studio | Hedgehog o superior |
| Android SDK | API 34 (via SDK Manager) |

### Pasos

```bash
# 1. Clonar / abrir el repo localmente
cd artifacts/malvinas

# 2. Instalar dependencias
pnpm install

# 3. Build web para Capacitor
pnpm build:cap          # equivale a: PORT=3000 BASE_PATH=/ vite build

# 4. Sincronizar assets hacia android/
pnpm cap:sync           # equivale a: npx cap sync android

# 5. Abrir en Android Studio
pnpm cap:open           # equivale a: npx cap open android
```

En Android Studio: **Build → Generate Signed Bundle / APK → APK**

Para APK de debug rápido desde terminal (necesita Android SDK en PATH):
```bash
pnpm android:apk        # equivale a: cd android && ./gradlew assembleDebug
# APK en: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo Vite |
| `pnpm build:cap` | Build web con `base: /` para Capacitor |
| `pnpm cap:sync` | Sincroniza web assets → android/ |
| `pnpm cap:open` | Abre Android Studio |
| `pnpm cap:run` | Lanza en emulador/dispositivo conectado |
| `pnpm android:icons` | Regenera íconos del launcher |
| `pnpm android:apk` | Compila debug APK con Gradle |
| `pnpm gen-icons` | Regenera íconos PWA (public/) |

---

## Flujo de actualización (después del desarrollo inicial)

```bash
# Cada vez que cambia el código de la app:
pnpm build:cap
pnpm cap:sync
# Luego compilar con Android Studio o Gradle
```

---

## Publicar en Play Store

1. Generá un keystore firmado:
```bash
keytool -genkey -v -keystore malvinas-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias malvinas
```

2. En `android/app/build.gradle`, configurá el signingConfig con el keystore.

3. Build: **Build → Generate Signed Bundle → Android App Bundle (.aab)**

4. Subí el `.aab` a [Google Play Console](https://play.google.com/console)

---

## Permisos declarados

| Permiso | Motivo |
|---|---|
| `INTERNET` | Geolocalización por IP, Nominatim reverse geocoding |
| `ACCESS_FINE_LOCATION` | GPS preciso |
| `ACCESS_COARSE_LOCATION` | GPS aproximado (fallback) |
| `WRITE_EXTERNAL_STORAGE` (≤ API 28) | Guardar historia PNG en Descargas |
