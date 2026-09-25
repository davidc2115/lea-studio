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


    /** GET HTTP (texte) — pour APIs type Chub sans CORS WebView. */
    @JavascriptInterface
    public String httpGet(String url) {
        return httpGetWithHeaders(url, "Accept: application/json\nOrigin: https://chub.ai\nReferer: https://chub.ai/");
    }

    @JavascriptInterface
    public String httpGetWithHeaders(String url, String headersJoined) {
        HttpURLConnection conn = null;
        try {
            if (url == null || url.isEmpty()) return "{\"error\":\"empty url\"}";
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(45000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");
            if (headersJoined != null) {
                for (String line : headersJoined.split("\n")) {
                    int c = line.indexOf(':');
                    if (c > 0) {
                        conn.setRequestProperty(line.substring(0, c).trim(), line.substring(c + 1).trim());
                    }
                }
            }
            int code = conn.getResponseCode();
            InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (in == null) return "{\"error\":\"http " + code + "\"}";
            BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
            br.close();
            if (code >= 400) return "{\"error\":\"http " + code + "\",\"body\":" + JSONObject.quote(sb.toString().substring(0, Math.min(500, sb.length()))) + "}";
            return sb.toString();
        } catch (Exception e) {
            return "{\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}";
        } finally {
            if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
        }
    }

    /** GET binaire → data URL base64 (ex: carte PNG Chub). */
    @JavascriptInterface
    public String httpGetDataUrl(String url) {
        HttpURLConnection conn = null;
        try {
            if (url == null || url.isEmpty()) return "";
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(60000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36");
            conn.setRequestProperty("Referer", "https://chub.ai/");
            int code = conn.getResponseCode();
            if (code >= 400) return "";
            InputStream in = conn.getInputStream();
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            int total = 0;
            while ((n = in.read(buf)) > 0) {
                bos.write(buf, 0, n);
                total += n;
                if (total > 12_000_000) break; // max ~12 Mo
            }
            in.close();
            byte[] bytes = bos.toByteArray();
            String mime = "image/png";
            String ct = conn.getContentType();
            if (ct != null && ct.startsWith("image/")) mime = ct.split(";")[0].trim();
            return "data:" + mime + ";base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        } finally {
            if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
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
    
    /** Enregistre une image (data URL) dans le dossier Téléchargements public. */
    @JavascriptInterface
    public boolean saveBase64ToDownloads(String dataUrl, String filename) {
        try {
            if (dataUrl == null || dataUrl.length() < 32) return false;
            String b64 = dataUrl;
            int comma = dataUrl.indexOf(',');
            if (dataUrl.startsWith("data:") && comma > 0) b64 = dataUrl.substring(comma + 1);
            byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            if (bytes == null || bytes.length < 100) return false;
            if (filename == null || filename.isEmpty()) filename = "lea-" + System.currentTimeMillis() + ".jpg";
            filename = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
            java.io.File downloads;
            if (android.os.Build.VERSION.SDK_INT >= 29) {
                // MediaStore
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(android.provider.MediaStore.Downloads.MIME_TYPE, "image/jpeg");
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                android.net.Uri uri = ctx.getContentResolver().insert(
                    android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (java.io.OutputStream out = ctx.getContentResolver().openOutputStream(uri)) {
                    if (out == null) return false;
                    out.write(bytes);
                }
                values.clear();
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                ctx.getContentResolver().update(uri, values, null, null);
                return true;
            } else {
                downloads = android.os.Environment.getExternalStoragePublicDirectory(
                    android.os.Environment.DIRECTORY_DOWNLOADS);
                if (!downloads.exists()) downloads.mkdirs();
                java.io.File out = new java.io.File(downloads, filename);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(out)) {
                    fos.write(bytes);
                }
                // Notifier le média scanner
                android.content.Intent scan = new android.content.Intent(
                    android.content.Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                scan.setData(android.net.Uri.fromFile(out));
                ctx.sendBroadcast(scan);
                return true;
            }
        } catch (Exception e) {
            return false;
        }
    }

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
    private volatile boolean ldBusy = false;
    private volatile String ldJson = "{\"pending\":false}";

    @JavascriptInterface
    public String localDreamStatus() {
        return ldJson;
    }

    /** Probe rapide : le backend Local Dream écoute-t-il sur :8081 ? */
    @JavascriptInterface
    public String localDreamProbe() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL("http://127.0.0.1:8081/tokenize").openConnection();
            c.setConnectTimeout(1500);
            c.setReadTimeout(2000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            byte[] b = "{\"prompt\":\"test\"}".getBytes(StandardCharsets.UTF_8);
            c.getOutputStream().write(b);
            int code = c.getResponseCode();
            c.disconnect();
            JSONObject o = new JSONObject();
            o.put("ok", code >= 200 && code < 500);
            o.put("code", code);
            o.put("port", 8081);
            return o.toString();
        } catch (Exception e) {
            try {
                JSONObject o = new JSONObject();
                o.put("ok", false);
                o.put("error", String.valueOf(e.getMessage()));
                boolean installed = false;
                try { ctx.getPackageManager().getPackageInfo(LOCAL_DREAM_PKG, 0); installed = true; } catch (Exception ignored) {}
                o.put("installed", installed);
                return o.toString();
            } catch (Exception e2) {
                return "{\"ok\":false}";
            }
        }
    }

    @JavascriptInterface
    public String copyText(String text) {
        try {
            android.content.ClipboardManager cm = (android.content.ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) {
                cm.setPrimaryClip(android.content.ClipData.newPlainText("prompt", text == null ? "" : text));
                return "{\"ok\":true}";
            }
        } catch (Exception ignored) {}
        return "{\"ok\":false}";
    }

    /**
     * Lance la génération Local Dream en arrière-plan (API 127.0.0.1:8081).
     * Prérequis : Local Dream au premier plan ou en arrière-plan AVEC modèle chargé
     * (le serveur :8081 ne démarre qu'après chargement du modèle).
     */
    @JavascriptInterface
    public String localDreamGenerate(String prompt) {
        final String p = prompt == null ? "a woman" : prompt;
        if (ldBusy) {
            return "{\"pending\":true,\"note\":\"déjà en cours\"}";
        }
        // Probe d'abord
        try {
            HttpURLConnection c = (HttpURLConnection) new URL("http://127.0.0.1:8081/tokenize").openConnection();
            c.setConnectTimeout(1500);
            c.setReadTimeout(2000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.getOutputStream().write("{\"prompt\":\"hi\"}".getBytes(StandardCharsets.UTF_8));
            int code = c.getResponseCode();
            c.disconnect();
            if (code < 200 || code >= 500) {
                return ldFail("Backend :8081 répond HTTP " + code + ". Recharge le modèle dans Local Dream.");
            }
        } catch (Exception e) {
            return ldFail("127.0.0.1:8081 inaccessible. Étapes : 1) Ouvre Local Dream 2) Choisis et CHARGE un modèle jusqu'à l'écran de génération 3) Reviens ici sans forcer l'arrêt de Local Dream 4) Génère. Prompt copié si possible.");
        }

        ldBusy = true;
        ldJson = "{\"pending\":true,\"note\":\"génération Local Dream…\"}";
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("prompt", p);
                body.put("negative_prompt", "child, teen, underage, cartoon, anime, deformed, blurry, low quality");
                // Qualité : 512 (pas 256). Sur NPU, la taille doit matcher le modèle chargé.
                body.put("steps", 28);
                body.put("cfg", 7.0);
                body.put("width", 512);
                body.put("height", 768);
                body.put("size", 512);
                body.put("scheduler", "dpm_karras");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);

                HttpURLConnection post = (HttpURLConnection) new URL("http://127.0.0.1:8081/generate").openConnection();
                post.setConnectTimeout(5000);
                post.setReadTimeout(300000);
                post.setRequestMethod("POST");
                post.setDoOutput(true);
                post.setRequestProperty("Content-Type", "application/json");
                post.setRequestProperty("Accept", "text/event-stream");
                post.getOutputStream().write(payload);

                int pc = post.getResponseCode();
                InputStream in = (pc >= 200 && pc < 300) ? post.getInputStream() : post.getErrorStream();
                if (in == null) {
                    ldJson = ldFail("HTTP " + pc + " vide");
                    return;
                }

                BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
                String line;
                String currentEvent = "";
                StringBuilder dataBuf = new StringBuilder();
                String completeJson = null;
                String errorMsg = null;
                int step = 0;

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
                        if (data.contains("\"type\":\"progress\"") || "progress".equals(currentEvent)) {
                            try {
                                JSONObject pr = new JSONObject(data);
                                step = pr.optInt("step", step);
                                int total = pr.optInt("total_steps", 20);
                                ldJson = "{\"pending\":true,\"note\":\"Local Dream step " + step + "/" + total + "\"}";
                            } catch (Exception ignored) {}
                        }
                        if ("complete".equals(currentEvent) || data.contains("\"type\":\"complete\"")) {
                            completeJson = data;
                            break;
                        }
                        if ("error".equals(currentEvent) || data.contains("\"type\":\"error\"")) {
                            try { errorMsg = new JSONObject(data).optString("message", data); }
                            catch (Exception e) { errorMsg = data; }
                            break;
                        }
                    }
                }
                br.close();
                post.disconnect();

                if (errorMsg != null) {
                    ldJson = ldFail("Local Dream: " + errorMsg);
                    return;
                }
                if (completeJson == null) {
                    ldJson = ldFail("Pas d'image complete. Garde Local Dream ouvert pendant la génération.");
                    return;
                }
                JSONObject done = new JSONObject(completeJson);
                String rgbB64 = done.optString("image", "");
                int w = done.optInt("width", 512);
                int h = done.optInt("height", 512);
                int ch = done.optInt("channels", 3);
                String dataUrl = rgbBase64ToJpegDataUrl(rgbB64, w, h, ch);
                if (dataUrl == null) {
                    ldJson = ldFail("Conversion RGB→JPEG échouée (données invalides)");
                    return;
                }
                // Éviter limite Binder (~1 Mo) : écrire sur disque, renvoyer gallery:
                String key = null;
                try {
                    key = saveGalleryImage("lea", dataUrl);
                } catch (Exception ignored) {}
                JSONObject o = new JSONObject();
                if (key != null && key.startsWith("gallery:")) {
                    o.put("url", key);
                } else {
                    // fallback compressé si petit
                    if (dataUrl.length() < 700000) o.put("url", dataUrl);
                    else {
                        ldJson = ldFail("Image trop grosse pour le pont JS et écriture disque échouée");
                        return;
                    }
                }
                o.put("engine", "local_dream");
                o.put("done", true);
                o.put("pending", false);
                ldJson = o.toString();
            } catch (Exception e) {
                ldJson = ldFail(String.valueOf(e.getMessage()));
            } finally {
                ldBusy = false;
            }
        }, "lea-localdream").start();

        try {
            JSONObject o = new JSONObject();
            o.put("pending", true);
            o.put("note", "Local Dream lancé (ne quitte pas Local Dream)");
            return o.toString();
        } catch (Exception e) {
            return "{\"pending\":true}";
        }
    }

    private String ldFail(String msg) {
        try {
            JSONObject o = new JSONObject();
            o.put("done", true);
            o.put("pending", false);
            o.put("error", msg);
            boolean installed = false;
            try { ctx.getPackageManager().getPackageInfo(LOCAL_DREAM_PKG, 0); installed = true; } catch (Exception ignored) {}
            o.put("installed", installed);
            o.put("hint", installed ? "open" : "install");
            return o.toString();
        } catch (Exception e) {
            return "{\"error\":\"" + String.valueOf(msg).replace("\"", "'") + "\",\"done\":true}";
        }
    }

    /** Décode image Local Dream : PNG/JPEG base64 OU RGB brut. */
    private String rgbBase64ToJpegDataUrl(String b64, int w, int h, int channels) {
        try {
            if (b64 == null || b64.isEmpty()) return null;
            // Nettoyer espaces / retours ligne SSE
            b64 = b64.replace("\n", "").replace("\r", "").replace(" ", "");
            byte[] raw = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            if (raw == null || raw.length < 100) return null;

            // PNG magic
            if (raw.length > 8 && (raw[0] & 0xff) == 0x89 && raw[1] == 0x50 && raw[2] == 0x4E && raw[3] == 0x47) {
                String out = android.util.Base64.encodeToString(raw, android.util.Base64.NO_WRAP);
                return "data:image/png;base64," + out;
            }
            // JPEG magic
            if ((raw[0] & 0xff) == 0xFF && (raw[1] & 0xff) == 0xD8) {
                String out = android.util.Base64.encodeToString(raw, android.util.Base64.NO_WRAP);
                return "data:image/jpeg;base64," + out;
            }

            if (w <= 0) w = 512;
            if (h <= 0) h = 512;
            if (channels < 3) channels = 3;

            int need = w * h * channels;
            // Si taille incohérente, tenter d'inférer depuis la longueur (RGB)
            if (raw.length < need) {
                // essayer square
                int px = raw.length / 3;
                int side = (int) Math.sqrt(px);
                if (side * side * 3 == raw.length) {
                    w = h = side;
                    channels = 3;
                    need = raw.length;
                } else if (raw.length % 3 == 0) {
                    // garder w, recalculer h
                    h = (raw.length / 3) / Math.max(1, w);
                    if (h < 8) return null;
                    channels = 3;
                    need = w * h * 3;
                } else {
                    return null;
                }
            }

            android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888);
            int[] pixels = new int[w * h];
            boolean allWhite = true;
            boolean allBlack = true;
            for (int i = 0; i < w * h; i++) {
                int o = i * channels;
                int R = raw[o] & 0xff;
                int G = raw[o + 1] & 0xff;
                int B = raw[o + 2] & 0xff;
                if (R < 250 || G < 250 || B < 250) allWhite = false;
                if (R > 5 || G > 5 || B > 5) allBlack = false;
                pixels[i] = 0xff000000 | (R << 16) | (G << 8) | B;
            }
            // Image toute blanche/noire = souvent mauvais décodage → essayer BitmapFactory
            if (allWhite || allBlack) {
                try {
                    android.graphics.Bitmap decoded = android.graphics.BitmapFactory.decodeByteArray(raw, 0, raw.length);
                    if (decoded != null) {
                        java.io.ByteArrayOutputStream baos2 = new java.io.ByteArrayOutputStream();
                        decoded.compress(android.graphics.Bitmap.CompressFormat.JPEG, 92, baos2);
                        decoded.recycle();
                        return "data:image/jpeg;base64," + android.util.Base64.encodeToString(baos2.toByteArray(), android.util.Base64.NO_WRAP);
                    }
                } catch (Exception ignored) {}
            }
            bmp.setPixels(pixels, 0, w, 0, 0, w, h);
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 92, baos);
            bmp.recycle();
            return "data:image/jpeg;base64," + android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    @JavascriptInterface
    public String bridgeInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("downloadSdCppModel", true);
            o.put("downloadStatus", true);
            o.put("sdCppGenerate", true);
            o.put("localDreamGenerate", true);
            o.put("openLocalDream", true);
            File dir = new File(ctx.getFilesDir(), "models/sdcpp");
            File model = findSdModel(dir);
            o.put("sdModel", model != null ? model.getName() : "");
            o.put("sdModelMb", model != null ? model.length() / 1048576 : 0);
            o.put("dlStatus", dlStatus);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }


    // —— stable-diffusion.cpp (binaire CLI extrait des assets) ——
    private volatile boolean sdBusy = false;
    private volatile String sdJson = "{\"pending\":false}";

    @JavascriptInterface
    public String sdCppStatus() {
        try {
            File bin = new File(ctx.getFilesDir(), "bin/sd");
            File dir = new File(ctx.getFilesDir(), "models/sdcpp");
            File model = findSdModel(dir);
            boolean hasAsset = false;
            try {
                String[] list = ctx.getAssets().list("native");
                if (list != null) {
                    for (String s : list) {
                        if (s.startsWith("sd")) hasAsset = true;
                    }
                }
            } catch (Exception ignored) {}
            JSONObject o = new JSONObject();
            o.put("native", bin.isFile() || hasAsset);
            o.put("binary", bin.isFile());
            o.put("binarySize", bin.isFile() ? bin.length() : 0);
            o.put("ready", model != null && model.length() > 30_000_000L);
            o.put("model", model != null ? model.getName() : "");
            o.put("modelMb", model != null ? model.length() / (1024 * 1024) : 0);
            o.put("path", dir.getAbsolutePath());
            if (!(bin.isFile() || hasAsset)) {
                o.put("note", "Binaire sd absent de l'APK (rebuild avec étape CI sd.cpp).");
            } else if (model == null) {
                o.put("note", "Binaire OK. Télécharge un modèle GGUF/safetensors (bouton pack SD).");
            } else {
                o.put("note", "Prêt : " + model.getName());
            }
            return o.toString();
        } catch (Exception e) {
            return "{\"ready\":false,\"native\":false,\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
        }
    }

    @JavascriptInterface
    public String sdCppPoll() {
        return sdJson;
    }

    private File findSdModel(File dir) {
        if (dir == null || !dir.isDirectory()) return null;
        File[] files = dir.listFiles();
        if (files == null) return null;
        File best = null;
        for (File f : files) {
            if (!f.isFile()) continue;
            String n = f.getName().toLowerCase();
            if (!(n.endsWith(".gguf") || n.endsWith(".safetensors") || n.endsWith(".ckpt"))) continue;
            if (f.length() < 30_000_000L) continue;
            if (best == null || f.length() > best.length()) best = f;
        }
        return best;
    }

    /** Extrait assets/native/sd-arm64 → filesDir/bin/sd */
    private File ensureSdBinary() throws Exception {
        File dir = new File(ctx.getFilesDir(), "bin");
        if (!dir.exists()) dir.mkdirs();
        File out = new File(dir, "sd");
        if (out.isFile() && out.length() > 100_000 && out.canExecute()) return out;

        String[] candidates = { "native/sd-arm64", "native/sd", "bin/sd-arm64" };
        InputStream in = null;
        for (String c : candidates) {
            try {
                in = ctx.getAssets().open(c);
                break;
            } catch (Exception ignored) {}
        }
        if (in == null) {
            throw new Exception("Binaire sd.cpp absent (assets/native/sd-arm64). Rebuild APK avec CI sd.cpp.");
        }
        FileOutputStream fos = new FileOutputStream(out);
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
        fos.close();
        in.close();
        out.setExecutable(true, false);
        out.setReadable(true, false);
        // Android 10+ : aussi essayer chmod
        try {
            Runtime.getRuntime().exec(new String[]{"chmod", "755", out.getAbsolutePath()}).waitFor();
        } catch (Exception ignored) {}
        if (!out.isFile()) throw new Exception("Échec extraction binaire sd");
        return out;
    }

        @JavascriptInterface
    public String downloadSdModel(String url) {
        return downloadSdCppModel(url);
    }

    public String downloadSdCppModel(String url) {
        // URLs valides (le nom Q4_0 sans "pruned-emaonly" renvoyait 404)
        final String[] fallbacks = new String[] {
            (url != null && !url.isEmpty()) ? url : null,
            "https://huggingface.co/second-state/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf",
            "https://huggingface.co/kostakoff/stable-diffusion-v1-5-GGUF/resolve/main/v1-5-pruned_Q4_0.gguf",
            "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors"
        };
        new Thread(() -> {
            File dir = new File(ctx.getFilesDir(), "models/sdcpp");
            if (!dir.exists()) dir.mkdirs();
            Exception last = null;
            for (String u : fallbacks) {
                if (u == null) continue;
                try {
                    dlStatus = "sd.cpp : " + u.substring(Math.max(0, u.lastIndexOf('/') + 1));
                    String name = u.substring(u.lastIndexOf('/') + 1);
                    if (name.isEmpty() || !name.contains(".")) name = "model.gguf";
                    // query params strip
                    int q = name.indexOf('?');
                    if (q > 0) name = name.substring(0, q);
                    File out = new File(dir, name);
                    if (out.isFile() && out.length() > 50_000_000L) {
                        dlStatus = "Déjà présent : " + name + " (" + (out.length() / 1048576) + " Mo)";
                        return;
                    }
                    File tmp = new File(dir, name + ".part");
                    HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
                    c.setConnectTimeout(30000);
                    c.setReadTimeout(600000);
                    c.setInstanceFollowRedirects(true);
                    c.setRequestProperty("User-Agent", "LeaStudio/1.0");
                    c.connect();
                    int code = c.getResponseCode();
                    // suivre redirections manuelles si besoin
                    int redirects = 0;
                    while (code >= 300 && code < 400 && redirects < 5) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        if (loc == null) break;
                        c = (HttpURLConnection) new URL(loc).openConnection();
                        c.setConnectTimeout(30000);
                        c.setReadTimeout(600000);
                        c.setInstanceFollowRedirects(true);
                        c.setRequestProperty("User-Agent", "LeaStudio/1.0");
                        c.connect();
                        code = c.getResponseCode();
                        redirects++;
                    }
                    if (code == 404) {
                        dlStatus = "404 sur " + name + " — essai suivant…";
                        c.disconnect();
                        continue;
                    }
                    if (code >= 400) {
                        dlStatus = "HTTP " + code + " — " + name;
                        c.disconnect();
                        continue;
                    }
                    long total = c.getContentLengthLong();
                    InputStream in = c.getInputStream();
                    FileOutputStream fos = new FileOutputStream(tmp);
                    byte[] buf = new byte[65536];
                    long got = 0;
                    int r;
                    while ((r = in.read(buf)) > 0) {
                        fos.write(buf, 0, r);
                        got += r;
                        if (total > 0) {
                            dlStatus = "sd.cpp " + (got * 100 / total) + "% · " + (got / 1048576) + " Mo / " + (total / 1048576) + " Mo";
                        } else {
                            dlStatus = "sd.cpp " + (got / 1048576) + " Mo…";
                        }
                    }
                    fos.close();
                    in.close();
                    c.disconnect();
                    if (out.exists()) out.delete();
                    if (!tmp.renameTo(out)) {
                        // copy fallback
                        java.nio.file.Files.move(tmp.toPath(), out.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    }
                    if (out.length() < 10_000_000L) {
                        out.delete();
                        dlStatus = "Fichier trop petit, URL invalide — essai suivant…";
                        continue;
                    }
                    dlStatus = "Modèle OK : " + out.getName() + " (" + (out.length() / 1048576) + " Mo)";
                    return;
                } catch (Exception e) {
                    last = e;
                    dlStatus = "Échec : " + e.getMessage() + " — essai suivant…";
                }
            }
            dlStatus = "Échec téléchargement modèle" + (last != null ? (" : " + last.getMessage()) : "");
        }, "lea-sd-dl").start();
        return "Téléchargement modèle sd.cpp (plusieurs miroirs)…";
    }

    public String sdCppGenerate(String prompt) {
        final String p = prompt == null ? "a woman" : prompt;
        if (sdBusy) return "{\"pending\":true,\"note\":\"déjà en cours\"}";
        File modelDir = new File(ctx.getFilesDir(), "models/sdcpp");
        final File model = findSdModel(modelDir);
        if (model == null) {
            try {
                JSONObject o = new JSONObject();
                o.put("done", true);
                o.put("pending", false);
                o.put("error", "Aucun modèle GGUF/safetensors dans models/sdcpp/. Utilise « Télécharger pack SD.cpp ».");
                o.put("needModel", true);
                return o.toString();
            } catch (Exception e) {
                return "{\"error\":\"pas de modèle\",\"done\":true}";
            }
        }

        sdBusy = true;
        sdJson = "{\"pending\":true,\"note\":\"préparation sd.cpp…\"}";
        new Thread(() -> {
            try {
                File bin = ensureSdBinary();
                File outDir = new File(ctx.getFilesDir(), "sd_out");
                if (!outDir.exists()) outDir.mkdirs();
                File outPng = new File(outDir, "out_" + System.currentTimeMillis() + ".png");

                // CLI stable-diffusion.cpp
                ProcessBuilder pb = new ProcessBuilder(
                    bin.getAbsolutePath(),
                    "-m", model.getAbsolutePath(),
                    "-p", p,
                    "--negative-prompt", "child, teen, underage, cartoon, deformed, blurry, low quality",
                    "-H", "640",
                    "-W", "512",
                    "--steps", "20",
                    "--cfg-scale", "7",
                    "--sampling-method", "euler_a",
                    "-o", outPng.getAbsolutePath(),
                    "-v"
                );
                pb.directory(ctx.getFilesDir());
                pb.redirectErrorStream(true);
                MapEnvFix(pb);
                Process proc = pb.start();
                BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8));
                String line;
                StringBuilder log = new StringBuilder();
                while ((line = br.readLine()) != null) {
                    if (log.length() < 4000) log.append(line).append('\n');
                    if (line.contains("%") || line.toLowerCase().contains("step")) {
                        sdJson = "{\"pending\":true,\"note\":\"" + line.replace("\"", "'").replace("\n", " ") + "\"}";
                    }
                }
                int code = proc.waitFor();
                if (code != 0 || !outPng.isFile() || outPng.length() < 1000) {
                    JSONObject err = new JSONObject();
                    err.put("done", true);
                    err.put("pending", false);
                    err.put("error", "sd.cpp exit " + code + (log.length() > 0 ? " : " + log.toString().trim().replace("\"", "'") : ""));
                    sdJson = err.toString();
                    return;
                }
                // PNG → data URL
                byte[] bytes = new byte[(int) outPng.length()];
                java.io.FileInputStream fis = new java.io.FileInputStream(outPng);
                int off = 0;
                while (off < bytes.length) {
                    int r = fis.read(bytes, off, bytes.length - off);
                    if (r < 0) break;
                    off += r;
                }
                fis.close();
                String b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
                JSONObject o = new JSONObject();
                o.put("url", "data:image/png;base64," + b64);
                o.put("engine", "sd_cpp");
                o.put("done", true);
                o.put("pending", false);
                sdJson = o.toString();
                // nettoyer gros fichiers
                try { outPng.delete(); } catch (Exception ignored) {}
            } catch (Exception e) {
                try {
                    JSONObject err = new JSONObject();
                    err.put("done", true);
                    err.put("pending", false);
                    err.put("error", String.valueOf(e.getMessage()).replace("\"", "'"));
                    sdJson = err.toString();
                } catch (Exception e2) {
                    sdJson = "{\"error\":\"sd.cpp échec\",\"done\":true}";
                }
            } finally {
                sdBusy = false;
            }
        }, "lea-sdcpp").start();

        try {
            JSONObject o = new JSONObject();
            o.put("pending", true);
            o.put("note", "sd.cpp lancé…");
            return o.toString();
        } catch (Exception e) {
            return "{\"pending\":true}";
        }
    }

    private void MapEnvFix(ProcessBuilder pb) {
        try {
            java.util.Map<String, String> env = pb.environment();
            // éviter OpenMP excessif sur téléphone
            env.put("OMP_NUM_THREADS", "4");
            env.put("GGML_NUM_THREADS", "4");
        } catch (Exception ignored) {}
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
