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
      acc = String(acc || "").trim();
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
    // Identité courte (visage + corps), sans noyer le prompt en détails de peau
    const identity =
      age + " year old French woman, oval delicate face, porcelain fair skin, large almond hazel-green eyes with golden flecks, " +
      "dark brown thick arched eyebrows, fine straight nose, full soft pink lips, " +
      "very long straight dark brown hair down to lower back, " +
      "slim hourglass figure, narrow shoulders, tiny waist, generous 95D full bust, rounded hips, long toned legs";

    const wetOutfits = [
      "soaked from rain storm: tight wet dark skinny jeans clinging to thighs and hips, short tight white crop top stuck translucent to skin and cleavage, no jacket, wet hair dripping on shoulders and back",
      "just entered from storm: dripping wet dark skinny jeans, soaked white short crop top clinging to 95D bust, water droplets on collarbones, wet long hair plastered to face and back",
      "standing in hallway after rain: wet clinging skinny jeans, crop top molded to body, bare midriff wet, hair soaked straight down the back",
    ];
    const sexyOutfits = [
      "sheer red lace lingerie set, matching bra and panties, soft indoor light",
      "short black mini skirt and deep V white blouse slightly open, strappy heels",
      "satin champagne babydoll nightie, thin straps, thigh-length hem",
      "ivory lace bra and high-waist briefs on a bed, sensual lounge pose",
      "tight white shirt tied under the bust and black mini skirt, doorway pose",
    ];
    const isStorm = /orage|tremp|pluie|mouill/i.test(String(c.scenario || "") + " " + String(c.greeting || ""));
    const outfitPool = isStorm ? wetOutfits.concat(sexyOutfits) : sexyOutfits.concat(wetOutfits);
    const outfit = outfitPool[Math.floor(Math.random() * outfitPool.length)];

    const poses = [
      "FULL BODY wide shot head to toe, standing in doorway leaning on frame, arched back, looking at camera with shy coy smile",
      "FULL BODY from slightly low angle, leaning forward showing cleavage, hands on thighs, playful teasing look",
      "FULL BODY three-quarter view, looking over shoulder at camera, weight on one leg, arched lower back, sensual",
      "FULL BODY kneeling on rug by fireplace, sitting back on heels, wet clothes, looking up with soft smile",
      "FULL BODY sitting on edge of bed or sofa, legs crossed, torso upright, inviting gaze",
      "FULL BODY standing near window with rain outside, one hand in wet hair, hip cocked, body fully visible",
      "FULL BODY on all fours on bed looking back over shoulder, playful expression, entire body in frame",
      "FULL BODY lying on side on bed propped on elbow, curves visible, looking at camera",
      "FULL BODY standing mirror pose, hands adjusting wet crop top, body in frame from head to feet",
      "FULL BODY walking toward camera in hallway, confident hips, complete figure visible",
    ];
    const pose = poses[Math.floor(Math.random() * poses.length)];

    const scenes = [
      "cozy living room with warm lamp light",
      "apartment hallway with wooden door",
      "bedroom with white sheets soft bokeh",
      "near a window with rain streaks",
      "by a fireplace orange glow",
    ];
    const scene = scenes[Math.floor(Math.random() * scenes.length)];

    const base = [
      "photorealistic DSLR photo of a real person, not a painting, not CGI,",
      identity + ",",
      outfit + ",",
      pose + ",",
      "environment: " + scene + ",",
      "camera: 35mm lens, f/2.8, full-length framing, subject fully visible head to toe, generous negative space,",
      "natural skin pores, realistic fabric wetness when wet, accurate 95D breast size, no exaggeration to cartoon,",
      "sharp focus, high detail, 8k photo,",
      "IMPORTANT: full body visible, not a face crop, not a headshot, not a close-up portrait, not upper body only,",
      "no text, no watermark, no extra limbs, no deformed hands, no anime, no illustration",
    ].join(" ");

    let out = base;
    if (extra) out += ", " + String(extra).slice(0, 180);
    // FLUX Schnell ~2048 chars max useful
    return out.slice(0, 2000);
  }

  async function generateCloudflareImage(prompt, st) {
    const creds = parseCloudflareCreds(st);
    if (!creds.length) throw new Error("Configure Cloudflare (Account ID + token) dans Réglages");
    let start = 0;
    try { start = Number(localStorage.getItem("lea.cfKeyIndex") || 0) || 0; } catch (_) {}
    const models = [
      "@cf/black-forest-labs/flux-1-schnell",
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    ];
    let lastErr = "";
    for (let i = 0; i < creds.length; i++) {
      const cred = creds[(start + i) % creds.length];
      for (const model of models) {
        try {
          const url = "https://api.cloudflare.com/client/v4/accounts/" +
            encodeURIComponent(cred.account) + "/ai/run/" + model;
          const body = model.indexOf("flux") >= 0
            ? { prompt: String(prompt).slice(0, 2048) }
            : { prompt: String(prompt).slice(0, 2048), num_steps: 20 };
          const r = await httpPostJson(url, body, { Authorization: "Bearer " + cred.token });
          const data = r.json || {};
          if (!r.ok) {
            lastErr = r.error || "Cloudflare error";
            if (/401|unauthorized|Authentication/i.test(lastErr)) {
              lastErr = "Cloudflare 401 — token ou Account ID incorrect. Workers AI > API token (Workers AI Read) + Account ID (32 car. hex) dans Réglages.";
            }
            if (/400|401|429|402|quota|unauthorized|forbidden/i.test(String(r.error || ""))) {
              try { localStorage.setItem("lea.cfKeyIndex", String((start + i + 1) % creds.length)); } catch (_) {}
            }
            continue;
          }
          let b64 = (data.result && (data.result.image || data.result.b64_json)) ||
            data.image || data.result;
          if (typeof b64 === "object" && b64 && b64.image) b64 = b64.image;
          if (typeof b64 !== "string" || b64.length < 100) {
            lastErr = "Réponse Cloudflare sans image";
            continue;
          }
          b64 = b64.replace(/^data:image\/[^;]+;base64,/, "");
          try { localStorage.setItem("lea.cfKeyIndex", String((start + i) % creds.length)); } catch (_) {}
          return "data:image/jpeg;base64," + b64;
        } catch (e) {
          lastErr = String(e.message || e);
        }
      }
    }
    throw new Error(lastErr || "Cloudflare image échoué");
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
      "- Peux passer SFW ↔ NSFW selon le joueur, sans forcer l'amour",
      "- Reste cohérente avec le lieu (chez le joueur après l'orage) et la tenue tant que le joueur ne change pas la scène",
    ].filter(Boolean).join("\n");
  }

  async function callGemini(keys, system, messages) {
    // Modèles 2026 : les 2.x / 1.5 renvoient souvent 404 sur les nouvelles clés
    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-flash-latest",
    ];
    let lastErr = "";
    for (const key of keys) {
      const k = String(key || "").trim();
      if (k.length < 10) continue;
      for (const model of models) {
        try {
          // Clé en header (recommandé Google) — pas dans l'URL
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
              temperature: 0.9,
              maxOutputTokens: 1024,
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          };
          const r = await httpPostJson(url, body, { "x-goog-api-key": k });
          const data = r.json || {};
          if (!r.ok) {
            const msg =
              (data.error && (data.error.message || data.error.status)) ||
              r.error ||
              "gemini error";
            lastErr = model + ": " + String(msg).slice(0, 180);
            // 404 = modèle inaccessible pour cette clé → essayer le suivant
            continue;
          }
          const text =
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts
              ? data.candidates[0].content.parts.map((p) => p.text || "").join("")
              : "";
          if (text) return text.trim();
          const block = data.candidates && data.candidates[0] && data.candidates[0].finishReason;
          lastErr = model + ": réponse vide" + (block ? " (" + block + ")" : "");
        } catch (e) {
          lastErr = model + ": " + String(e.message || e);
        }
      }
    }
    throw new Error(lastErr || "Gemini indisponible — crée une clé sur aistudio.google.com et utilise gemini-3.5-flash-lite");
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
    throw new Error(errors.join(" · ") || "Aucune clé API configurée — ajoute une clé Gemini (aq… ou AIza…) dans Réglages");
  }

  window.leaNativeApi = async function (path, opts) {
    const method = ((opts && opts.method) || "GET").toUpperCase();
    let body = {};
    try {
      if (opts && opts.body) body = typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body;
    } catch (_) {}

    if (path === "/api/characters" || path === "/api/characters/") {
      const o = load("lea.char.lea", null);
      return [o ? Object.assign({}, LEA, o, { id: "lea" }) : LEA];
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
