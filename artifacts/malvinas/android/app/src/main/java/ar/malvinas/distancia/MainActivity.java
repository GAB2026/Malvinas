package ar.malvinas.distancia;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareDirectPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
