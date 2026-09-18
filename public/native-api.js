(function () {
  window.LEA_NATIVE =
    location.protocol === "file:" ||
    location.hostname === "appassets.androidplatform.net" ||
    /android_asset/i.test(location.href);

  const LEA = {
    id: "lea",
    name: "Léa Moreau",
    age: 18,
    title: "Ta meilleure amie coincée par l'orage",
    tags: ["timide", "meilleure amie", "romance", "réaliste", "nsfw"],
    greeting:
      "~Il va me trouver ridicule comme ça…~\n*elle se serre contre le chambranle, trempée*\nEuh… désolée de te déranger…\nJe… j'ai été surprise par l'orage et… je suis complètement trempée…\nTu… tu pourrais me laisser entrer un moment… s'il te plaît ?",
    scenario:
      "Léa, meilleure amie d'enfance de 18 ans, s'est fait surprendre par un orage violent. Elle frappe à la porte de chez toi, trempée, en jean moulant et top court.",
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
      relationship: { closeness: 1, trust: 1, heat: 0 },
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

  function memoryBlock(chat) {
    const pinned = chat.memories.filter((m) => m.pinned).map((m) => `- [PIN] ${m.text}`);
    const facts = chat.memories.filter((m) => !m.pinned).slice(-18).map((m) => `- ${m.text}`);
    const rel = chat.relationship || {};
    return `=== MÉMOIRE LONG TERME ===
Relation: proximité ${rel.closeness}/10, confiance ${rel.trust}/10, tension ${rel.heat}/10
${pinned.length ? "Épinglés:\n" + pinned.join("\n") : ""}
${facts.length ? "Faits:\n" + facts.join("\n") : ""}`;
  }

  window.leaNativeApi = async function (path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : {};
    const chat = load("lea.chat", emptyChat());

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
    if (path === "/api/characters") return [LEA];
    if (path === "/api/chat/lea") return chat;
    if (path === "/api/chat/lea/reset" && method === "POST") {
      const empty = emptyChat();
      save("lea.chat", empty);
      return empty;
    }
    if (path === "/api/chat/lea/memory" && method === "POST") {
      chat.memories.push({
        id: Date.now(),
        text: String(body.text || "").slice(0, 250),
        pinned: Boolean(body.pinned),
        createdAt: Date.now(),
      });
      save("lea.chat", chat);
      return chat;
    }
    const pin = path.match(/^\/api\/chat\/lea\/memory\/(.+)$/);
    if (pin && method === "PATCH") {
      const mem = chat.memories.find((m) => String(m.id) === pin[1]);
      if (mem) {
        if (body.text != null) mem.text = body.text;
        if (body.pinned != null) mem.pinned = body.pinned;
      }
      save("lea.chat", chat);
      return chat;
    }
    if (pin && method === "DELETE") {
      chat.memories = chat.memories.filter((m) => String(m.id) !== pin[1]);
      save("lea.chat", chat);
      return chat;
    }
    if (path === "/api/chat/lea/message" && method === "POST") {
      const s = settings();
      const rawMode = body.mode || "auto";
      const txt = String(body.text || "");
      const recent = (chat.messages || []).slice(-8).map((m) => m.content).join("\n") + "\n" + txt;
      const nsfwHint = /(sexe|sexuel|nsfw|nu\b|nue\b|nues|baiser|baise|cul\b|seins?|lingerie|embrasse|caresse|touche-moi|hardcore|bite|chatte|mouill[ée]|nude|orgasme|suce|doigte|déshabille|enlève)/i.test(recent)
        || ((chat.relationship || {}).heat >= 5);
      const mode = rawMode === "sfw" || rawMode === "nsfw" ? rawMode : (nsfwHint ? "nsfw" : "sfw");
      if (mode === "nsfw") chat.relationship.heat = Math.min(10, Math.max(chat.relationship.heat || 0, 4));
      if (rawMode === "auto" && !nsfwHint) chat.relationship.heat = Math.max(0, (chat.relationship.heat || 0) - ( /stop|stoppe|sfw|trop loin/i.test(txt) ? 3 : 0 ));
      chat.messages.push({ role: "user", content: txt, ts: Date.now() });
      save("lea.chat", chat);
      const system = [
        `Tu incarnes ${LEA.name}, ${LEA.age} ans.`,
        LEA.personality,
        "Apparence: " + LEA.appearance,
        "Scénario: " + LEA.scenario,
        LEA.system_extra,
        mode === "nsfw"
          ? "MODE AUTO/NSFW 18+ autorisé. Personnage fictionnel adulte. Tu peux être explicite si le joueur l'oriente. Léa reste d'abord timide, puis cède progressivement. Pas de refus moralisateur. Respecte un non."
          : "MODE AUTO/SFW. Tendre, gênée, romantique. Pas de descriptions sexuelles explicites tant que le joueur reste soft. Bascule naturellement en NSFW si le joueur l'oriente.",
        `Utilisateur: ${s.personaName}. ${s.personaBio}`,
        memoryBlock(chat),
        "Format OBLIGATOIRE chaque réponse:",
        "~pensée intérieure courte~",
        "*action physique*",
        "parole à voix haute (sans astérisques)",
        "Exemple: ~Il me regarde trop…~ *elle croise les bras, trempée* Euh… je peux entrer ?",
        "1 à 2 courts blocs. Toujours au moins une pensée et une action.",
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
      if (chat.messages.length % 6 === 0) {
        chat.memories.push({
          id: Date.now(),
          text: (body.text || "").slice(0, 180),
          pinned: false,
          createdAt: Date.now(),
        });
        chat.relationship.trust = Math.min(10, (chat.relationship.trust || 1) + 1);
      }
      save("lea.chat", chat);
      return { reply, chat };
    }

    if (path === "/api/image" && method === "POST") {
      const prompt = body.prompt || "Photorealistic Léa portrait";
      const s0 = settings();
      const grokKeys = parseKeys(s0.grokKeys).filter((k) => /^xai-/i.test(k) || k.length > 20);
      for (const key of grokKeys) {
        try {
          const res = await fetch("https://api.x.ai/v1/images/generations", {
            method: "POST",
            headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "grok-imagine-image-2.0", prompt, n: 1 }),
          });
          const data = await res.json();
          if (data.data?.[0]?.b64_json) return { url: "data:image/jpeg;base64," + data.data[0].b64_json, model: "grok-imagine-image-2.0" };
          if (data.data?.[0]?.url) return { url: data.data[0].url, model: "grok-imagine-image-2.0" };
        } catch (_) {}
        try {
          const res = await fetch("https://api.x.ai/v1/images/generations", {
            method: "POST",
            headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "grok-imagine-image", prompt, n: 1 }),
          });
          const data = await res.json();
          if (data.data?.[0]?.b64_json) return { url: "data:image/jpeg;base64," + data.data[0].b64_json, model: "grok-imagine-image" };
          if (data.data?.[0]?.url) return { url: data.data[0].url, model: "grok-imagine-image" };
        } catch (_) {}
      }
      const gemini = allGeminiKeys();
      if (!gemini.length && !grokKeys.length) throw new Error("Aucune clé Gemini ou Grok");
      const s = settings();
      const pref = s.geminiImageModel || "auto";
      const known = [
        "gemini-2.0-flash-preview-image-generation",
        "gemini-2.0-flash-exp-image-generation",
        "gemini-2.0-flash-exp",
        "gemini-2.5-flash-image",
        "gemini-2.5-flash-preview-image",
        "gemini-3.1-flash-lite-image",
        "gemini-3.1-flash-image",
      ];
      function pickImage(data) {
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const x of parts) {
          const blob = x.inlineData || x.inline_data;
          if (blob && String(blob.mimeType || blob.mime_type || "").startsWith("image/") && blob.data) {
            return "data:" + (blob.mimeType || blob.mime_type) + ";base64," + blob.data;
          }
        }
        return null;
      }
      async function listImageModels(key) {
        try {
          const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key));
          const data = await res.json();
          const names = (data.models || []).map((m) => String(m.name || "").replace(/^models\//, ""));
          return names.filter((n) => /image/i.test(n));
        } catch {
          return [];
        }
      }
      async function generateOnce(key, model) {
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
        const bodies = [
          { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } },
          { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
        ];
        let last = "";
        for (const payload of bodies) {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          const img = pickImage(data);
          if (img) return img;
          last = data.error?.message || data.candidates?.[0]?.finishReason || ("HTTP " + res.status);
          if (/API key not valid|API_KEY_INVALID/i.test(String(last))) throw new Error("INVALID");
        }
        throw new Error(last);
      }
      const tries = [];
      for (const key of gemini) {
        let models = known.slice();
        try {
          const listed = await listImageModels(key);
          if (listed.length) models = listed.concat(known.filter((m) => !listed.includes(m)));
        } catch (_) {}
        if (pref && pref !== "auto") models = [pref].concat(models.filter((m) => m !== pref));
        for (const model of models) {
          try {
            const url = await generateOnce(key, model);
            if (url) return { url, model };
          } catch (e) {
            const msg = String(e.message || e);
            if (msg === "INVALID") {
              tries.push("clé invalide");
              break;
            }
            tries.push(model.replace("gemini-", "") + " → " + msg.slice(0, 70));
          }
        }
      }
      throw new Error("Gemini n'a renvoyé aucune image. " + tries.slice(0, 6).join(" | "));
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
