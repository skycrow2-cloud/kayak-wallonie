package be.misealeau.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/** Widget « Mise à l'eau » : rivières suivies (★) ou, à défaut, parcours ouverts. Aussi sur l'écran externe du Razr. */
public class KayakWidget extends AppWidgetProvider {
    static final String URL_JSON = "https://skycrow2-cloud.github.io/kayak-wallonie/widget.json";
    static final String PREFS = "kayak";
    private static final int[] ROW = {R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5};
    private static final int[] DOT = {R.id.dot0, R.id.dot1, R.id.dot2, R.id.dot3, R.id.dot4, R.id.dot5};
    private static final int[] NAME = {R.id.name0, R.id.name1, R.id.name2, R.id.name3, R.id.name4, R.id.name5};
    private static final int[] STATE = {R.id.state0, R.id.state1, R.id.state2, R.id.state3, R.id.state4, R.id.state5};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) { draw(ctx); refresh(ctx, goAsync()); }

    @Override
    public void onReceive(Context ctx, Intent i) {
        super.onReceive(ctx, i);
        if ("be.misealeau.app.REFRESH".equals(i.getAction())) refresh(ctx, goAsync());
    }

    /** Relit widget.json (en arrière-plan) puis redessine tous les widgets. */
    static void refresh(Context ctx, final BroadcastReceiver.PendingResult done) {
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            SharedPreferences p = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(URL_JSON + "?t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(8000); c.setReadTimeout(8000); c.setUseCaches(false);
                if (c.getResponseCode() == 200) {
                    InputStream in = c.getInputStream(); ByteArrayOutputStream b = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                    p.edit().putString("json", b.toString("UTF-8")).apply();
                }
                c.disconnect();
            } catch (Exception ignored) { /* hors ligne : on garde la dernière copie */ }
            draw(app);
            if (done != null) done.finish();
        }).start();
    }

    static void draw(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, KayakWidget.class));
        if (ids.length == 0) return;
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget);

        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        try {
            JSONObject d = new JSONObject(p.getString("json", "{}"));
            JSONArray all = d.optJSONArray("troncons");
            if (all == null) { v.setTextViewText(R.id.summary, "Pas encore de données"); mgr.updateAppWidget(ids, v); return; }

            Set<String> favs = new HashSet<>();
            try { JSONArray f = new JSONArray(p.getString("favs", "[]")); for (int i = 0; i < f.length(); i++) favs.add(f.getString(i)); } catch (Exception ignored) {}

            List<JSONObject> rows = new ArrayList<>();
            for (int i = 0; i < all.length(); i++) { JSONObject t = all.getJSONObject(i); if (favs.contains(t.optString("id"))) rows.add(t); }
            boolean suivies = !rows.isEmpty();
            if (!suivies) for (int i = 0; i < all.length(); i++) { JSONObject t = all.getJSONObject(i); String k = t.optString("k"); if (k.equals("ouvert") || k.equals("risque")) rows.add(t); }

            int ouv = d.optInt("ouverts"), tot = d.optInt("total");
            v.setTextViewText(R.id.summary, ouv + " ouvert" + (ouv > 1 ? "s" : "") + " sur " + tot + (suivies ? " · ★ suivies" : ""));
            v.setTextViewText(R.id.maj, heure(d.optString("maj")));

            for (int i = 0; i < ROW.length; i++) {
                if (i < rows.size()) {
                    JSONObject t = rows.get(i); int col = couleur(t.optString("k"));
                    v.setViewVisibility(ROW[i], android.view.View.VISIBLE);
                    v.setTextColor(DOT[i], col);
                    v.setTextViewText(NAME[i], t.optString("riviere") + (t.optString("region").equals("Wallonie") ? "" : " · " + t.optString("region")));
                    v.setTextViewText(STATE[i], t.optString("label")); v.setTextColor(STATE[i], col);
                } else v.setViewVisibility(ROW[i], android.view.View.GONE);
            }
        } catch (Exception e) {
            v.setTextViewText(R.id.summary, "Données illisibles");
        }
        mgr.updateAppWidget(ids, v);
    }

    static int couleur(String k) {
        switch (k) {
            case "ouvert": return Color.parseColor("#4cc38a");
            case "risque": return Color.parseColor("#f2c94c");
            case "possible": return Color.parseColor("#49b6c4");
            case "saison": return Color.parseColor("#5d6672");
            case "info": return Color.parseColor("#a99be0");
            default: return Color.parseColor("#8b93a1");
        }
    }

    static String heure(String iso) {
        try {
            SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT); in.setTimeZone(TimeZone.getTimeZone("UTC"));
            SimpleDateFormat out = new SimpleDateFormat("HH:mm", Locale.FRANCE);
            return out.format(in.parse(iso.substring(0, 19)));
        } catch (Exception e) { return ""; }
    }

}
