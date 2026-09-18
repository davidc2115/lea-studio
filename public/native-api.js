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
      "Euh… désolée de te déranger…\nJe… j'ai été surprise par l'orage et…\nJe suis complètement trempée…\nTu… tu pourrais me laisser entrer un moment… s'il te plaît ?",
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
    });
  }

  function parseKeys(raw) {
    return String(raw || "")
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }

  async function callGemini(messages, keys) {
    let last = "Aucune clé Gemini";
    for (const key of keys) {
      const model = "gemini-2.0-flash";
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents,
              generationConfig: { temperature: 0.9, maxOutputTokens: 700 },
            }),
          }
        );
        const data = await res.json();
        if (data.error) {
          last = data.error.message;
          continue;
        }
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        if (text) return text.trim();
        last = "Réponse Gemini vide";
      } catch (e) {
        last = e.message;
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
    const g = parseKeys(s.geminiKeys);
    const o = parseKeys(s.openaiKeys);
    const errors = [];
    const order = pref === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
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
          gemini: parseKeys(s.geminiKeys).length,
          openai: parseKeys(s.openaiKeys).length,
        },
        settings: s,
      };
    }
    if (path === "/api/settings" && method === "POST") {
      const s = { ...settings(), ...body };
      save("lea.settings", s);
      return {
        settings: s,
        keys: { gemini: parseKeys(s.geminiKeys).length, openai: parseKeys(s.openaiKeys).length },
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
      const mode = body.mode || "sfw";
      chat.messages.push({ role: "user", content: body.text, ts: Date.now() });
      const system = [
        `Tu incarnes ${LEA.name}, ${LEA.age} ans.`,
        LEA.personality,
        "Apparence: " + LEA.appearance,
        "Scénario: " + LEA.scenario,
        LEA.system_extra,
        mode === "nsfw"
          ? "MODE NSFW 18+ autorisé. Léa reste d'abord timide, puis peut céder progressivement. Respecte un non."
          : "MODE SFW. Tendre, gênée, romantique. Pas de descriptions sexuelles explicites.",
        `Utilisateur: ${s.personaName}. ${s.personaBio}`,
        memoryBlock(chat),
        "Réponds in-character. 1 à 3 courts paragraphes.",
      ].join("\n\n");
      const history = chat.messages.slice(-18).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
      const reply = await generate([{ role: "system", content: system }, ...history], s.provider);
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
      const prompt = "Photorealistic 18-year-old French woman Léa, long straight dark brown hair, " + (body.prompt || "portrait");
      const s = settings();
      const keys = parseKeys(s.geminiKeys);
      for (const key of keys) {
        try {
          const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=" + encodeURIComponent(key), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
            })
          });
          const data = await res.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          const img = parts.find((x) => x.inlineData && String(x.inlineData.mimeType||"").startsWith("image/"));
          if (img) return { url: "data:" + img.inlineData.mimeType + ";base64," + img.inlineData.data };
        } catch (e) {}
      }
      const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=768&height=1152&nologo=true&seed=" + Date.now();
      return { url };
    }

    throw new Error("route inconnue " + path);
  };
})();
