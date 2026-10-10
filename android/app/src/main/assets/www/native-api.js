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

  /** Prompt physique strict à partir de la fiche personnage */
  function buildPhysicalImagePrompt(char, extra) {
    const c = char || LEA;
    const age = c.age || 18;
    const appearance = String(c.appearance || "")
      .replace(/[👤🖼️👁️👃👄💇👗💕🍑🦵✨眉毛]/g, " ")
      .replace(/\n+/g, ", ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
    const scenarioHint = /orage|tremp|pluie|mouill/i.test(String(c.scenario || "") + " " + String(c.greeting || ""))
      ? "soaked wet clothes from rain storm, wet dark skinny jeans clinging to legs, short white crop top stuck to skin, long wet dark brown hair clinging to back,"
      : "stylish casual outfit matching her role,";
    const poses = [
      "standing three-quarter view, shy soft smile looking at camera, full body",
      "leaning in doorway, arms lightly crossed, timid expression, full body",
      "sitting on edge of sofa, looking up, wet hair, three-quarter body",
      "standing near window, rain outside, soft natural light, full body",
      "slightly turned, looking over shoulder, coy expression, full body",
      "kneeling by fireplace warming hands, wet clothes, full body",
    ];
    const pose = poses[Math.floor(Math.random() * poses.length)];
    const base = [
      "photorealistic photograph of a real young woman,",
      age + " years old,",
      "named character identity lock,",
      appearance + ",",
      scenarioHint,
      pose + ",",
      "natural skin texture, realistic proportions, 95D generous bust as described, hourglass figure, porcelain fair skin, hazel-green eyes, long straight dark brown hair to lower back,",
      "shot on 85mm lens, soft daylight, high detail, 8k, no text, no watermark, no cartoon, no anime, no deformed hands",
    ].join(" ");
    if (extra) return (base + ", " + String(extra).slice(0, 200)).slice(0, 2048);
    return base.slice(0, 2048);
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
          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + cred.token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const text = await res.text();
          let data = {};
          try { data = JSON.parse(text); } catch (_) {}
          if (!res.ok) {
            lastErr = (data.errors && data.errors[0] && data.errors[0].message) ||
              (data.error) || ("HTTP " + res.status);
            // rotate on quota/auth
            if (res.status === 400 || res.status === 401 || res.status === 429 || res.status === 402) {
              try { localStorage.setItem("lea.cfKeyIndex", String((start + i + 1) % creds.length)); } catch (_) {}
            }
            continue;
          }
          // FLUX returns result.image base64
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
    let lastErr = "";
    for (const key of keys) {
      for (const model of ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"]) {
        try {
          const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent?key=" +
            encodeURIComponent(key);
          const contents = [];
          for (const m of messages) {
            if (m.role === "system") continue;
            contents.push({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            });
          }
          const body = {
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 800,
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          };
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            lastErr = (data.error && data.error.message) || res.status;
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
          lastErr = "réponse vide";
        } catch (e) {
          lastErr = String(e.message || e);
        }
      }
    }
    throw new Error(lastErr || "Gemini indisponible");
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
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: msgs,
            temperature: 0.9,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          lastErr = (data.error && data.error.message) || res.status;
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
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: msgs,
            temperature: 0.9,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          lastErr = (data.error && data.error.message) || res.status;
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
    throw new Error(errors.join(" · ") || "Aucune clé API configurée");
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
