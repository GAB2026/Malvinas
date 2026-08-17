package com.funapp.warm;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

@CapacitorPlugin(name = "ThermalPlugin")
public class ThermalPlugin extends Plugin {

    @PluginMethod
    public void getTemperature(PluginCall call) {
        try {
            File thermalDir = new File("/sys/class/thermal");
            double maxTemp = -1;
            JSArray zones = new JSArray();

            if (thermalDir.exists() && thermalDir.isDirectory()) {
                File[] entries = thermalDir.listFiles();
                if (entries != null) {
                    for (File zone : entries) {
                        if (!zone.getName().startsWith("thermal_zone")) continue;
                        File tempFile = new File(zone, "temp");
                        if (!tempFile.exists() || !tempFile.canRead()) continue;
                        try (BufferedReader br = new BufferedReader(new FileReader(tempFile))) {
                            String raw = br.readLine();
                            if (raw == null) continue;
                            double val = Double.parseDouble(raw.trim());
                            // Most vendors report millidegrees; values > 1000 are millidegrees
                            double tempC = val > 1000 ? val / 1000.0 : val;
                            // Sanity check: plausible device temp range
                            if (tempC < 20 || tempC > 120) continue;
                            zones.put(tempC);
                            if (tempC > maxTemp) maxTemp = tempC;
                        } catch (Exception ignored) {}
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("maxTemp", maxTemp > 0 ? maxTemp : 0);
            result.put("available", maxTemp > 0);
            result.put("zones", zones);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("ThermalPlugin error: " + e.getMessage());
        }
    }
}
