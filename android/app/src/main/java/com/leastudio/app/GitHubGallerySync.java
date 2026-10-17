package com.leastudio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device Flow and release synchronization for generated profile covers. */
final class GitHubGallerySync {
    private static final String KEY_ALIAS = "lea-studio-github-token-v1";
    private static final String PREFS = "lea_github_sync";
    private static final String OWNER = "davidc2115";
    private static final String REPO = "lea-studio";
    private static final String RELEASE_TAG = "covers-v1";
    private static final String ASSET_NAME = "cast-covers.zip";
    private static final ConcurrentHashMap<String, JSONObject> JOBS = new ConcurrentHashMap<>();
    private final Context context;

    GitHubGallerySync(Context context) {
        this.context = context.getApplicationContext();
    }

    String startDeviceFlow(String clientId) {
        try {
            JSONObject response = postForm(
                "https://github.com/login/device/code",
                form("client_id", clientId),
                null
            );
            if (response.has("error")) return response.toString();
            JSONObject safe = new JSONObject();
            safe.put("device_code", response.optString("device_code", ""));
            safe.put("user_code", response.optString("user_code", ""));
            safe.put("verification_uri", response.optString("verification_uri", "https://github.com/login/device"));
            safe.put("interval", Math.max(5, response.optInt("interval", 5)));
            safe.put("expires_in", response.optInt("expires_in", 900));
            return safe.toString();
        } catch (Exception e) {
            return errorJson("Impossible de démarrer l’autorisation GitHub.");
        }
    }

    String pollDeviceFlow(String clientId, String deviceCode) {
        try {
            String body = form("client_id", clientId)
                + "&" + form("device_code", deviceCode)
                + "&" + form("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
            JSONObject response = postForm("https://github.com/login/oauth/access_token", body, null);
            String error = response.optString("error", "");
            if ("authorization_pending".equals(error) || "slow_down".equals(error)) {
                JSONObject pending = new JSONObject();
                pending.put("status", error);
                return pending.toString();
            }
            if (!error.isEmpty()) {
                JSONObject failed = new JSONObject();
                failed.put("status", "error");
                failed.put("error", error);
                failed.put("error_description", response.optString("error_description", ""));
                return failed.toString();
            }
            if (response.optString("access_token", "").isEmpty()) return errorJson("GitHub n’a pas renvoyé de jeton d’accès.");
            JSONObject tokenData = new JSONObject();
            tokenData.put("access_token", response.getString("access_token"));
            tokenData.put("refresh_token", response.optString("refresh_token", ""));
            long now = System.currentTimeMillis() / 1000L;
            tokenData.put("expires_at", now + Math.max(0, response.optLong("expires_in", 0)));
            tokenData.put("refresh_expires_at", now + Math.max(0, response.optLong("refresh_token_expires_in", 0)));
            saveEncryptedToken(tokenData.toString());
            JSONObject success = new JSONObject();
            success.put("status", "authorized");
            return success.toString();
        } catch (Exception e) {
            return errorJson("Échec de l’autorisation GitHub.");
        }
    }

    boolean hasAuthorization() {
        if (context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", "").isEmpty()) return false;
        try {
            loadEncryptedToken();
            return true;
        } catch (Exception e) {
            clearToken();
            return false;
        }
    }

    boolean openVerificationPage() {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/login/device"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    String startSync(String clientId) {
        String id = UUID.randomUUID().toString();
        JOBS.put(id, job("running", "Préparation du pack d’images…", 0, 0));
        new Thread(() -> {
            try {
                int count = uploadLatestCovers(clientId);
                JOBS.put(id, job("done", "Pack GitHub mis à jour.", count, 0));
            } catch (Exception e) {
                JOBS.put(id, job("error", safeMessage(e), 0, 0));
            }
        }, "lea-github-covers-sync").start();
        JSONObject result = new JSONObject();
        try { result.put("jobId", id); } catch (Exception ignored) {}
        return result.toString();
    }

    String syncStatus(String jobId) {
        JSONObject status = JOBS.get(jobId);
        return status == null ? errorJson("Cette synchronisation n’est plus disponible.") : status.toString();
    }

    private int uploadLatestCovers(String clientId) throws Exception {
        String accessToken = accessToken(clientId);
        File zip = createCoverZip();
        try {
            JSONObject release = githubJson(
                "https://api.github.com/repos/" + OWNER + "/" + REPO + "/releases/tags/" + RELEASE_TAG,
                "GET", accessToken, null
            );
            long releaseId = release.getLong("id");
            String uploadUrl = release.optString("upload_url", "");
            int template = uploadUrl.indexOf("{");
            if (template >= 0) uploadUrl = uploadUrl.substring(0, template);
            String fixedUploadUrl = uploadUrl + "?name=" + ASSET_NAME;
            JSONArray assets = release.optJSONArray("assets");
            File backup = null;
            if (assets != null) {
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.optJSONObject(i);
                    if (asset != null && ASSET_NAME.equals(asset.optString("name"))) {
                        backup = new File(context.getCacheDir(), "cast-covers-backup-" + System.currentTimeMillis() + ".zip");
                        downloadAsset(asset.optString("browser_download_url", ""), backup);
                        githubJson(
                            "https://api.github.com/repos/" + OWNER + "/" + REPO + "/releases/assets/" + asset.getLong("id"),
                            "DELETE", accessToken, null
                        );
                        break;
                    }
                }
            }
            try {
                uploadAsset(fixedUploadUrl, accessToken, zip);
            } catch (Exception uploadError) {
                if (backup != null && backup.isFile()) {
                    try { uploadAsset(fixedUploadUrl, accessToken, backup); } catch (Exception ignoredRestore) {}
                }
                throw uploadError;
            } finally {
                if (backup != null && backup.exists()) backup.delete();
            }
            return zipCount(zip);
        } finally {
            if (zip.exists()) zip.delete();
        }
    }

    private File createCoverZip() throws Exception {
        File galleryRoot = new File(context.getFilesDir(), "gallery");
        File[] characterDirs = galleryRoot.listFiles(File::isDirectory);
        if (characterDirs == null || characterDirs.length == 0) throw new IllegalStateException("Aucune image générée à synchroniser.");
        Map<String, File> latest = new HashMap<>();
        for (File dir : characterDirs) {
            String id = dir.getName();
            if (!id.matches("[A-Za-z0-9_-]{1,80}")) continue;
            File[] images = dir.listFiles((d, name) -> name.toLowerCase(java.util.Locale.ROOT).endsWith(".jpg"));
            if (images == null) continue;
            for (File image : images) {
                if (!image.isFile() || image.length() < 100) continue;
                File current = latest.get(id);
                if (current == null || image.lastModified() > current.lastModified()) latest.put(id, image);
            }
        }
        if (latest.isEmpty()) throw new IllegalStateException("Aucune image JPG générée n’est disponible.");
        File zipFile = new File(context.getCacheDir(), "cast-covers-" + System.currentTimeMillis() + ".zip");
        JSONObject manifest = new JSONObject();
        try (ZipOutputStream zip = new ZipOutputStream(new java.io.FileOutputStream(zipFile))) {
            for (Map.Entry<String, File> item : latest.entrySet()) {
                zip.putNextEntry(new ZipEntry("cast_covers/" + item.getKey() + ".jpg"));
                zip.write(optimizedJpeg(item.getValue()));
                zip.closeEntry();
                manifest.put(item.getKey(), item.getKey() + ".jpg");
            }
            zip.putNextEntry(new ZipEntry("cast_covers/manifest.json"));
            zip.write(manifest.toString().getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return zipFile;
    }

    private byte[] optimizedJpeg(File image) throws Exception {
        android.graphics.BitmapFactory.Options bounds = new android.graphics.BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        android.graphics.BitmapFactory.decodeFile(image.getAbsolutePath(), bounds);
        if (bounds.outWidth < 1 || bounds.outHeight < 1) throw new IllegalStateException("Une image générée est illisible.");
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / sample > 1024) sample *= 2;
        android.graphics.BitmapFactory.Options decode = new android.graphics.BitmapFactory.Options();
        decode.inSampleSize = sample;
        decode.inPreferredConfig = android.graphics.Bitmap.Config.RGB_565;
        android.graphics.Bitmap source = android.graphics.BitmapFactory.decodeFile(image.getAbsolutePath(), decode);
        if (source == null) throw new IllegalStateException("Impossible de préparer une image pour le pack GitHub.");
        android.graphics.Bitmap output = source;
        try {
            int maxEdge = 768;
            float scale = Math.min(1f, (float) maxEdge / Math.max(source.getWidth(), source.getHeight()));
            if (scale < 1f) {
                output = android.graphics.Bitmap.createScaledBitmap(
                    source,
                    Math.max(1, Math.round(source.getWidth() * scale)),
                    Math.max(1, Math.round(source.getHeight() * scale)),
                    true
                );
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if (!output.compress(android.graphics.Bitmap.CompressFormat.JPEG, 78, bytes)) {
                throw new IllegalStateException("Impossible de compresser une image du pack GitHub.");
            }
            return bytes.toByteArray();
        } finally {
            if (output != source) output.recycle();
            source.recycle();
        }
    }

    private int zipCount(File zipFile) {
        try (java.util.zip.ZipFile z = new java.util.zip.ZipFile(zipFile)) {
            return Math.max(0, z.size() - 1);
        } catch (Exception e) {
            return 0;
        }
    }

    private String accessToken(String clientId) throws Exception {
        JSONObject stored = new JSONObject(loadEncryptedToken());
        long now = System.currentTimeMillis() / 1000L;
        if (stored.optLong("expires_at", 0) > now + 90) return stored.getString("access_token");
        String refreshToken = stored.optString("refresh_token", "");
        if (refreshToken.isEmpty() || stored.optLong("refresh_expires_at", 0) <= now) {
            clearToken();
            throw new IllegalStateException("La connexion GitHub a expiré. Reconnecte l’application.");
        }
        JSONObject refreshed = postForm(
            "https://github.com/login/oauth/access_token",
            form("client_id", clientId) + "&" + form("grant_type", "refresh_token") + "&" + form("refresh_token", refreshToken),
            null
        );
        if (!refreshed.optString("error", "").isEmpty() || refreshed.optString("access_token", "").isEmpty()) {
            clearToken();
            throw new IllegalStateException("La connexion GitHub a expiré. Reconnecte l’application.");
        }
        JSONObject next = new JSONObject();
        next.put("access_token", refreshed.getString("access_token"));
        next.put("refresh_token", refreshed.optString("refresh_token", refreshToken));
        next.put("expires_at", now + refreshed.optLong("expires_in", 0));
        next.put("refresh_expires_at", now + refreshed.optLong("refresh_token_expires_in", stored.optLong("refresh_expires_at", 0) - now));
        saveEncryptedToken(next.toString());
        return next.getString("access_token");
    }

    private JSONObject postForm(String address, String body, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        try {
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
            if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
            return readJsonResponse(connection);
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject githubJson(String address, String method, String token, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        try {
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept", "application/vnd.github+json");
            connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("User-Agent", "Lea-Studio-Android");
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int code = connection.getResponseCode();
            if (code == 204) return new JSONObject();
            JSONObject response = readJsonResponse(connection);
            if (code < 200 || code >= 300) {
                throw new IllegalStateException(response.optString("message", "GitHub a refusé la requête (HTTP " + code + ")."));
            }
            return response;
        } finally {
            connection.disconnect();
        }
    }

    private void uploadAsset(String address, String token, File zip) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        try {
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(120000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(zip.length());
            connection.setRequestProperty("Accept", "application/vnd.github+json");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/zip");
            connection.setRequestProperty("User-Agent", "Lea-Studio-Android");
            try (InputStream in = new FileInputStream(zip); OutputStream out = connection.getOutputStream()) {
                byte[] buffer = new byte[32 * 1024];
                int n;
                while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            }
            int code = connection.getResponseCode();
            JSONObject response = readJsonResponse(connection);
            if (code < 200 || code >= 300) {
                throw new IllegalStateException(response.optString("message", "Impossible de charger le pack d’images (HTTP " + code + ")."));
            }
        } finally {
            connection.disconnect();
        }
    }

    private void downloadAsset(String address, File target) throws Exception {
        if (address == null || !address.startsWith("https://github.com/")) {
            throw new IllegalStateException("Le pack GitHub existant ne peut pas être sauvegardé avant remplacement.");
        }
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        try {
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("User-Agent", "Lea-Studio-Android");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("Impossible de sauvegarder l’ancien pack GitHub.");
            try (InputStream in = connection.getInputStream(); OutputStream out = new java.io.FileOutputStream(target)) {
                byte[] buffer = new byte[32 * 1024];
                int n;
                while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            }
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject readJsonResponse(HttpURLConnection connection) throws Exception {
        int code = connection.getResponseCode();
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return new JSONObject();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder text = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
            return text.length() == 0 ? new JSONObject() : new JSONObject(text.toString());
        }
    }

    private String form(String key, String value) throws Exception {
        return URLEncoder.encode(key, "UTF-8") + "=" + URLEncoder.encode(value == null ? "" : value, "UTF-8");
    }

    private String loadEncryptedToken() throws Exception {
        String encoded = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", "");
        if (encoded.isEmpty()) throw new IllegalStateException("Connecte d’abord Léa Studio à GitHub.");
        byte[] all = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
        byte[] iv = java.util.Arrays.copyOfRange(all, 0, 12);
        byte[] encrypted = java.util.Arrays.copyOfRange(all, 12, all.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    private void saveEncryptedToken(String clearText) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
        byte[] encrypted = cipher.doFinal(clearText.getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream packed = new ByteArrayOutputStream();
        packed.write(cipher.getIV());
        packed.write(encrypted);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("token", android.util.Base64.encodeToString(packed.toByteArray(), android.util.Base64.NO_WRAP))
            .apply();
    }

    private SecretKey encryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY_ALIAS, null);
    }

    private void clearToken() {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("token").apply();
    }

    private JSONObject job(String status, String message, int count, int progress) {
        JSONObject result = new JSONObject();
        try {
            result.put("status", status);
            result.put("message", message);
            result.put("count", count);
            result.put("progress", progress);
        } catch (Exception ignored) {}
        return result;
    }

    private String errorJson(String message) {
        JSONObject result = new JSONObject();
        try { result.put("status", "error"); result.put("error_description", message); }
        catch (Exception ignored) {}
        return result.toString();
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return "La synchronisation GitHub a échoué.";
        if (message.toLowerCase(java.util.Locale.ROOT).contains("resource not accessible by integration")) {
            return "GitHub refuse l’accès au dépôt. Vérifie que la GitHub App est installée sur davidc2115/lea-studio avec Contents: Read and write, puis reconnecte GitHub dans Léa Studio.";
        }
        return message;
    }

}
