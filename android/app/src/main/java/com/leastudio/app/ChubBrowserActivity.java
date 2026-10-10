package com.leastudio.app;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ChubBrowserActivity extends Activity {
    public static final String EXTRA_URL = "com.leastudio.app.CHUB_URL";
    private WebView browser;
    private File sessionDir;

    private static boolean isChubHost(String host) {
        if (host == null) return false;
        String lower = host.toLowerCase();
        return lower.equals("chub.ai") || lower.endsWith(".chub.ai")
                || lower.equals("charhub.io") || lower.endsWith(".charhub.io");
    }

    private static boolean isAllowedCardUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            String path = uri.getPath();
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "chub.ai".equalsIgnoreCase(uri.getHost())
                    && path != null
                    && path.matches("^/characters/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/?$");
        } catch (Exception ignored) {
            return false;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String url = getIntent().getStringExtra(EXTRA_URL);
        if (!isAllowedCardUrl(url)) {
            finish();
            return;
        }
        sessionDir = new File(new File(getFilesDir(), "chub-pending"), String.valueOf(System.currentTimeMillis()));
        if (!sessionDir.mkdirs() && !sessionDir.isDirectory()) {
            Toast.makeText(this, "Impossible de préparer l’import interne.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        TextView note = new TextView(this);
        note.setText("Chub · les cartes téléchargées seront ajoutées à Ma bibliothèque au retour");
        note.setPadding(16, 12, 16, 12);
        page.addView(note, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        browser = new WebView(this);
        page.addView(browser, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        Button close = new Button(this);
        close.setText("Retour à Léa Studio");
        close.setOnClickListener(view -> finish());
        page.addView(close, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(page);

        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.setWebChromeClient(new WebChromeClient());
        browser.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"https".equalsIgnoreCase(request.getUrl().getScheme());
            }
        });
        browser.setDownloadListener(new ChubDownloadListener(this, sessionDir));
        CookieManager.getInstance().setAcceptCookie(true);
        browser.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (browser != null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    private static final class ChubDownloadListener implements DownloadListener {
        private final Context context;
        private final File sessionDir;
        private final ExecutorService executor = Executors.newSingleThreadExecutor();
        private final Handler mainHandler = new Handler(Looper.getMainLooper());

        ChubDownloadListener(Context context, File sessionDir) {
            this.context = context;
            this.sessionDir = sessionDir;
        }

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                   String mimeType, long contentLength) {
            try {
                Uri uri = Uri.parse(url);
                if (!"https".equalsIgnoreCase(uri.getScheme())) {
                    showToast("Seuls les téléchargements HTTPS sont autorisés.");
                    return;
                }
                if (!isChubHost(uri.getHost())) {
                    showToast("Seuls les fichiers Chub sont importés.");
                    return;
                }
                String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                String lower = filename.toLowerCase();
                String type = mimeType == null ? "" : mimeType.toLowerCase();
                String path = uri.getLastPathSegment() == null ? "" : uri.getLastPathSegment().toLowerCase();
                boolean json = type.contains("json") || lower.matches(".*\\.json$") || path.matches(".*\\.json$");
                boolean png = type.contains("image/png") || lower.matches(".*\\.png$") || path.matches(".*\\.png$");
                if (!json && !png) {
                    showToast("Ce fichier n’est pas une carte JSON ou une image PNG.");
                    return;
                }
                final boolean isJson = json;
                final String agent = userAgent;
                final String target = isJson ? "card.json" : "card.png";
                executor.execute(() -> downloadIntoApp(url, agent, target, isJson));
            } catch (Exception error) {
                showToast("Téléchargement impossible.");
            }
        }

        private void downloadIntoApp(String url, String userAgent, String filename, boolean json) {
            HttpURLConnection connection = null;
            File destination = new File(sessionDir, filename);
            File temporary = new File(sessionDir, filename + ".part");
            long limit = json ? 5L * 1024 * 1024 : 12L * 1024 * 1024;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", json ? "application/json,*/*" : "image/png,*/*");
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
                if (userAgent != null && !userAgent.isEmpty()) connection.setRequestProperty("User-Agent", userAgent);
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status);
                if (!"https".equalsIgnoreCase(connection.getURL().getProtocol())
                        || !isChubHost(connection.getURL().getHost())) {
                    throw new IllegalStateException("Redirection hors de Chub refusée.");
                }
                long declared = connection.getContentLengthLong();
                if (declared > limit) throw new IllegalStateException("Fichier trop volumineux.");
                long total = 0;
                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > limit) throw new IllegalStateException("Fichier trop volumineux.");
                        output.write(buffer, 0, count);
                    }
                    output.getFD().sync();
                }
                if (total == 0 || !temporary.renameTo(destination)) {
                    throw new IllegalStateException("Fichier incomplet.");
                }
                boolean pairReady = new File(sessionDir, "card.json").isFile()
                        && new File(sessionDir, "card.png").isFile();
                showToast(pairReady
                        ? "Carte reçue. Retourne à Léa Studio pour l’ajouter à Ma bibliothèque."
                        : "Fichier reçu dans l’application. Télécharge aussi l’autre élément de la carte.");
            } catch (Exception error) {
                temporary.delete();
                showToast("Import Chub impossible : " + error.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        private void showToast(String text) {
            mainHandler.post(() -> Toast.makeText(context, text, Toast.LENGTH_LONG).show());
        }
    }
}
