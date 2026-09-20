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
    private boolean nativeOk;

    public LeaBridge(Context ctx) {
        this.ctx = ctx.getApplicationContext();
        // Ne pas charger MNN au démarrage : évite un crash au lancement si .so absente / incompatible.
        nativeOk = false;
    }

    public native String nativeSd(String prompt, String modelDir, String outPath);

    private synchronized boolean ensureNative() {
        if (nativeOk) return true;
        try {
            System.loadLibrary("MNN");
            System.loadLibrary("lea_local");
            nativeOk = true;
            return true;
        } catch (Throwable t) {
            nativeOk = false;
            return false;
        }
    }

    /** Enregistre une image (data URL ou base64) sur disque. Retourne une clé gallery:… stable. */
    @JavascriptInterface
    public String saveGalleryImage(String charId, String dataUrl) {
        try {
            if (charId == null || charId.isEmpty()) charId = "lea";
            if (dataUrl == null || dataUrl.length() < 32) return "";
            String b64 = dataUrl;
            int comma = dataUrl.indexOf(',');
            if (dataUrl.startsWith("data:") && comma > 0) b64 = dataUrl.substring(comma + 1);
            byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            if (bytes == null || bytes.length < 100) return "";
            File dir = new File(ctx.getFilesDir(), "gallery/" + charId);
            if (!dir.exists()) dir.mkdirs();
            String name = "g" + System.currentTimeMillis() + ".jpg";
            File out = new File(dir, name);
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(bytes);
            fos.close();
            return "gallery:" + charId + "/" + name;
        } catch (Exception e) {
            return "";
        }
    }

    /** Lit une clé gallery:… → data URL jpeg. */
    @JavascriptInterface
    public String loadGalleryImage(String key) {
        try {
            if (key == null || !key.startsWith("gallery:")) return "";
            String rel = key.substring("gallery:".length());
            File f = new File(ctx.getFilesDir(), "gallery/" + rel);
            if (!f.isFile() || f.length() < 100) return "";
            byte[] bytes = new byte[(int) f.length()];
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            int n = in.read(bytes);
            in.close();
            if (n <= 0) return "";
            String b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
            return "data:image/jpeg;base64," + b64;
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public void deleteGalleryImage(String key) {
        try {
            if (key == null || !key.startsWith("gallery:")) return;
            String rel = key.substring("gallery:".length());
            File f = new File(ctx.getFilesDir(), "gallery/" + rel);
            if (f.isFile()) f.delete();
        } catch (Exception ignored) {}
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
            o.put("nativeOk", nativeOk);
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

    private volatile boolean localBusy = false;
    private volatile String localJson = "{\"pending\":true}";

    @JavascriptInterface
    public String localStatus() {
        return localJson;
    }

    @JavascriptInterface
    public String localGenerate(String prompt) {
        // MNN natif provoque un SIGSEGV/OOM qui tue tout le process Android
        // (non catchable en Java). On n'appelle plus nativeSd tant que le
        // pipeline n'est pas stabilisé. Horde reste le moteur fiable.
        try {
            JSONObject o = new JSONObject();
            o.put("error", "Local MNN désactivé : crash natif sur cet appareil. Utilise Horde (cloud).");
            o.put("modelReady", modelReady());
            o.put("nativeOk", false);
            o.put("done", true);
            return o.toString();
        } catch (Exception e) {
            return "{\"error\":\"Local indisponible\",\"done\":true}";
        }
    }

    private String ppmToJpegDataUrl(File ppm) {
        try {
            java.io.BufferedInputStream in = new java.io.BufferedInputStream(new java.io.FileInputStream(ppm));
            // Skip P6 header
            StringBuilder hdr = new StringBuilder();
            int b;
            int newlines = 0;
            while ((b = in.read()) != -1) {
                hdr.append((char) b);
                if (b == '\n') {
                    newlines++;
                    // P6\nW H\n255\n → 3 lines after optional comments
                    String h = hdr.toString();
                    if (h.contains("255") && newlines >= 3) break;
                }
            }
            String[] parts = hdr.toString().trim().split("\\s+");
            int w = 0, h = 0;
            for (int i = 0; i < parts.length; i++) {
                if (parts[i].equals("P6") && i + 2 < parts.length) {
                    w = Integer.parseInt(parts[i + 1]);
                    h = Integer.parseInt(parts[i + 2]);
                    break;
                }
            }
            if (w <= 0 || h <= 0 || w > 2048 || h > 2048) {
                in.close();
                return null;
            }
            byte[] rgb = new byte[w * h * 3];
            int off = 0;
            while (off < rgb.length) {
                int r = in.read(rgb, off, rgb.length - off);
                if (r < 0) break;
                off += r;
            }
            in.close();
            android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888);
            int[] pixels = new int[w * h];
            for (int i = 0; i < w * h; i++) {
                int o = i * 3;
                int R = rgb[o] & 0xff, G = rgb[o + 1] & 0xff, B = rgb[o + 2] & 0xff;
                pixels[i] = 0xff000000 | (R << 16) | (G << 8) | B;
            }
            bmp.setPixels(pixels, 0, w, 0, 0, w, h);
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, baos);
            bmp.recycle();
            String b64 = android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
            return "data:image/jpeg;base64," + b64;
        } catch (Exception e) {
            return null;
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

    private void ensureAliases(File dir) {
        alias(new File(dir, "clip.bin"), new File(dir, "text_encoder.mnn"));
        alias(new File(dir, "unet.bin"), new File(dir, "unet.mnn"));
        alias(new File(dir, "vae_decoder.bin"), new File(dir, "vae_decoder.mnn"));
        copyAsset("sd15res/alphas.txt", new File(dir, "alphas.txt"));
        copyAsset("sd15res/vocab.txt", new File(dir, "vocab.txt"));
    }

    private void alias(File src, File dst) {
        if (!src.isFile() || (dst.isFile() && dst.length() == src.length())) return;
        try {
            java.nio.file.Files.copy(src.toPath(), dst.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception ignored) {}
    }

    private void copyAsset(String name, File dst) {
        if (dst.isFile() && dst.length() > 100) return;
        try (InputStream in = ctx.getAssets().open(name); FileOutputStream out = new FileOutputStream(dst)) {
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
        } catch (Exception ignored) {}
    }

    private long availableMb() {
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        if (am != null) am.getMemoryInfo(mi);
        return mi.availMem / (1024 * 1024);
    }
}
