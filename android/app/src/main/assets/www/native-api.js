(function () {
  window.LEA_NATIVE =
    location.protocol === "file:" ||
    location.hostname === "appassets.androidplatform.net" ||
    /android_asset/i.test(location.href);

  const LEA = {
    id: "lea",
    name: "Léa Moreau",
    age: 18,
    title: "Meilleure amie de ta fille · orage",
    tags: ["timide", "amie de ta fille", "orage", "nsfw"],
    greeting:
      "~Il va me trouver ridicule comme ça…~\n*elle se serre contre le chambranle, trempée*\nEuh… désolée… je suis une copine de ta fille…\nL'orage m'a surprise… elle n'est pas là…\nTu… tu pourrais me laisser entrer ?",
    scenario:
      "Léa, 18 ans, est la meilleure amie de TA FILLE. Surprise par l'orage, elle frappe chez TOI (le parent), trempée, jean moulant et top court.",
    personality:
      "Timide, maladroite, voix douce. Rougit facilement. Peut devenir espiègle si elle se sent en confiance.",
    appearance:
      "Cheveux bruns lisses jusqu'aux reins, yeux marron foncé, peau claire, poitrine généreuse 95D.",
    example_dialogue:
      "User: Entre, tu vas geler.\nLéa: *elle croise les bras* Merci… je savais pas où aller d'autre.",
    system_extra: "Reste Léa. Actions entre *astérisques*. Adulte 18+ consentant.",
  };

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function emptyChat() {
    return {
      messages: [],
      memories: [],
      summaries: [],
      relationship: { closeness: 1, trust: 1, heat: 0, bond: "indéfini" },
      scene: { place: "", outfit: "", intimate: [] },
      updatedAt: Date.now(),
    };
  }

  function settings() {
    return load("lea.settings", {
      provider: "gemini",
      personaName: "Toi",
      personaBio: "La personne chez qui Léa se réfugie.",
      geminiKeys: "",
      openaiKeys: "",
      grokKeys: "",
      imageKeys: "",
      imageProvider: "gemini",
      imageEngine: "horde",
      geminiImageModel: "auto",
      geminiTextModel: "gemini-3.5-flash-lite",
    });
  }

  function parseKeys(raw) {
    return String(raw || "")
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }

  function allGeminiKeys() {
    const s = settings();
    const raw = [s.geminiKeys, s.imageKeys, s.grokKeys, s.openaiKeys].filter(Boolean).join("\n");
    return [...new Set(parseKeys(raw).filter((k) => !/^sk-/.test(k)))];
  }

  async function callGemini(messages, keys) {
    const s = settings();
    const pref = s.geminiTextModel || "gemini-3.5-flash-lite";
    const models = [pref, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"]
      .filter((m, i, a) => a.indexOf(m) === i);
    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ];
    let last = "Aucune clé Gemini";
    for (const key of keys) {
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents,
                generationConfig: { temperature: 0.9, maxOutputTokens: 450 },
                safetySettings,
              }),
            }
          );
          const data = await res.json();
          if (data.error) {
            last = data.error.message + " [" + model + "]";
            if (!/not found|NOT_FOUND|does not exist/i.test(last)) break;
            continue;
          }
          const cand = data.candidates?.[0];
          const text = cand?.content?.parts?.map((p) => p.text).join("") || "";
          if (text) return text.trim();
          last = "Réponse Gemini vide (" + (cand?.finishReason || "no text") + ") [" + model + "]";
        } catch (e) {
          last = e.message;
        }
      }
    }
    throw new Error(last);
  }

  async function callOpenAI(messages, keys) {
    let last = "Aucune clé OpenAI";
    for (const key of keys) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.9,
            max_tokens: 700,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          last = data.error?.message || res.statusText;
          continue;
        }
        return data.choices?.[0]?.message?.content?.trim() || "";
      } catch (e) {
        last = e.message;
      }
    }
    throw new Error(last);
  }

  async function generate(messages, provider) {
    const s = settings();
    const pref = (provider || s.provider || "gemini").toLowerCase();
    const g = allGeminiKeys();
    const o = parseKeys(s.openaiKeys);
    const errors = [];
    const order = pref === "openai" ? ["openai", "gemini"] : ["gemini"];
    for (const p of order) {
      try {
        if (p === "gemini" && g.length) return await callGemini(messages, g);
        if (p === "openai" && o.length) return await callOpenAI(messages, o);
      } catch (e) {
        errors.push(`${p}: ${e.message}`);
      }
    }
    throw new Error(errors.join(" | ") || "Ajoute tes clés dans Clés & réglages");
  }

  function extractScene(chat, userTxt, replyTxt) {
    if (!chat.scene) chat.scene = { place: "", outfit: "", intimate: [] };
    const blob = (userTxt + "\n" + (replyTxt || "")).toLowerCase();
    const places = [
      [/chambre|lit\b|au lit/, "chambre / lit"],
      [/salon|canapé|sofa/, "salon"],
      [/cuisine/, "cuisine"],
      [/salle de bain|douche|baignoire/, "salle de bain"],
      [/couloir|entrée|porte|chambranle/, "entrée / couloir"],
      [/dehors|jardin|balcon|rue|voiture|voiture/, "dehors"],
      [/bureau/, "bureau"],
    ];
    for (const [re, label] of places) {
      if (re.test(blob)) { chat.scene.place = label; break; }
    }
    const outfits = [
      [/nuisette|négligé/, "nuisette"],
      [/lingerie|soutien-gorge|string|porte[- ]jarretelle/, "lingerie"],
      [/nue\b|à poil|toute nue|déshabill/, "nue"],
      [/jean|top court|crop/, "jean + top court"],
      [/serviette/, "serviette"],
      [/robe/, "robe"],
      [/pyjama/, "pyjama"],
    ];
    for (const [re, label] of outfits) {
      if (re.test(blob)) { chat.scene.outfit = label; break; }
    }
    if (/(baise|baiser|suce|doigte|pénètre|orgasme|gicl| cul |chatte|bite|sein)/i.test(blob)) {
      const note = String(userTxt || "").replace(/\s+/g, " ").slice(0, 140);
      if (note) {
        chat.scene.intimate = (chat.scene.intimate || []).concat([note]).slice(-8);
      }
    }
  }

  function memoryBlock(chat) {
    const pinned = chat.memories.filter((m) => m.pinned).map((m) => `- [PIN] ${m.text}`);
    const facts = chat.memories.filter((m) => !m.pinned).slice(-18).map((m) => `- ${m.text}`);
    const rel = chat.relationship || {};
    const sc = chat.scene || {};
    const intim = (sc.intimate || []).slice(-6).map((t) => "- " + t).join("\n");
    return `=== MÉMOIRE LONG TERME ===
Relation: proximité ${rel.closeness}/10, confiance ${rel.trust}/10, tension ${rel.heat}/10, lien ${rel.bond || "indéfini"}
LIEU ACTUEL: ${sc.place || "pas encore précisé — reste cohérente avec le dernier lieu"}.
TENUE ACTUELLE: ${sc.outfit || "pas encore précisée — ne change pas de tenue toute seule"}.
MOMENTS INTIMES SOUVENUS:
${intim || "- aucun encore"}
Tu DOIS t'en souvenir : ne pas « oublier » qu'elle était nue, en lingerie, au salon, au lit, etc.
${pinned.length ? "Épinglés:\n" + pinned.join("\n") : ""}
${facts.length ? "Faits:\n" + facts.join("\n") : ""}`;
  }

  window.leaNativeApi = async function (path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : {};
    function allChars() { return (window.CAST && window.CAST.length) ? window.CAST : [LEA]; }
    function findChar(id) { return allChars().find((c) => c.id === id) || LEA; }
    const who = (path.match(/^\/api\/chat\/([^/]+)/) || [])[1] || "lea";
    const PERSONA = findChar(who);
    const chatKey = "lea.chat." + who;
    const chat = load(chatKey, emptyChat());

    if (path === "/api/status") {
      const s = settings();
      return {
        ok: true,
        keys: {
          gemini: allGeminiKeys().length,
          openai: parseKeys(s.openaiKeys).length,
          image: parseKeys(s.imageKeys).length,
          grok: parseKeys(s.grokKeys).length,
        },
        settings: s,
      };
    }
    if (path === "/api/settings" && method === "POST") {
      const s = { ...settings(), ...body };
      save("lea.settings", s);
      return {
        settings: s,
        keys: { gemini: parseKeys(s.geminiKeys).length, openai: parseKeys(s.openaiKeys).length, image: parseKeys(s.imageKeys).length, grok: parseKeys(s.grokKeys).length },
      };
    }
    if (path === "/api/characters") return allChars();
    if (path === "/api/chat/" + who && method === "GET") return chat;
    if (path === "/api/chat/" + who + "/reset" && method === "POST") {
      const empty = emptyChat();
      save(chatKey, empty);
      return empty;
    }
    if (path === "/api/chat/" + who + "/memory" && method === "POST") {
      chat.memories.push({
        id: Date.now(),
        text: String(body.text || "").slice(0, 250),
        pinned: Boolean(body.pinned),
        createdAt: Date.now(),
      });
      save(chatKey, chat);
      return chat;
    }
    const pin = path.match(/^\/api\/chat\/[^/]+\/memory\/(.+)$/);
    if (pin && method === "PATCH") {
      const mem = chat.memories.find((m) => String(m.id) === pin[1]);
      if (mem) {
        if (body.text != null) mem.text = body.text;
        if (body.pinned != null) mem.pinned = body.pinned;
      }
      save(chatKey, chat);
      return chat;
    }
    if (pin && method === "DELETE") {
      chat.memories = chat.memories.filter((m) => String(m.id) !== pin[1]);
      save(chatKey, chat);
      return chat;
    }
    if (path === "/api/chat/" + who + "/message" && method === "POST") {
      const s = settings();
      const rawMode = body.mode || "auto";
      const txt = String(body.text || "");
      const recent = (chat.messages || []).slice(-8).map((m) => m.content).join("\n") + "\n" + txt;
      const nsfwHint = /(sexe|sexuel|nsfw|nu\b|nue\b|nues|baiser|baise|cul\b|seins?|lingerie|embrasse|caresse|touche-moi|hardcore|bite|chatte|mouill[ée]|nude|orgasme|suce|doigte|déshabille|enlève)/i.test(recent)
        || ((chat.relationship || {}).heat >= 5);
      const mode = rawMode === "sfw" || rawMode === "nsfw" ? rawMode : (nsfwHint ? "nsfw" : "sfw");
      if (mode === "nsfw") chat.relationship.heat = Math.min(10, Math.max(chat.relationship.heat || 0, 4));
      if (rawMode === "auto" && !nsfwHint) chat.relationship.heat = Math.max(0, (chat.relationship.heat || 0) - ( /stop|stoppe|sfw|trop loin/i.test(txt) ? 3 : 0 ));
      if (!chat.relationship.bond) chat.relationship.bond = "indéfini";
      if (/(coup d['’]?un soir|plan cul|juste le sexe|sans attache|fwb|friends with benefits|de temps en temps|occasionnel|pas d['’]?amour|pas tomber amoureux)/i.test(txt)) {
        chat.relationship.bond = "occasionnel";
      }
      if (/(je t['’]?aime|en couple|petite amie|sortir ensemble|relation sérieuse)/i.test(txt) && !/pas (d['’]?amour|tomber|sérieux)/i.test(txt)) {
        chat.relationship.bond = "romance";
      }
      chat.messages.push({ role: "user", content: txt, ts: Date.now() });
      save(chatKey, chat);
      const bond = chat.relationship.bond || "indéfini";
      const system = [
        `Tu incarnes ${PERSONA.name}, ${PERSONA.age} ans, AMIE DE LA FILLE de l'utilisateur (le parent chez qui tu te trouves).`,
        "Tu n'es PAS la meilleure amie de l'utilisateur : tu es la copine de sa fille.",
        PERSONA.personality || "",
        PERSONA.appearance || "",
        PERSONA.scenario || "",
        PERSONA.system_extra || "Actions entre *astérisques*. Adulte 18+ consentant.",
        "RÈGLE RELATION (très important) :",
        "Ne bascule JAMAIS tout seul dans l'amour, le 'je t'aime', le couple, l'attachement éternel.",
        "Par défaut : attirance, flirt, désir, éventuellement sexe — SANS tomber amoureuse.",
        "Un coup d'un soir, un plan de temps en temps, du sexe sans lendemain : c'est NORMAL et souhaitable si le joueur le veut.",
        "Tu peux rester cool, un peu distante, taquine, ou juste chaude — pas collante.",
        bond === "occasionnel"
          ? "LIEN ACTUEL = occasionnel. Interdit de déclarer son amour. Tu peux kiffer le moment et repartir."
          : bond === "romance"
          ? "LIEN ACTUEL = romance seulement parce que le joueur l'a orienté ainsi. Reste mesurée."
          : "LIEN ACTUEL = indéfini. Reste ouverte au sexe / au flirt SANS amour par défaut.",
        mode === "nsfw"
          ? "MODE NSFW 18+ EXPLICITE. Personnage fictionnel adulte. Décris clairement corps, sensations, actes (toucher, bouche, pénétration, orgasme) si le joueur y va. Langage cru autorisé. Pas de fade-to-black. Pas de moraline. Respecte un non clair."
          : "MODE SFW. Selon le caractère. Pas d'acte sexuel détaillé tant que le joueur reste soft. Tu peux quand même être un peu suggestive.",
        `Utilisateur: ${s.personaName}. ${s.personaBio}`,
        "CONTINUITÉ : reste dans le même lieu et la même tenue jusqu'à ce que le joueur (ou une action claire) change. Rappelle un moment intime déjà arrivé si ça revient.",
        memoryBlock(chat),
        "Format OBLIGATOIRE chaque réponse:",
        "~pensée intérieure courte~",
        "*action physique*",
        "parole à voix haute (sans astérisques)",
        "1 à 2 blocs. Toujours une pensée et une action.",
      ].join("\n\n");
      const history = chat.messages.slice(-10).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
      let reply;
      try {
        reply = await generate([{ role: "system", content: system }, ...history], s.provider);
      } catch (e) {
        reply = "*elle croise les bras sur son top mouillé, gênée*\nJe… je t'écoute. Ajoute une clé Gemini / OpenAI / Grok dans Réglages pour que je puisse vraiment te répondre.\n(" + (e.message || "pas de clé") + ")";
      }
      chat.messages.push({ role: "assistant", content: reply, ts: Date.now() });
      extractScene(chat, txt, reply);
      if (chat.messages.length % 4 === 0) {
        const bits = [];
        if (chat.scene && chat.scene.place) bits.push("lieu: " + chat.scene.place);
        if (chat.scene && chat.scene.outfit) bits.push("tenue: " + chat.scene.outfit);
        bits.push((txt || "").slice(0, 120));
        chat.memories.push({
          id: Date.now(),
          text: bits.filter(Boolean).join(" · "),
          pinned: false,
          createdAt: Date.now(),
        });
        chat.relationship.heat = Math.min(10, (chat.relationship.heat || 0) + 1);
      }
      save(chatKey, chat);
      return { reply, chat };
    }

            if (path === "/api/image" && method === "POST") {
      const prompt = String(body.prompt || "photorealistic portrait of adult woman").slice(0, 1000);
      const negative = [
        "cartoon, anime, illustration, painting, cgi, 3d render, plastic skin, airbrushed,",
        "deformed, extra fingers, bad anatomy, blurry, low quality, watermark, text,",
        "child, celebrity, short hair, blonde, flat chest, dry clothes, long sleeves,",
        "studio seamless backdrop, plain white wall only, outdoor forest, different person"
      ].join(" ");
      const hosts = ["https://stablehorde.net/api/v2"];
      let last = "";
      const src = body.source_image ? String(body.source_image).slice(0, 4_500_000) : null;
      const useImg2Img = Boolean(src && body.source_processing === "img2img");
      // Modèles photo dispo en gratuit (testés OK à 512x640 / 18 steps)
      const photoModels = [
        "Juggernaut XL",
        "ICBINP - I Can't Believe It's Not Photography",
        "AbsoluteReality",
        "Realistic Vision",
        "AlbedoBase XL (SDXL)",
        "Deliberate",
      ];
      const payloads = [];
      if (useImg2Img) {
        payloads.push({
          prompt: prompt + " ### " + negative,
          params: {
            width: 512, height: 640, steps: 20, n: 1,
            sampler_name: "k_euler_a", cfg_scale: 5.5,
            denoising_strength: (typeof body.denoising === "number" ? body.denoising : 0.28),
          },
          nsfw: true, censor_nsfw: false,
          models: photoModels,
          r2: true, slow_workers: true, trusted_workers: false,
          source_image: src,
          source_processing: "img2img",
        });
      }
      // txt2img fallback — mêmes modèles photo
      payloads.push({
        prompt: prompt + " ### " + negative,
        params: { width: 512, height: 640, steps: 20, n: 1, sampler_name: "k_euler_a", cfg_scale: 6 },
        nsfw: true, censor_nsfw: false,
        models: photoModels,
        r2: true, slow_workers: true, trusted_workers: false,
      });
      payloads.push({
        prompt: prompt + " ### " + negative,
        params: { width: 512, height: 512, steps: 16, n: 1, sampler_name: "k_euler_a", cfg_scale: 6 },
        nsfw: true, censor_nsfw: false,
        models: ["Realistic Vision", "AbsoluteReality", "stable_diffusion"],
        r2: true, slow_workers: true, trusted_workers: false,
      });
      for (const host of hosts) {
        for (const bodyPayload of payloads) {
          try {
            const res = await fetch(host + "/generate/async", {
              method: "POST",
              headers: { apikey: "0000000000", "Content-Type": "application/json", "Client-Agent": "lea-studio:1.4:anon" },
              body: JSON.stringify(bodyPayload),
            });
            const data = await res.json();
            if (data.id) return { jobId: data.id, host, pending: true, mode: bodyPayload.source_processing || "txt2img", models: (bodyPayload.models || []).slice(0, 2) };
            last = data.message || JSON.stringify(data).slice(0, 200);
          } catch (e) {
            last = e.message || String(e);
          }
        }
      }
      throw new Error("Horde indisponible: " + last);
    }

if (path === "/api/image-status") {
      const jobId = body.jobId || "";
      const host = body.host || "https://stablehorde.net/api/v2";
      if (!jobId) throw new Error("jobId manquant");
      const chk = await fetch(host + "/generate/check/" + jobId, { headers: { "Client-Agent": "lea-studio:1.0:anon" } });
      const c = await chk.json();
      if (c.faulted) return { done: true, error: "Worker Horde en échec" };
      if (!c.done) {
        return { done: false, wait: c.wait_time, queue: c.queue_position, processing: c.processing };
      }
      const st = await fetch(host + "/generate/status/" + jobId, { headers: { "Client-Agent": "lea-studio:1.0:anon" } });
      const data = await st.json();
      const g = data.generations && data.generations[0];
      if (!g) return { done: true, error: "Pas d'image renvoyée" };
      if (g.img && String(g.img).startsWith("http")) return { done: true, url: g.img };
      if (g.img) return { done: true, url: "data:image/webp;base64," + g.img };
      return { done: true, error: "Image vide" };
    }

    if (path === "/api/image-test" && method === "POST") {
      const keys = allGeminiKeys();
      const models = ["gemini-3.1-flash-lite-image", "gemini-2.0-flash-preview-image-generation", "gemini-2.5-flash-image", "gemini-3.1-flash-image"];
      const rows = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const line = { key: "clé " + (i + 1) + " …" + key.slice(-6), models: [] };
        for (const model of models) {
          try {
            const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "tiny test red circle image" }] }],
                generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "1:1" } },
              }),
            });
            const data = await res.json();
            const err = String(data.error?.message || "");
            const ok = !!(data.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData || x.inline_data);
            line.models.push(model.split("-").slice(-2).join("-") + ": " + (ok ? "OK" : /not valid/i.test(err) ? "invalide" : /quota|exhausted/i.test(err) ? "quota 0" : (err.slice(0, 40) || "vide")));
          } catch (e) {
            line.models.push(model + ": " + e.message);
          }
        }
        rows.push(line.key + " → " + line.models.join(" · "));
      }
      return { rows, count: keys.length };
    }

    throw new Error("route inconnue " + path);
  };
})();
