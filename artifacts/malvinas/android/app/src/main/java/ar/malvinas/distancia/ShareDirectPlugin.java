package ar.malvinas.distancia;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
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
            byte[] bytes   = Base64.decode(base64, Base64.DEFAULT);
            File cacheDir  = getActivity().getCacheDir();
            File imgFile   = new File(cacheDir, "malvinas-share-" + System.currentTimeMillis() + ".png");
            FileOutputStream fos = new FileOutputStream(imgFile);
            fos.write(bytes);
            fos.close();

            // 2. Get content:// URI via FileProvider
            Uri contentUri = FileProvider.getUriForFile(getActivity(), AUTHORITY, imgFile);

            // 3. Build share intent
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType(mimeType);
            sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // 4. Check if target package is installed
            boolean pkgInstalled = false;
            if (pkg != null && !pkg.isEmpty()) {
                try {
                    getActivity().getPackageManager().getPackageInfo(pkg, 0);
                    pkgInstalled = true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }

            if (pkgInstalled) {
                // Direct open — no chooser
                sendIntent.setPackage(pkg);
                try {
                    getActivity().startActivity(sendIntent);
                    call.resolve();
                } catch (ActivityNotFoundException e) {
                    // Package found but can't handle this intent — try chooser
                    sendIntent.setPackage(null);
                    Intent chooser = Intent.createChooser(sendIntent, "Compartir imagen");
                    getActivity().startActivity(chooser);
                    call.resolve();
                }
            } else {
                // App not installed — show chooser so user picks something
                Intent chooser = Intent.createChooser(sendIntent, "Compartir imagen");
                getActivity().startActivity(chooser);
                call.resolve();
            }

        } catch (Exception e) {
            call.reject("ShareDirect error: " + e.getMessage(), e);
        }
    }
}
