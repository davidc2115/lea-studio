package com.leastudio.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.app.ActivityManager;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

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

    private static final String LOCAL_DREAM_PKG = "io.github.xororz.localdream";

    @JavascriptInterface
    public String isLocalDreamInstalled() {
        try {
            ctx.getPackageManager().getPackageInfo(LOCAL_DREAM_PKG, 0);
            return "{\"installed\":true,\"package\":\"" + LOCAL_DREAM_PKG + "\"}";
        } catch (Exception e) {
            return "{\"installed\":false}";
        }
    }

    /** Ouvre Local Dream, ou le Play Store / GitHub si absent. */
    @JavascriptInterface
    public String openLocalDream() {
        try {
            PackageManager pm = ctx.getPackageManager();
            Intent launch = pm.getLaunchIntentForPackage(LOCAL_DREAM_PKG);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(launch);
                return "{\"ok\":true,\"action\":\"launch\"}";
            }
            Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + LOCAL_DREAM_PKG));
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                ctx.startActivity(market);
                return "{\"ok\":true,\"action\":\"playstore\"}";
            } catch (Exception e) {
                Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + LOCAL_DREAM_PKG));
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(web);
                return "{\"ok\":true,\"action\":\"web\"}";
            }
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
        }
    }

    /**
     * API officielle Local Dream : 127.0.0.1:8081 POST /generate (SSE).
     * Prérequis : Local Dream ouvert + modèle chargé (le backend démarre après).
     * complete.image = RGB brut base64 → JPEG.
     */
    @JavascriptInterface
    public String localDreamGenerate(String prompt) {
        final String p = prompt == null ? "a woman" : prompt;
        try {
            JSONObject body = new JSONObject();
            body.put("prompt", p);
            body.put("negative_prompt", "child, teen, underage, cartoon, anime, deformed, blurry, low quality");
            body.put("steps", 20);
            body.put("cfg", 7.5);
            body.put("width", 512);
            body.put("height", 512);
            body.put("size", 512);
            body.put("scheduler", "euler_a");
            byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);

            HttpURLConnection post = (HttpURLConnection) new URL("http://127.0.0.1:8081/generate").openConnection();
            post.setConnectTimeout(3000);
            post.setReadTimeout(300000);
            post.setRequestMethod("POST");
            post.setDoOutput(true);
            post.setRequestProperty("Content-Type", "application/json");
            post.setRequestProperty("Accept", "text/event-stream");
            OutputStream os = post.getOutputStream();
            os.write(payload);
            os.close();

            int pc = post.getResponseCode();
            InputStream in = (pc >= 200 && pc < 300) ? post.getInputStream() : post.getErrorStream();
            if (in == null) {
                post.disconnect();
                return ldFail("HTTP " + pc + " sans corps. Ouvre Local Dream, charge un modèle, réessaie.");
            }

            BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            String currentEvent = "";
            StringBuilder dataBuf = new StringBuilder();
            String completeJson = null;
            String errorMsg = null;

            while ((line = br.readLine()) != null) {
                if (line.startsWith("event:")) {
                    currentEvent = line.substring(6).trim();
                    dataBuf.setLength(0);
                } else if (line.startsWith("data:")) {
                    String d = line.substring(5).trim();
                    if (dataBuf.length() > 0) dataBuf.append('\n');
                    dataBuf.append(d);
                } else if (line.isEmpty() && dataBuf.length() > 0) {
                    String data = dataBuf.toString();
                    dataBuf.setLength(0);
                    if ("complete".equals(currentEvent) || data.contains("\"type\":\"complete\"")) {
                        completeJson = data;
                        break;
                    }
                    if ("error".equals(currentEvent) || data.contains("\"type\":\"error\"")) {
                        try {
                            errorMsg = new JSONObject(data).optString("message", data);
                        } catch (Exception e) {
                            errorMsg = data;
                        }
                        break;
                    }
                }
            }
            br.close();
            post.disconnect();

            if (errorMsg != null) {
                return ldFail("Local Dream: " + errorMsg);
            }
            if (completeJson == null) {
                return ldFail("Pas d'événement complete. Charge un modèle dans Local Dream (backend :8081).");
            }

            JSONObject done = new JSONObject(completeJson);
            String rgbB64 = done.optString("image", "");
            int w = done.optInt("width", 512);
            int h = done.optInt("height", 512);
            int ch = done.optInt("channels", 3);
            if (rgbB64.isEmpty()) {
                return ldFail("Réponse complete sans image.");
            }
            String dataUrl = rgbBase64ToJpegDataUrl(rgbB64, w, h, ch);
            if (dataUrl == null) {
                return ldFail("Conversion RGB→JPEG échouée.");
            }
            JSONObject o = new JSONObject();
            o.put("url", dataUrl);
            o.put("engine", "local_dream");
            o.put("done", true);
            o.put("width", w);
            o.put("height", h);
            o.put("seed", done.opt("seed"));
            return o.toString();
        } catch (java.net.ConnectException e) {
            return ldFail("127.0.0.1:8081 refusé. Ouvre Local Dream et charge un modèle (serveur démarre après).");
        } catch (Exception e) {
            return ldFail(String.valueOf(e.getMessage()));
        }
    }

    private String ldFail(String msg) {
        try {
            JSONObject o = new JSONObject();
            o.put("done", true);
            o.put("error", msg);
            boolean installed = false;
            try {
                ctx.getPackageManager().getPackageInfo(LOCAL_DREAM_PKG, 0);
                installed = true;
            } catch (Exception ignored) {}
            o.put("installed", installed);
            o.put("hint", installed ? "open" : "install");
            return o.toString();
        } catch (Exception e) {
            return "{\"error\":\"" + String.valueOf(msg).replace("\"", "'") + "\",\"done\":true}";
        }
    }

    private String rgbBase64ToJpegDataUrl(String b64, int w, int h, int channels) {
        try {
            byte[] rgb = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            if (w <= 0 || h <= 0 || channels < 3) return null;
            if (rgb == null || rgb.length < w * h * 3) return null;
            channels = 3;
            android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888);
            int[] pixels = new int[w * h];
            for (int i = 0; i < w * h; i++) {
                int o = i * channels;
                int R = rgb[o] & 0xff;
                int G = rgb[o + 1] & 0xff;
                int B = rgb[o + 2] & 0xff;
                pixels[i] = 0xff000000 | (R << 16) | (G << 8) | B;
            }
            bmp.setPixels(pixels, 0, w, 0, 0, w, h);
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, baos);
            bmp.recycle();
            String out = android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
            return "data:image/jpeg;base64," + out;
        } catch (Exception e) {
            return null;
        }
    }

    /** Statut pack stable-diffusion.cpp (GGUF dans filesDir/models/sdcpp/). */
    @JavascriptInterface
    public String sdCppStatus() {
        try {
            File dir = new File(ctx.getFilesDir(), "models/sdcpp");
            File[] files = dir.isDirectory() ? dir.listFiles() : null;
            long total = 0;
            int n = 0;
            if (files != null) {
                for (File f : files) {
                    if (f.isFile() && (f.getName().endsWith(".gguf") || f.getName().endsWith(".safetensors") || f.getName().endsWith(".ckpt"))) {
                        total += f.length();
                        n++;
                    }
                }
            }
            JSONObject o = new JSONObject();
            o.put("ready", n > 0 && total > 50_000_000L);
            o.put("files", n);
            o.put("sizeMb", total / (1024 * 1024));
            o.put("path", dir.getAbsolutePath());
            o.put("native", false); // lib sd.cpp pas encore liée dans ce build
            o.put("note", n > 0
                ? "Pack détecté. Moteur sd.cpp natif en cours d'intégration — utilise Local Dream ou Horde pour générer."
                : "Pas de modèle GGUF. Télécharge un SD 1.5 quantifié (ex. via Local Dream) ou utilise Horde.");
            return o.toString();
        } catch (Exception e) {
            return "{\"ready\":false,\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
        }
    }

    @JavascriptInterface
    public String localGenerate(String prompt) {
        // Ancien chemin MNN désactivé (crash). Redirige vers diagnostic.
        try {
            JSONObject o = new JSONObject();
            o.put("error", "Ancien MNN désactivé. Choisis « Local Dream » ou « Horde », ou installe un modèle pour sd.cpp.");
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
