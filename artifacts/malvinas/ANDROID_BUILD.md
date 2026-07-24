# Guía de empaquetado — APK para Android

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18 |
| pnpm | 8 |
| Java JDK | 17 |
| Android Studio | Hedgehog o superior |
| Android SDK | API 33 (instalado via SDK Manager) |

## Pasos — primera vez

```bash
# 1. Instalar dependencias (si no están instaladas)
cd artifacts/malvinas
pnpm install

# 2. Agregar el plugin Android de Capacitor
pnpm add -D @capacitor/android

# 3. Inicializar Capacitor (solo la primera vez)
npx cap init "Distancia a Las Malvinas" "ar.malvinas.distancia" --web-dir dist/public

# 4. Agregar la plataforma Android (solo la primera vez)
npx cap add android
```

## Build y sincronización (cada actualización)

```bash
# 1. Compilar la web app con base path raíz (necesario para Capacitor)
pnpm build:cap

# 2. Sincronizar assets y plugins hacia la carpeta android/
npx cap sync android

# 3. Abrir en Android Studio para firmar y generar el APK
npx cap open android
```

En Android Studio: **Build → Generate Signed Bundle / APK → APK**

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo Vite |
| `pnpm build` | Build web (usa BASE_PATH del entorno) |
| `pnpm build:cap` | Build listo para Capacitor (`base: /`) |
| `pnpm cap:sync` | `npx cap sync android` |
| `pnpm cap:open` | Abre Android Studio |
| `pnpm cap:run` | Lanza en emulador/dispositivo conectado |

## Live-reload en dispositivo físico (Wi-Fi)

```bash
# En vite.config.ts la opción `server.host: '0.0.0.0'` ya está activa
# En capacitor.config.ts, agrega temporalmente:
#   server: { url: 'http://<TU-IP-LOCAL>:PUERTO', cleartext: true }
# Luego:
npx cap run android
```

## Permisos declarados automáticamente

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — GPS
- `INTERNET` — geolocalización por IP y reverse geocoding
- `WRITE_EXTERNAL_STORAGE` — descarga de la historia PNG (Android ≤ 9)

## Íconos y splash screen

Los íconos generados en `public/` deben copiarse a `android/app/src/main/res/`.  
Usá [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html)
con el archivo `public/icon-512.png` como fuente para generar los tamaños mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi.

## Publicar en Play Store

1. Generá una **keystore** firmada:
   ```bash
   keytool -genkey -v -keystore malvinas.jks -keyalg RSA \
     -keysize 2048 -validity 10000 -alias malvinas
   ```
2. En Android Studio: Build → Generate Signed Bundle → **Android App Bundle (.aab)**
3. Subí el `.aab` a [Google Play Console](https://play.google.com/console)
