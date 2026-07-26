package ar.malvinas.distancia;

import android.content.Intent;
import android.content.pm.PackageManager;
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
        String pkg       = call.getString("pkg", "");
        String base64    = call.getString("base64", "");
        String mimeType  = call.getString("mimeType", "image/png");
        String text      = call.getString("text", "");

        try {
            // 1. Write image to cache
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            File cacheDir = getContext().getCacheDir();
            File imgFile  = new File(cacheDir, "malvinas-share-" + System.currentTimeMillis() + ".png");
            FileOutputStream fos = new FileOutputStream(imgFile);
            fos.write(bytes);
            fos.close();

            // 2. Get content:// URI via FileProvider (includes FLAG_GRANT_READ_URI_PERMISSION)
            Uri contentUri = FileProvider.getUriForFile(getContext(), AUTHORITY, imgFile);

            // 3. Build ACTION_SEND intent
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType(mimeType);
            sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // 4. Target specific package if installed; otherwise show chooser
            PackageManager pm = getContext().getPackageManager();
            boolean pkgInstalled = false;
            if (pkg != null && !pkg.isEmpty()) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    pkgInstalled = true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }

            Intent launchIntent;
            if (pkgInstalled) {
                sendIntent.setPackage(pkg);
                launchIntent = sendIntent;
            } else {
                launchIntent = Intent.createChooser(sendIntent, "Compartir imagen");
            }

            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(launchIntent);
            call.resolve();

        } catch (Exception e) {
            call.reject("Error al compartir: " + e.getMessage(), e);
        }
    }
}
