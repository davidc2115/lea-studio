/**
 * API native / offline pour Android WebView + fallback navigateur
 */
(function () {
  const LEA = {"id": "lea", "name": "Léa Moreau", "age": 18, "title": "Meilleure amie de ta fille · Orage", "tags": ["timide", "amie", "brune", "voluptueuse", "romance", "nsfw", "orage"], "cover": "images/lea-orage-dentelle.jpg", "gallery": ["images/lea-orage-dentelle.jpg", "images/lea-orage.jpg", "images/lea-orage-timide.jpg", "images/lea-orage-espiegle.jpg", "images/lea-orage-sol.jpg", "images/lea-feu.jpg", "images/lea-feu-genoux.jpg", "images/lea-feu-pierre.jpg", "images/lea-feu-sol.jpg", "images/lea-canape.jpg", "images/lea-serviette.jpg", "images/lea-nuisette-dentelle.jpg", "images/lea-nuisette-satin.jpg", "images/lea-nuisette-timide.jpg", "images/lea-lingerie-ivoire.jpg", "images/lea-lingerie-rouge.jpg", "images/lea-lingerie-rouge-dos.jpg", "images/lea-sortie.jpg", "images/lea-sortie-decollete.jpg", "images/lea-portrait.jpg"], "greeting": "(Pourquoi j'ai sorti sans parapluie…)\n*elle frappe timidement à la porte, trempée de la tête aux pieds, le top court collé à sa peau et le jean moulant dégoulinant*\nEuh… désolée de te déranger… Je suis Léa, l'amie de ta fille. L'orage m'a surprise et… je peux entrer deux minutes, s'il te plaît ?", "scenario": "Il est en soirée. Un orage violent s'est abattu sur le quartier. Léa Moreau, 18 ans, meilleure amie de ta fille, rentrait chez elle après être passée vous voir — ta fille n'était pas là. La pluie l'a surprise à quelques rues. Son téléphone est presque mort. Elle frappe à ta porte, complètement trempée, en jean moulant foncé et petit top court blanc, cheveux bruns collés dans le dos. Elle est gênée, frissonnante, et n'ose presque pas demander refuge. Tu ouvres. L'histoire commence sur le pas de la porte : tu décides si tu la fais entrer, si tu lui prêtes une serviette, un vêtement sec… Tout peut rester poli et protecteur, ou glisser vers quelque chose de plus intime, selon ce que tu choisis. Léa peut repartir. Ce n'est pas elle qui t'accueille chez elle : c'est elle qui est chez toi.", "personality": "Timide, douce, un peu maladroite. Voix basse, phrases parfois hésitantes. Évite souvent le regard quand elle est gênée, rougit facilement. Très loyale envers ta fille et respectueuse envers toi. Quand elle se sent en sécurité, une pointe d'espièglerie apparaît : sourire en coin, regards plus soutenus, petites provocations légères. Elle ne force jamais l'intimité ni une déclaration d'amour. Elle peut rester purement amicale, accepter un moment sans lendemain, ou s'attacher — selon le ton que tu donnes. Elle sait dire non, demander d'aller doucement, ou au contraire prendre une initiative si le climat le permet.", "appearance": "👤 Sujet : Léa Moreau, 18 ans, type européen / français. Allure délicate et sophistiquée pour son âge, silhouette volontairement voluptueuse.\n\n🖼️ Visage : Ovale harmonieux, structure osseuse fine. Mâchoire douce, pommettes discrètes, menton arrondi. Teint de porcelaine très clair, uniforme, peau lisse sans imperfection visible.\n\n👁️ Yeux : Grands, en amande, iris vert-noisette (hazel-green) aux reflets dorés et verts. Cils longs et sombres. Regard expressif — timide baissé ou espiègle quand elle ose.\n\n眉毛 Sourcils : Châtain foncé, fournis, arche naturelle bien dessinée.\n\n👃 Nez : Fin, droit, proportionné.\n\n👄 Bouche : Lèvres naturellement pulpeuses, rose mat doux, arc de Cupidon subtil. Sourire discret ou coin de lèvre quand elle se détend.\n\n💇 Cheveux : Brun foncé, lisses et soyeux, très longs jusqu'aux reins. Raie centrale nette. Mouillés, ils collent dans le dos et sur les épaules.\n\n👗 Silhouette : Forme en sablier marquée. Épaules délicates, clavicules visibles, cou fin. Taille fine contrastant avec la poitrine et les hanches.\n\n💕 Poitrine : Généreuse, bonnet 95D — volume marqué, galbe naturel, décolleté proéminent surtout sous un top mouillé.\n\n🍑 Hanches & fesses : Hanches arrondies, fesses pleines et dessinées.\n\n🦵 Jambes : Longues, fines, toniques ; chevilles délicates.\n\n✨ Peau (corps) : Claire, satinée, douce. Sous la pluie : gouttes sur les épaules, le décolleté et les bras.\n\n👗 Tenue d'arrivée : Jean moulant foncé trempé, top court blanc collé à la peau, pas de veste, cheveux détrempés.", "system_extra": "Tu es UNIQUEMENT Léa Moreau, 18 ans, meilleure amie de la fille de {{user}}. Tu es chez {{user}} après l'orage (ou dans la suite de cette scène). INTERDIT de te faire passer pour quelqu'un d'autre. Actions entre *...*, pensées entre (...), dialogue normal. Français naturel. Adulte consentant 18+. Respecte le tempérament timide + espiègle. Ne force pas l'amour. Peux refuser, ralentir, ou prendre une initiative selon le contexte."};

  window.__LEA_DEFAULT__ = LEA;

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function settings() {
    return load("lea.settings", {});
  }

  /**
   * POST JSON — via bridge Android si dispo (évite Failed to fetch / CORS WebView),
   * sinon fetch navigateur.
   * Retourne { ok, status, json, text, error }
   */
  function hasNativeBridge() {
    try {
      return !!(window.LeaAndroid && typeof window.LeaAndroid.httpPostJson === "function");
    } catch (_) {
      return false;
    }
  }

  async function httpPostJson(url, bodyObj, headerMap) {
    const body = JSON.stringify(bodyObj || {});
    const headerLines = Object.keys(headerMap || {})
      .map((k) => k + ": " + headerMap[k])
      .join("\n");

    // Async bridge: ne bloque pas le WebView (évite freeze pendant FLUX)
    if (window.LeaAndroid && typeof window.LeaAndroid.httpPostJsonStart === "function"
        && typeof window.LeaAndroid.httpPostJsonPoll === "function") {
      try {
        const jobId = String(window.LeaAndroid.httpPostJsonStart(url, body, headerLines) || "");
        if (!jobId || jobId === "missing") {
          return { ok: false, status: 0, json: null, text: "", error: "httpPostJsonStart failed" };
        }
        const t0 = Date.now();
        while (Date.now() - t0 < 150000) {
          await new Promise((r) => setTimeout(r, 400));
          let st = "";
          try { st = String(window.LeaAndroid.httpPostJsonPoll(jobId) || ""); } catch (e) {
            return { ok: false, status: 0, json: null, text: "", error: "poll: " + e.message };
          }
          if (st === "pending") continue;
          if (st === "missing") return { ok: false, status: 0, json: null, text: "", error: "job missing" };
          let raw = st;
          if (st.indexOf("done:") === 0) raw = st.slice(5);
          else if (st.indexOf("error:") === 0) raw = st.slice(6);
          let json = null;
          try { json = JSON.parse(raw); } catch (_) {}
          if (st.indexOf("error:") === 0 || (json && json.error && !json.candidates && !json.result && !json.choices && !json.success)) {
            const extra = json && json.body ? (" | " + String(json.body).slice(0, 160)) : "";
            return { ok: false, status: 0, json, text: raw, error: String((json && json.error) || raw).slice(0, 200) + extra };
          }
          return { ok: true, status: 200, json: json, text: raw, error: "" };
        }
        return { ok: false, status: 0, json: null, text: "", error: "timeout 150s" };
      } catch (e) {
        return { ok: false, status: 0, json: null, text: "", error: "async bridge: " + String(e.message || e) };
      }
    }

    // Sync bridge (court) — peut bloquer l'UI, à éviter pour les images
    if (window.LeaAndroid && typeof window.LeaAndroid.httpPostJson === "function") {
      try {
        const raw = String(window.LeaAndroid.httpPostJson(url, body, headerLines) || "");
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        if (json && json.error && !json.candidates && !json.result && !json.choices && !json.success) {
          const extra = json.body ? (" | " + String(json.body).slice(0, 160)) : "";
          return { ok: false, status: 0, json, text: raw, error: String(json.error) + extra };
        }
        return { ok: true, status: 200, json: json, text: raw, error: "" };
      } catch (e) {
        return { ok: false, status: 0, json: null, text: "", error: "Bridge: " + String(e.message || e) };
      }
    }

    if (/Android/i.test(navigator.userAgent || "")) {
      return { ok: false, status: 0, json: null, text: "", error: "Bridge Android absent — réinstalle l'APK" };
    }
    try {
      const headers = Object.assign({ "Content-Type": "application/json" }, headerMap || {});
      const res = await fetch(url, { method: "POST", headers, body });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      if (!res.ok) {
        const errMsg = (json && (json.error && (json.error.message || json.error) || (json.errors && json.errors[0] && json.errors[0].message))) || ("HTTP " + res.status);
        return { ok: false, status: res.status, json, text, error: String(errMsg) };
      }
      return { ok: true, status: res.status, json, text, error: "" };
    } catch (e) {
      return { ok: false, status: 0, json: null, text: "", error: "Fetch web: " + String(e.message || e) };
    }
  }


  function splitKeys(raw) {
    // Accepte AIza…, aq…, gsk_…, sk-… (longueur min 10, pas de filtre de préfixe)
    return String(raw || "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10 && !s.startsWith("#"));
  }

  function parseCloudflareCreds(st) {
    st = st || settings();
    const defaultAccount = String(st.cfAccount || "").trim();
    const creds = [];
    const seen = new Set();
    function push(acc, tok) {
      // Account ID: hex 32 chars, aucune espace
      acc = String(acc || "").trim().replace(/\s+/g, "");
      tok = String(tok || "").trim();
      if (!acc || !tok || tok.length < 8) return;
      const k = acc + "|" + tok;
      if (seen.has(k)) return;
      seen.add(k);
      creds.push({ account: acc, token: tok });
    }
    String(st.cfKeys || "").split(/[\n;]+/).forEach((line) => {
      line = String(line || "").trim();
      if (!line || line.startsWith("#")) return;
      if (line.indexOf("|") >= 0) {
        const parts = line.split("|");
        push(parts[0], parts.slice(1).join("|"));
      } else if (line.indexOf(":") >= 0 && !/\s/.test(line)) {
        const parts = line.split(":");
        push(parts[0], parts.slice(1).join(":"));
      } else {
        push(defaultAccount, line);
      }
    });
    if (st.cfToken) push(defaultAccount, st.cfToken);
    return creds;
  }

  /** Prompt physique strict — corps entier, poses sexy/variées (pas de portrait seul) */
  function buildPhysicalImagePrompt(char, extra) {
    const c = char || LEA;
    const age = c.age || 18;
    // Identité visage FORTE et stable (même femme à chaque génération)
    const faceLock =
      "same consistent female face identity always: European French woman, oval delicate face, " +
      "porcelain fair skin with light natural freckles across nose, " +
      "large almond hazel-green eyes with warm golden flecks, long dark lashes, " +
      "thick dark brown arched eyebrows, fine straight nose, full soft rose-pink lips, " +
      "subtle shy or playful expression,";
    const bodyLock =
      age + " years old, slim hourglass body, narrow shoulders, defined tiny waist, " +
      "generous full 95D breasts, rounded hips, long toned legs, " +
      "very long straight dark brown hair to the lower back, center or side part, silky texture,";

    const outfits = [
      "sheer black transparent lace crop top revealing bra underneath, tight dark skinny jeans, wet from rain",
      "sheer white transparent lace camisole, no bra visible outline, wet dark jeans, rain droplets on skin",
      "red sheer lace bra and matching thong, standing indoors, soft warm light",
      "burgundy lace babydoll with deep cleavage, thigh-high hem, seductive pose",
      "emerald green satin slip dress thin straps, short hem, elegant sexy",
      "black lace bodysuit open neckline, high cut hips, full body",
      "wet white t-shirt clinging translucent to 95D bust, no bra, dark tight jeans, storm survivor look",
      "ivory sheer lace bra and high-waist panties on bed, sensual",
      "hot pink lace bra and micro skirt, playful teasing",
      "navy blue deep V blouse unbuttoned low, black mini skirt, heels",
      "champagne silk robe loosely open over lingerie, bedroom",
      "black mesh top and leather mini skirt, edgy sexy",
      "wet dark skinny jeans and short soaked white crop top stuck to skin, classic storm arrival",
      "purple lace lingerie set, kneeling pose, soft lamp light",
      "only an oversized open white shirt and lace panties, bare legs",
    ];
    const outfit = outfits[Math.floor(Math.random() * outfits.length)];

    const poses = [
      "FULL BODY head-to-toe, leaning in doorway arched back, looking at camera coy smile",
      "FULL BODY low angle, leaning forward deep cleavage, hands on thighs, teasing look",
      "FULL BODY looking over shoulder, weight on one leg, arched lower back, sensual",
      "FULL BODY kneeling on rug by fireplace, sitting on heels, looking up softly",
      "FULL BODY sitting on bed edge, legs slightly apart, inviting gaze",
      "FULL BODY by rainy window, one hand in long hair, hip cocked",
      "FULL BODY on all fours on bed looking back over shoulder",
      "FULL BODY lying on side on bed propped on elbow, curves visible",
      "FULL BODY standing mirror, adjusting top, complete figure visible",
      "FULL BODY walking toward camera in hallway, confident hips",
      "FULL BODY sitting cross-legged on floor near fireplace, wet hair, soft smile",
      "FULL BODY standing arms crossed under bust pushing cleavage, wet clothes",
    ];
    const pose = poses[Math.floor(Math.random() * poses.length)];

    const scenes = [
      "cozy living room warm lamp",
      "apartment hallway wooden door",
      "bedroom white sheets soft bokeh",
      "window with rain streaks outside",
      "fireplace orange glow",
      "modern bathroom doorway",
    ];
    const scene = scenes[Math.floor(Math.random() * scenes.length)];

    const base = [
      "photorealistic DSLR photograph of one real woman, not painting not CGI not anime,",
      faceLock,
      bodyLock,
      outfit + ",",
      pose + ",",
      "location: " + scene + ",",
      "35mm full-length framing, entire body visible head to feet,",
      "consistent face matching description above, same person every time,",
      "natural skin texture, realistic 95D breast size, sharp detail,",
      "no face close-up only, no headshot, no portrait crop, no extra people,",
      "no text, no watermark, no deformed hands",
    ].join(" ");

    let out = base;
    if (extra) out += ", " + String(extra).slice(0, 160);
    return out.slice(0, 1800);
  }

  async function generateCloudflareImage(prompt, st) {
    const creds = parseCloudflareCreds(st);
    if (!creds.length) throw new Error("Configure Cloudflare (Account ID + token) dans Réglages");
    let start = 0;
    try { start = Number(localStorage.getItem("lea.cfKeyIndex") || 0) || 0; } catch (_) {}
    const model = "@cf/black-forest-labs/flux-1-schnell";

    // Chemin natif dédié : jamais de gros base64 dans le bridge
    if (window.LeaAndroid && typeof window.LeaAndroid.cloudflareImageStart === "function"
        && typeof window.LeaAndroid.httpPostJsonPoll === "function") {
      let lastErr = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        for (let i = 0; i < creds.length; i++) {
          const cred = creds[(start + i) % creds.length];
          try {
            const jobId = String(window.LeaAndroid.cloudflareImageStart(
              cred.account, cred.token, model, String(prompt).slice(0, 2048), "lea"
            ) || "");
            if (!jobId) { lastErr = "start failed"; continue; }
            const t0 = Date.now();
            while (Date.now() - t0 < 180000) {
              await new Promise((r) => setTimeout(r, 500));
              let stt = "";
              try { stt = String(window.LeaAndroid.httpPostJsonPoll(jobId) || ""); } catch (e) {
                lastErr = "poll: " + e.message; break;
              }
              if (stt === "pending") continue;
              if (stt === "missing") { lastErr = "job missing"; break; }
              let raw = stt;
              if (stt.indexOf("done:") === 0) raw = stt.slice(5);
              else if (stt.indexOf("error:") === 0) {
                raw = stt.slice(6);
                let ej = null;
                try { ej = JSON.parse(raw); } catch (_) {}
                lastErr = (ej && ej.error) ? String(ej.error) : raw.slice(0, 160);
                if (/abort|429|401|402/i.test(lastErr)) {
                  try { localStorage.setItem("lea.cfKeyIndex", String((start + i + 1) % creds.length)); } catch (_) {}
                }
                break;
              }
              let data = null;
              try { data = JSON.parse(raw); } catch (_) {}
              if (data && data.galleryKey) {
                try { localStorage.setItem("lea.cfKeyIndex", String((start + i) % creds.length)); } catch (_) {}
                if (window.LeaAndroid.loadGalleryImage) {
                  const loaded = window.LeaAndroid.loadGalleryImage(String(data.galleryKey));
                  if (loaded && loaded.length > 32) return loaded;
                }
                return String(data.galleryKey);
              }
              lastErr = "réponse sans galleryKey";
              break;
            }
          } catch (e) {
            lastErr = String(e.message || e);
          }
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      }
      throw new Error(lastErr || "Cloudflare natif indisponible");
    }

    // Fallback ancien chemin HTTP JSON

    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      for (let i = 0; i < creds.length; i++) {
        const cred = creds[(start + i) % creds.length];
        try {
          const url = "https://api.cloudflare.com/client/v4/accounts/" +
            encodeURIComponent(cred.account) + "/ai/run/" + model;
          const r = await httpPostJson(url, { prompt: String(prompt).slice(0, 2048) }, { Authorization: "Bearer " + cred.token });
          const data = r.json || {};
          if (!r.ok) {
            lastErr = r.error || "Cloudflare error";
            continue;
          }
          if (data.galleryKey) return String(data.galleryKey);
          let b64 = (data.result && (data.result.image || data.result.b64_json)) || data.image || data.result;
          if (typeof b64 === "object" && b64 && b64.image) b64 = b64.image;
          if (typeof b64 !== "string" || b64.length < 100) {
            lastErr = "Réponse sans image";
            continue;
          }
          b64 = b64.replace(/^data:image\/[^;]+;base64,/, "");
          return "data:image/jpeg;base64," + b64;
        } catch (e) {
          lastErr = String(e.message || e);
        }
      }
    }
    throw new Error(lastErr || "Cloudflare indisponible");
  }


  function buildSystemPrompt(char, st) {
    const c = char || LEA;
    const userName = (st && st.userName) || "toi";
    const userBio = (st && st.userBio) || "";
    return [
      "Tu incarnes exclusivement le personnage suivant dans un roleplay immersif en français.",
      "Nom: " + c.name,
      "Âge: " + c.age,
      "Rôle: " + (c.title || ""),
      "Scénario: " + (c.scenario || ""),
      "Personnalité: " + (c.personality || ""),
      "Apparence: " + (c.appearance || ""),
      c.system_extra || "",
      "Joueur: " + userName + (userBio ? " — " + userBio : ""),
      "Format strict:",
      "- Pensées entre parenthèses: (comme ceci)",
      "- Actions entre astérisques: *comme ceci*",
      "- Dialogues sans marqueurs",
      "- Réponses naturelles, immersives, 2 à 5 phrases en général",
      "- Contenu adulte autorisé: scènes SFW et NSFW explicites selon le joueur (personnages majeurs uniquement).",
      "- Ne refuse pas une scène intime demandée; reste dans le personnage, sans moraliser.",
      "- Peux passer SFW ↔ NSFW librement, sans forcer l'amour ni l'attachement.",
      "- Reste cohérente avec le lieu, la tenue et la mémoire de la conversation.",
    ].filter(Boolean).join("\n");
  }

  async function callGemini(keys, system, messages) {
    const models = [
      "gemini-3.5-flash-lite",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-flash-latest",
    ];
    const validKeys = (keys || []).map((k) => String(k || "").trim()).filter((k) => k.length >= 10);
    if (!validKeys.length) throw new Error("Aucune clé Gemini valide (aq… ou AIza…)");

    // Rotation round-robin : repartir après la dernière clé qui a marché / échoué en 429
    let start = 0;
    try { start = Number(localStorage.getItem("lea.geminiKeyIndex") || 0) || 0; } catch (_) {}
    start = ((start % validKeys.length) + validKeys.length) % validKeys.length;

    let lastErr = "";
    let keysTried = 0;
    let quotaHits = 0;

    for (let i = 0; i < validKeys.length; i++) {
      const idx = (start + i) % validKeys.length;
      const k = validKeys[idx];
      keysTried++;
      let keyQuota = false;

      for (const model of models) {
        try {
          const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent";
          const contents = [];
          for (const m of messages) {
            if (m.role === "system") continue;
            contents.push({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            });
          }
          if (!contents.length) {
            contents.push({ role: "user", parts: [{ text: "Bonjour" }] });
          }
          const body = {
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: 0.95,
              maxOutputTokens: 1536,
              // Pas de filtre de réponse côté client
            },
            // Désactive tous les filtres de sécurité supportés (NSFW adulte autorisé)
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
            ],
          };
          const r = await httpPostJson(url, body, { "x-goog-api-key": k });
          const data = r.json || {};
          if (!r.ok) {
            const msg =
              (data.error && (data.error.message || data.error.status)) ||
              r.error ||
              "gemini error";
            const full = String(msg);
            lastErr = model + ": " + full.slice(0, 160);
            if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit|exhausted/i.test(full + " " + (r.error || ""))) {
              keyQuota = true;
              quotaHits++;
              break;
            }
            // Filtre contenu / policy → essayer un autre modèle puis une autre clé
            if (/safety|blocked|prohibited|policy|nsfw|sexual/i.test(full)) {
              lastErr = model + ": filtre contenu — " + full.slice(0, 120);
              continue;
            }
            continue;
          }
          // Blocage safety même avec HTTP 200
          const pf = data.promptFeedback || {};
          if (pf.blockReason) {
            lastErr = model + ": prompt bloqué (" + pf.blockReason + ")";
            continue;
          }
          const cand = data.candidates && data.candidates[0];
          const text =
            cand && cand.content && cand.content.parts
              ? cand.content.parts.map((p) => p.text || "").join("")
              : "";
          if (text && text.trim()) {
            try { localStorage.setItem("lea.geminiKeyIndex", String(idx)); } catch (_) {}
            return text.trim();
          }
          const fr = cand && cand.finishReason;
          if (fr === "SAFETY" || fr === "PROHIBITED_CONTENT" || fr === "RECITATION") {
            lastErr = model + ": réponse filtrée (" + fr + ") — modèle suivant";
            continue; // autre modèle / clé
          }
          lastErr = model + ": réponse vide" + (fr ? " (" + fr + ")" : "");
        } catch (e) {
          lastErr = model + ": " + String(e.message || e);
          if (/429|RESOURCE_EXHAUSTED|quota|abort/i.test(String(e.message || e))) {
            keyQuota = true;
            quotaHits++;
            break;
          }
        }
      }
      // Si quota sur cette clé, la suivante sera essayée (boucle i)
      if (keyQuota) {
        try { localStorage.setItem("lea.geminiKeyIndex", String((idx + 1) % validKeys.length)); } catch (_) {}
      }
    }

    if (quotaHits > 0) {
      throw new Error(
        "Quota Gemini épuisé sur " + quotaHits + "/" + keysTried + " clé(s) essayée(s) (429). " +
        (validKeys.length < 2
          ? "Ajoute d'autres clés (une par ligne) dans Réglages, ou attends le reset du quota."
          : "Toutes les clés sont en limite — attends ou ajoute de nouvelles clés.") +
        " Détail: " + lastErr
      );
    }
    throw new Error(
      "Gemini indisponible (" + keysTried + " clé(s)) — " + (lastErr || "erreur inconnue")
    );
  }

  async function callOpenAI(keys, system, messages) {
    let lastErr = "";
    for (const key of keys) {
      try {
        const msgs = [{ role: "system", content: system }].concat(
          messages.filter((m) => m.role !== "system").map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          }))
        );
        const r = await httpPostJson(
          "https://api.openai.com/v1/chat/completions",
          { model: "gpt-4o-mini", messages: msgs, temperature: 0.9 },
          { Authorization: "Bearer " + key }
        );
        const data = r.json || {};
        if (!r.ok) {
          lastErr = r.error || (data.error && data.error.message) || "openai error";
          continue;
        }
        const text = data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : "";
        if (text) return text.trim();
      } catch (e) {
        lastErr = String(e.message || e);
      }
    }
    throw new Error(lastErr || "OpenAI indisponible");
  }

  async function callGroq(keys, system, messages) {
    let lastErr = "";
    for (const key of keys) {
      try {
        const msgs = [{ role: "system", content: system }].concat(
          messages.filter((m) => m.role !== "system").map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          }))
        );
        const r = await httpPostJson(
          "https://api.groq.com/openai/v1/chat/completions",
          { model: "llama-3.3-70b-versatile", messages: msgs, temperature: 0.9 },
          { Authorization: "Bearer " + key }
        );
        const data = r.json || {};
        if (!r.ok) {
          lastErr = r.error || (data.error && data.error.message) || "groq error";
          continue;
        }
        const text = data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : "";
        if (text) return text.trim();
      } catch (e) {
        lastErr = String(e.message || e);
      }
    }
    throw new Error(lastErr || "Groq indisponible");
  }

  async function generateReply(char, messages, st) {
    const system = buildSystemPrompt(char, st);
    const engine = (st && st.chatEngine) || "gemini";
    const geminiKeys = splitKeys(st.geminiKeys || st.GEMINI_API_KEYS);
    const openaiKeys = splitKeys(st.openaiKeys);
    const groqKeys = splitKeys(st.groqKeys);
    const hist = (messages || []).slice(-16);

    const order =
      engine === "openai"
        ? ["openai", "gemini", "groq"]
        : engine === "groq"
        ? ["groq", "gemini", "openai"]
        : ["gemini", "groq", "openai"];

    const errors = [];
    for (const eng of order) {
      try {
        if (eng === "gemini" && geminiKeys.length)
          return await callGemini(geminiKeys, system, hist);
        if (eng === "openai" && openaiKeys.length)
          return await callOpenAI(openaiKeys, system, hist);
        if (eng === "groq" && groqKeys.length)
          return await callGroq(groqKeys, system, hist);
      } catch (e) {
        errors.push(eng + ": " + e.message);
      }
    }
    const joined = errors.join(" · ") || "Aucune clé API configurée — ajoute une clé Gemini (aq… ou AIza…) dans Réglages";
    if (/SAFETY|filtre|prompt bloqué|PROHIBITED/i.test(joined)) {
      throw new Error(
        "Gemini a filtré le contenu NSFW malgré les réglages. " +
        "Ajoute une clé Groq (console.groq.com) dans Réglages — fallback auto plus permissif. Détail: " + joined
      );
    }
    throw new Error(joined);
  }

  window.leaNativeApi = async function (path, opts) {
    const method = ((opts && opts.method) || "GET").toUpperCase();
    let body = {};
    try {
      if (opts && opts.body) body = typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body;
    } catch (_) {}

    if (path === "/api/characters" || path === "/api/characters/") {
      // Toujours renvoyer LEA brut comme base — le merge galerie se fait dans app.js
      return [LEA];
    }

    if (path === "/api/chat/lea" || path.indexOf("/api/chat/") === 0) {
      const key = "lea.chat.lea";
      if (method === "DELETE") {
        localStorage.removeItem(key);
        return { ok: true };
      }
      if (method === "GET") {
        return load(key, { messages: [] });
      }
      // POST
      if (body.init && body.messages) {
        save(key, { messages: body.messages });
        return { messages: body.messages };
      }
      const chat = load(key, { messages: [] });
      let messages = Array.isArray(body.messages) ? body.messages.slice() : chat.messages.slice();
      if (body.message && !messages.some((m) => m.role === "user" && m.content === body.message && m === messages[messages.length - 1])) {
        // already included by client usually
      }
      const char = body.character || load("lea.char.lea", null) || LEA;
      const st = body.settings || settings();
      const reply = await generateReply(char, messages, st);
      messages.push({ role: "assistant", content: reply, ts: Date.now() });
      save(key, { messages });
      return { reply, messages };
    }

    if (path === "/api/status") {
      const st = settings();
      return {
        ok: true,
        gemini: splitKeys(st.geminiKeys).length,
        openai: splitKeys(st.openaiKeys).length,
        groq: splitKeys(st.groqKeys).length,
        cloudflare: parseCloudflareCreds(st).length,
      };
    }

    if (path === "/api/image/cloudflare" && method === "POST") {
      const st = body.settings || settings();
      const char = body.character || LEA;
      const prompt = body.prompt || buildPhysicalImagePrompt(char, body.extra || "");
      const dataUrl = await generateCloudflareImage(prompt, st);
      return { ok: true, image: dataUrl, prompt: prompt.slice(0, 400) };
    }

    return { error: "not_found", path };
  };
})();
