import { Capacitor, registerPlugin } from '@capacitor/core';

interface ThermalPluginDef {
  getTemperature(): Promise<{ maxTemp: number; available: boolean; zones: number[] }>;
}

const ThermalPlugin = registerPlugin<ThermalPluginDef>('ThermalPlugin');

/** Returns the highest thermal zone temperature in °C, or null when unavailable. */
export async function readDeviceTemp(): Promise<number | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await ThermalPlugin.getTemperature();
    if (!res.available || res.maxTemp <= 0) return null;
    return res.maxTemp;
  } catch {
    return null;
  }
}

export const THERMAL_AVAILABLE = Capacitor.isNativePlatform();
