package com.leastudio.app;

import android.content.Context;
import android.app.ActivityManager;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

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

    private volatile String dlStatus = "idle";

    @JavascriptInterface
    public String downloadStatus() {
        return dlStatus;
    }

    @JavascriptInterface
    public String downloadPack(String url) {
        dlStatus = "préparation…";
        new Thread(() -> {
            try {
                File dir = new File(ctx.getFilesDir(), "models/sd15");
                if (!dir.exists()) dir.mkdirs();
                String custom = url == null ? "" : url.trim();
                String[][] files;
                if (custom.startsWith("https://")) {
                    files = new String[][]{ { custom, "pack.bin" } };
                } else {
                    files = new String[][]{
                        { "https://github.com/wangzhaode/mnn-stable-diffusion/releases/download/v0.1/text_encoder.mnn", "clip.bin" },
                        { "https://github.com/wangzhaode/mnn-stable-diffusion/releases/download/v0.1/vae_decoder.mnn", "vae_decoder.bin" },
                        { "https://github.com/wangzhaode/mnn-stable-diffusion/releases/download/v0.1/unet.mnn", "unet.bin" }
                    };
                }
                for (int i = 0; i < files.length; i++) {
                    File dest = new File(dir, files[i][1]);
                    if (dest.isFile() && dest.length() > 1024L * 1024L) {
                        dlStatus = "déjà là : " + files[i][1];
                        continue;
                    }
                    downloadOne(files[i][0], dest, i + 1, files.length);
                }
                dlStatus = modelReady() ? "pack OK. Relance Générer en Local." : "téléchargé, fichiers incomplets";
            } catch (Exception e) {
                dlStatus = "échec: " + e.getMessage();
            }
        }).start();
        return "téléchargement lancé";
    }

    private void downloadOne(String src, File dest, int idx, int total) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(src).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(25000);
        c.setReadTimeout(120000);
        c.setRequestProperty("User-Agent", "lea-studio");
        int code = c.getResponseCode();
        if (code >= 300 && code < 400) {
            String loc = c.getHeaderField("Location");
            c.disconnect();
            c = (HttpURLConnection) new URL(loc).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "lea-studio");
        }
        long totalBytes = c.getContentLength();
        InputStream in = c.getInputStream();
        File tmp = new File(dest.getAbsolutePath() + ".part");
        FileOutputStream out = new FileOutputStream(tmp);
        byte[] buf = new byte[65536];
        long n = 0;
        int r;
        while ((r = in.read(buf)) > 0) {
            out.write(buf, 0, r);
            n += r;
            String pct = totalBytes > 0 ? (n * 100 / totalBytes) + "%" : (n / 1024 / 1024) + " Mo";
            dlStatus = "fichier " + idx + "/" + total + " " + dest.getName() + " " + pct;
        }
        out.close();
        in.close();
        if (dest.exists()) dest.delete();
        tmp.renameTo(dest);
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
