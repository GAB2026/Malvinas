package ar.malvinas.distancia;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "ShareDirect")
public class ShareDirectPlugin extends Plugin {

    private static final String AUTHORITY = "ar.malvinas.distancia.fileprovider";

    @PluginMethod
    public void share(PluginCall call) {
        String pkg      = call.getString("pkg", "");
        String base64   = call.getString("base64", "");
        String mimeType = call.getString("mimeType", "image/png");
        String text     = call.getString("text", "");

        try {
            // 1. Decode & write PNG to app cache
            byte[] bytes  = Base64.decode(base64, Base64.DEFAULT);
            File cacheDir = getActivity().getCacheDir();
            File imgFile  = new File(cacheDir, "malvinas-" + System.currentTimeMillis() + ".png");
            try (FileOutputStream fos = new FileOutputStream(imgFile)) {
                fos.write(bytes);
            }

            // 2. Get content:// URI via FileProvider
            Uri contentUri = FileProvider.getUriForFile(getActivity(), AUTHORITY, imgFile);

            // 3. Build ACTION_SEND intent
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType(mimeType);
            sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);

            // CRITICAL FIX for Android 10+ (strictly enforced on Android 16):
            // FLAG_GRANT_READ_URI_PERMISSION over EXTRA_STREAM alone does NOT
            // propagate FileProvider read access to the receiving app.
            // The permission grant is tied to ClipData — without it, the target
            // app receives the URI but gets SecurityException when trying to open it.
            sendIntent.setClipData(ClipData.newRawUri("", contentUri));
            sendIntent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION  |
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_ACTIVITY_NEW_TASK
            );

            // WhatsApp muestra EXTRA_TEXT como caption — lo omitimos para esa app
            if (!"com.whatsapp".equals(pkg)) {
                sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            }

            if (pkg != null && !pkg.isEmpty()) {
                sendIntent.setPackage(pkg);
            }

            // 4. Try to open the specific app directly
            try {
                getActivity().startActivity(sendIntent);
                call.resolve();
            } catch (ActivityNotFoundException | SecurityException e) {
                // Fallback 1: para WhatsApp, intentar deep link de texto sin imagen.
                if ("com.whatsapp".equals(pkg)) {
                    try {
                        String encoded = Uri.encode(text);
                        Intent waIntent = new Intent(Intent.ACTION_VIEW,
                            Uri.parse("whatsapp://send?text=" + encoded));
                        waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(waIntent);
                        call.resolve();
                        return;
                    } catch (ActivityNotFoundException | SecurityException ex) {
                        // WhatsApp no instalado — caer al chooser genérico
                    }
                }
                // Fallback 2: chooser genérico sin restricción de paquete
                sendIntent.setPackage(null);
                Intent chooser = Intent.createChooser(sendIntent, "Compartir imagen");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(chooser);
                call.resolve();
            }

        } catch (Exception e) {
            call.reject("ShareDirect error: " + e.getMessage(), e);
        }
    }
}
