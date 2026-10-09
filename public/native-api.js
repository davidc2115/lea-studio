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
    return String(raw || "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
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
      };
    }

    return { error: "not_found", path };
  };
})();
