package be.misealeau.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Coquille Android : affiche le site « Mise à l'eau » en plein écran. */
public class MainActivity extends Activity {
    private static final String HOME = "https://skycrow2-cloud.github.io/kayak-wallonie/";
    private static final int REQ_LOC = 1;
    private WebView web;
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0e1217"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.toString().startsWith(HOME)) return false;
                // liens extérieurs (sources, crédits, itinéraires) : navigateur ou app dédiée
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    cb.invoke(origin, true, false);
                } else {
                    geoOrigin = origin; geoCallback = cb;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
                }
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(getIntent().getData() != null ? getIntent().getData().toString() : HOME);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (code == REQ_LOC && geoCallback != null) {
            boolean ok = false;
            for (int r : res) ok |= r == PackageManager.PERMISSION_GRANTED;
            geoCallback.invoke(geoOrigin, ok, false);
            geoCallback = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
