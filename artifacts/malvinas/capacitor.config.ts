import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Unique reverse-domain app identifier for the Play Store
  appId: 'ar.malvinas.distancia',
  appName: 'Distancia a Las Malvinas',

  // Vite build output directory (run `pnpm build:cap` before `cap sync`)
  webDir: 'dist/public',

  server: {
    // Set to true to use the live dev server on a real device (Wi-Fi)
    // Remove or set to false for production APK
    androidScheme: 'https',
  },

  android: {
    // Minimum Android SDK 22 (Android 5.1) — covers ~99 % of devices
    minWebViewVersion: 60,
    buildOptions: {
      keystorePath: undefined,   // set via env or Capacitor Secrets for CI
      keystoreAlias: undefined,
    },
  },

  plugins: {
    // Geolocation — users will be prompted at runtime
    Geolocation: {
      androidPermissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
  },
};

export default config;
