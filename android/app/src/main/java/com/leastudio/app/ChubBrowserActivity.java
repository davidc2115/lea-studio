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
import org.json.JSONTokener;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ChubBrowserActivity extends Activity {
    public static final String EXTRA_URL = "com.leastudio.app.CHUB_URL";
    public static final String EXTRA_PROVIDER = "com.leastudio.app.CATALOG_PROVIDER";
    private static final String BOTBOORU_PENDING_ID = "lea_catalog_pending_id";
    private WebView browser;
    private File sessionDir;
    private String provider;

    private static boolean isChubHost(String host) {
        if (host == null) return false;
        String lower = host.toLowerCase();
        return lower.equals("chub.ai") || lower.endsWith(".chub.ai")
                || lower.equals("charhub.io") || lower.endsWith(".charhub.io");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        provider = getIntent().getStringExtra(EXTRA_PROVIDER);
        String url = getIntent().getStringExtra(EXTRA_URL);
        if (!isAllowedStartUrl(provider, url)) {
            finish();
            return;
        }
        if ("chub".equals(provider)) {
            sessionDir = new File(new File(getFilesDir(), "chub-pending"), String.valueOf(System.currentTimeMillis()));
            if (!sessionDir.mkdirs() && !sessionDir.isDirectory()) {
                Toast.makeText(this, "Impossible de préparer l’import interne.", Toast.LENGTH_LONG).show();
                finish();
                return;
            }
        }

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        TextView note = new TextView(this);
        note.setText("botbooru".equals(provider)
                ? "Botbooru · ouvre une fiche puis touche « Importer cette fiche »"
                : "Chub AI · télécharge la carte et son PNG; l’ajout se fait au retour");
        note.setPadding(16, 12, 16, 12);
        page.addView(note, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        browser = new WebView(this);
        page.addView(browser, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        Button close = new Button(this);
        close.setText("botbooru".equals(provider) ? "Importer cette fiche" : "Retour à Léa Studio");
        close.setOnClickListener(view -> {
            if ("botbooru".equals(provider)) importCurrentBotbooruPage();
            else finish();
        });
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
        if ("chub".equals(provider)) {
            browser.setDownloadListener(new ChubDownloadListener(this, browser, sessionDir));
        } else {
            browser.setDownloadListener((downloadUrl, userAgent, disposition, mime, length) -> {
                String id = botbooruDownloadId(downloadUrl);
                if (id != null) queueBotbooruImport(id);
                else Toast.makeText(this, "Téléchargement Botbooru non reconnu. Utilise Download JSON ou PNG sur la fiche.", Toast.LENGTH_LONG).show();
            });
        }
        CookieManager.getInstance().setAcceptCookie(true);
        browser.loadUrl(url);
    }

    private static boolean isAllowedStartUrl(String provider, String value) {
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getUserInfo() == null
                    && (("chub".equals(provider) && "chub.ai".equalsIgnoreCase(uri.getHost()))
                        || ("botbooru".equals(provider) && "botbooru.com".equalsIgnoreCase(uri.getHost())));
        } catch (Exception ignored) {
            return false;
        }
    }

    private void importCurrentBotbooruPage() {
        String currentUrl = browser == null ? null : browser.getUrl();
        if (currentUrl == null || !"botbooru.com".equalsIgnoreCase(Uri.parse(currentUrl).getHost())) {
            Toast.makeText(this, "Ouvre d’abord une fiche sur Botbooru.", Toast.LENGTH_LONG).show();
            return;
        }
        String path = Uri.parse(currentUrl).getPath();
        java.util.regex.Matcher match = java.util.regex.Pattern
                .compile("/(?:post|posts)/(\\d{1,12})(?:/|$)", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(path == null ? "" : path);
        if (match.find()) {
            queueBotbooruImport(match.group(1));
            return;
        }

        // Some Botbooru pages use slugs instead of numeric paths. Read the allowed
        // download links already rendered by the page, including buttons exposing
        // their download target in a data attribute; do not probe catalogue routes.
        browser.evaluateJavascript(
                "(function(){"
                        + "var els=Array.from(document.querySelectorAll('a[href],button,[data-download-url],[data-href]'));"
                        + "for(var i=0;i<els.length;i++){var e=els[i],text=(e.innerText||e.getAttribute('aria-label')||'').toLowerCase();"
                        + "var vals=[e.href,e.getAttribute('data-download-url'),e.getAttribute('data-href'),e.getAttribute('data-url')];"
                        + "for(var j=0;j<vals.length;j++){if(!vals[j])continue;try{var u=new URL(vals[j],location.href);"
                        + "if(u.origin!=='https://botbooru.com')continue;"
                        + "var m=u.pathname.match(/^\\/download\\/(?:json|png)\\/(\\d{1,12})\\/?$/i);if(m)return m[1];"
                        + "}catch(x){}}"
                        + "if(e.tagName==='BUTTON'&&/download\\s*(json|png)/i.test(text)){"
                        + "var id=e.getAttribute('data-id')||e.getAttribute('data-post-id');if(id&&/^\\d{1,12}$/.test(id))return id;}}"
                        + "return '';})()",
                value -> {
                    try {
                        Object parsed = new JSONTokener(value == null ? "\"\"" : value).nextValue();
                        String id = String.valueOf(parsed);
                        if (id.matches("\\d{1,12}")) queueBotbooruImport(id);
                        else Toast.makeText(this, "ID introuvable dans cette fiche. Touche Download JSON ou PNG sur Botbooru.", Toast.LENGTH_LONG).show();
                    } catch (Exception error) {
                        Toast.makeText(this, "ID introuvable dans cette fiche. Touche Download JSON ou PNG sur Botbooru.", Toast.LENGTH_LONG).show();
                    }
                });
    }

    private static String botbooruDownloadId(String value) {
        try {
            Uri uri = Uri.parse(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"botbooru.com".equalsIgnoreCase(uri.getHost())) return null;
            java.util.regex.Matcher match = java.util.regex.Pattern
                    .compile("^/download/(?:json|png)/(\\d{1,12})/?$", java.util.regex.Pattern.CASE_INSENSITIVE)
                    .matcher(uri.getPath() == null ? "" : uri.getPath());
            return match.matches() ? match.group(1) : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private void queueBotbooruImport(String id) {
        getSharedPreferences("lea_catalog_import", MODE_PRIVATE)
                .edit().putString(BOTBOORU_PENDING_ID, id).apply();
        Toast.makeText(this, "Fiche trouvée. Téléchargement et import dans Léa Studio…", Toast.LENGTH_LONG).show();
        finish();
    }

    @Override
    public void onBackPressed() {
        if (browser != null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    private static final class ChubDownloadListener implements DownloadListener {
        private final Context context;
        private final WebView browser;
        private final File sessionDir;
        private final ExecutorService executor = Executors.newSingleThreadExecutor();
        private final Handler mainHandler = new Handler(Looper.getMainLooper());

        ChubDownloadListener(Context context, WebView browser, File sessionDir) {
            this.context = context;
            this.browser = browser;
            this.sessionDir = sessionDir;
        }

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                   String mimeType, long contentLength) {
            try {
                Uri uri = Uri.parse(url);
                if ("blob".equalsIgnoreCase(uri.getScheme())) {
                    captureChubBlob(url, contentDisposition, mimeType);
                    return;
                }
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

        private void captureChubBlob(String url, String disposition, String mimeType) {
            String page = browser.getUrl();
            Uri pageUri = Uri.parse(page == null ? "" : page);
            Uri blobUri = Uri.parse(url.substring("blob:".length()));
            if (!"https".equalsIgnoreCase(pageUri.getScheme()) || !isChubHost(pageUri.getHost())
                    || !"https".equalsIgnoreCase(blobUri.getScheme()) || !isChubHost(blobUri.getHost())) {
                showToast("Export Chub refusé : origine non autorisée.");
                return;
            }
            String script = "(function(){window.__leaChubExportState='loading';window.__leaChubExportValue='';"
                    + "fetch(" + org.json.JSONObject.quote(url) + ").then(function(r){return r.blob()}).then(function(b){"
                    + "if(b.size>12582912)throw Error('Fichier trop volumineux');"
                    + "return new Promise(function(ok,no){var f=new FileReader();f.onload=function(){ok(f.result)};"
                    + "f.onerror=function(){no(Error('Lecture impossible'))};f.readAsDataURL(b)})"
                    + "}).then(function(v){window.__leaChubExportValue=v;window.__leaChubExportState='done'})"
                    + ".catch(function(e){window.__leaChubExportState='error:'+String(e).slice(0,100)});return 'started'})()";
            browser.evaluateJavascript(script, null);
            pollChubBlob(0, disposition, mimeType);
        }

        private void pollChubBlob(int attempt, String disposition, String mimeType) {
            if (attempt >= 120) {
                showToast("Délai dépassé pendant la récupération de l’export Chub.");
                return;
            }
            browser.evaluateJavascript("window.__leaChubExportState||''", value -> {
                String state;
                try { state = String.valueOf(new JSONTokener(value == null ? "\"\"" : value).nextValue()); }
                catch (Exception ignored) { state = ""; }
                if ("done".equals(state)) {
                    browser.evaluateJavascript("window.__leaChubExportValue||''", encoded -> {
                        try {
                            String dataUrl = String.valueOf(new JSONTokener(encoded).nextValue());
                            browser.evaluateJavascript("window.__leaChubExportValue='';window.__leaChubExportState='';void 0", null);
                            saveCapturedChubBlob(dataUrl, disposition, mimeType);
                        } catch (Exception error) {
                            showToast("Export Chub illisible.");
                        }
                    });
                } else if (state.startsWith("error:")) {
                    showToast("Export Chub impossible : " + state.substring(6));
                } else {
                    mainHandler.postDelayed(() -> pollChubBlob(attempt + 1, disposition, mimeType), 250);
                }
            });
        }

        private void saveCapturedChubBlob(String dataUrl, String disposition, String mimeType) {
            try {
                int comma = dataUrl.indexOf(',');
                if (comma < 0) throw new IllegalArgumentException("data URI absente");
                String header = dataUrl.substring(0, comma).toLowerCase();
                String guessed = URLUtil.guessFileName("https://chub.ai/" + disposition, disposition, mimeType).toLowerCase();
                String base64 = dataUrl.substring(comma + 1);
                if (base64.length() > 17_000_000) throw new IllegalArgumentException("fichier trop volumineux");
                byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                boolean pngSignature = bytes.length >= 8 && bytes[0] == (byte) 0x89
                        && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47;
                boolean png = header.contains("image/png") || guessed.endsWith(".png") || pngSignature;
                boolean json = header.contains("json") || guessed.endsWith(".json");
                if (!json && !png) {
                    String text = new String(bytes, java.nio.charset.StandardCharsets.UTF_8).trim();
                    if (text.startsWith("{")) json = true;
                }
                if (json == png) throw new IllegalArgumentException("format non reconnu");
                if (json) {
                    if (bytes.length == 0 || bytes.length > 5L * 1024 * 1024) throw new IllegalArgumentException("JSON trop volumineux");
                    Object parsed = new JSONTokener(new String(bytes, java.nio.charset.StandardCharsets.UTF_8)).nextValue();
                    if (!(parsed instanceof org.json.JSONObject)) throw new IllegalArgumentException("carte JSON invalide");
                } else {
                    if (bytes.length > 12L * 1024 * 1024 || !pngSignature) {
                        throw new IllegalArgumentException("PNG invalide");
                    }
                }
                File target = new File(sessionDir, json ? "card.json" : "card.png");
                File part = new File(sessionDir, (json ? "card.json" : "card.png") + ".part");
                try (FileOutputStream output = new FileOutputStream(part)) {
                    output.write(bytes);
                    output.getFD().sync();
                }
                if (!part.renameTo(target)) throw new IllegalStateException("écriture impossible");
                showToast(json ? "Carte Chub récupérée. L’image PNG est encore nécessaire." : "Image Chub récupérée. Le JSON est encore nécessaire.");
            } catch (Exception error) {
                showToast("Export Chub refusé : " + String.valueOf(error.getMessage()));
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
