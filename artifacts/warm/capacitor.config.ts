import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.funapp.warm',
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
