package com.leastudio.app;

import android.content.Context;
import android.app.ActivityManager;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.io.File;

/**
 * Pont JS ↔ natif.
 * Local SD 1.5 : le pack (clip/unet/vae) doit être dans filesDir/models/sd15/.
 * Tant que le pack n'est pas là, on renvoie une erreur claire au lieu de
 * lancer une inférence qui ferait chauffer / planter le téléphone.
 */
public class LeaBridge {
    private final Context ctx;

    public LeaBridge(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    @JavascriptInterface
    public String deviceInfo() {
        try {
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            if (am != null) am.getMemoryInfo(mi);
            JSONObject o = new JSONObject();
            o.put("ramMb", mi.totalMem / (1024 * 1024));
            o.put("availMb", mi.availMem / (1024 * 1024));
            o.put("lowRam", am != null && am.isLowRamDevice());
            o.put("modelReady", modelReady());
            return o.toString();
        } catch (Exception e) {
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    @JavascriptInterface
    public String localGenerate(String prompt) {
        try {
            JSONObject o = new JSONObject();
            if (!modelReady()) {
                o.put("error", "Pack SD 1.5 absent. Copie clip/unet/vae dans Android/data/com.leastudio.app/files/models/sd15/ (environ 1–2 Go). En attendant, utilise Horde.");
                o.put("modelReady", false);
                return o.toString();
            }
            long avail = availableMb();
            if (avail < 1800) {
                o.put("error", "Pas assez de RAM libre (" + avail + " Mo). Ferme des apps ou reste sur Horde.");
                return o.toString();
            }
            // Moteur natif SD à brancher ici (NCNN / MNN). On ne lance pas
            // d'inférence lourde tant que le runtime n'est pas lié.
            o.put("error", "Pack détecté, runtime NCNN/MNN pas encore lié dans cette build. Horde reste actif.");
            o.put("modelReady", true);
            return o.toString();
        } catch (Exception e) {
            return "{\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
        }
    }

    private boolean modelReady() {
        File dir = new File(ctx.getFilesDir(), "models/sd15");
        if (!dir.isDirectory()) return false;
        String[] need = {"unet.bin", "vae_decoder.bin", "clip.bin"};
        for (String n : need) {
            File f = new File(dir, n);
            if (!f.isFile() || f.length() < 1024 * 1024) return false;
        }
        return true;
    }

    private long availableMb() {
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        if (am != null) am.getMemoryInfo(mi);
        return mi.availMem / (1024 * 1024);
    }
}
