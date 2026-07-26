import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warm.app',
  appName: 'Warm',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
  },
  android: {
    minWebViewVersion: 60,
  },
};

export default config;
