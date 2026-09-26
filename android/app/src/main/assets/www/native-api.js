(function () {
  window.LEA_NATIVE =
    location.protocol === "file:" ||
    location.hostname === "appassets.androidplatform.net" ||
    /android_asset/i.test(location.href);

  const LEA = {
    id: "lea",
    name: "Léa Moreau",
    age: 21,
    title: "Meilleure amie de ta fille · orage",
    tags: ["timide", "amie de ta fille", "orage", "nsfw"],
    greeting:
      "~Il va me trouver ridicule comme ça…~\n*elle se serre contre le chambranle, trempée*\nEuh… désolée… je suis une copine de ta fille…\nL'orage m'a surprise… elle n'est pas là…\nTu… tu pourrais me laisser entrer ?",
    scenario:
      "Léa, 21 ans, est la meilleure amie de TA FILLE. Surprise par l'orage, elle frappe chez TOI (le parent), trempée, jean moulant et top court.",
    personality:
      "Timide, maladroite, voix douce. Rougit facilement. Peut devenir espiègle si elle se sent en confiance.",
    appearance:
      "Cheveux bruns lisses jusqu'aux reins, yeux marron foncé, peau claire, poitrine généreuse 95D.",
    example_dialogue:
      "User: Entre, tu vas geler.\nLéa: *elle croise les bras* Merci… je savais pas où aller d'autre.",
    system_extra: "Reste Léa. Réponds en français. Actions entre *astérisques*. Adulte 18+ consentant.",
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
      scene: {
        place: "",
        place_detail: "",
        outfit: "",
        body: "",
        clothing: [],
        pose: "",
        activity: "",
        mood: "",
        time: "",
        people: [],
        intimate: [],
        log: [],
      },
      // Mémoire vectorielle légère (tags + vecteurs locaux + horodatage)
      vault: {
        entries: [], // {id, tag, text, ts, date, hour, vec}
      },
      updatedAt: Date.now(),
    };
  }

  /** Tokenisation simple FR/EN pour similarité cosinus (offline, téléphone). */
  function tokenizeMem(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }
  function textToVec(s) {
    const toks = tokenizeMem(s);
    const v = Object.create(null);
    for (const w of toks) v[w] = (v[w] || 0) + 1;
    return v;
  }
  function cosineSim(a, b) {
    if (!a || !b) return 0;
    let dot = 0, na = 0, nb = 0;
    for (const k in a) {
      na += a[k] * a[k];
      if (b[k]) dot += a[k] * b[k];
    }
    for (const k in b) nb += b[k] * b[k];
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
  function ensureVault(chat) {
    if (!chat.vault || !Array.isArray(chat.vault.entries)) chat.vault = { entries: [] };
    if (!chat.scene) chat.scene = emptyChat().scene;
    if (!Array.isArray(chat.memories)) chat.memories = [];
  }
  function pushVault(chat, tag, text, pin) {
    ensureVault(chat);
    const tx = String(text || "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!tx) return;
    const now = Date.now();
    const d = new Date(now);
    // anti-doublon très récent même tag
    const last = chat.vault.entries.filter((e) => e.tag === tag).slice(-2);
    if (last.some((e) => e.text === tx)) return;
    const entry = {
      id: now + Math.floor(Math.random() * 999),
      tag: tag, // tenue | lieu | pose | intime | corps | dialogue | fait | humeur
      text: tx,
      pinned: !!pin,
      ts: now,
      date: d.toISOString().slice(0, 10),
      hour: d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"),
      vec: textToVec(tag + " " + tx),
    };
    chat.vault.entries.push(entry);
    // miroir dans memories pour UI existante
    chat.memories.push({
      id: entry.id,
      category: tag,
      text: tx,
      pinned: !!pin,
      createdAt: now,
      date: entry.date,
      hour: entry.hour,
    });
    // limite ~800 entrées vault (quasi illimité usage normal)
    if (chat.vault.entries.length > 800) {
      const pinned = chat.vault.entries.filter((e) => e.pinned);
      const rest = chat.vault.entries.filter((e) => !e.pinned).slice(-4800);
      chat.vault.entries = pinned.concat(rest).slice(-5000);
    }
    if (chat.memories.length > 800) {
      const pinned = chat.memories.filter((m) => m.pinned);
      const rest = chat.memories.filter((m) => !m.pinned).slice(-4800);
      chat.memories = pinned.concat(rest).slice(-5000);
    }
  }
  /** Recherche vectorielle locale par tag optionnel + requête + récence. */
  function searchVault(chat, query, tag, limit) {
    ensureVault(chat);
    const qv = textToVec(query || "");
    const lim = limit || 12;
    const now = Date.now();
    let list = chat.vault.entries;
    if (tag) list = list.filter((e) => e.tag === tag);
    const scored = list.map((e) => {
      const sim = cosineSim(qv, e.vec || textToVec(e.text));
      const ageH = (now - (e.ts || 0)) / 3600000;
      const recency = ageH < 1 ? 0.35 : ageH < 6 ? 0.2 : ageH < 24 ? 0.1 : 0;
      const pin = e.pinned ? 0.25 : 0;
      return { e, score: sim + recency + pin };
    });
    scored.sort((a, b) => b.score - a.score || (b.e.ts - a.e.ts));
    return scored.slice(0, lim).map((x) => x.e);
  }
  function lastByTag(chat, tag) {
    ensureVault(chat);
    const list = chat.vault.entries.filter((e) => e.tag === tag);
    return list.length ? list[list.length - 1] : null;
  }
  function currentStateBlock(chat) {
    ensureVault(chat);
    const sc = chat.scene || {};
    const L = (tag) => {
      const e = lastByTag(chat, tag);
      return e ? e.text + " (" + e.date + " " + e.hour + ")" : (sc[tag === "tenue" ? "outfit" : tag === "lieu" ? "place" : tag] || "inconnu");
    };
    return [
      "=== ÉTAT ACTUEL (source de vérité — ne contredis pas) ===",
      "DERNIÈRE TENUE / CORPS: " + (sc.body || "") + " | " + (sc.outfit || "") + " | vault: " + L("tenue"),
      sc.clothes ? ("PIÈCES: haut=" + sc.clothes.top + " bas=" + sc.clothes.bottom + " soutien=" + sc.clothes.bra + " culotte=" + sc.clothes.panties) : "",
      "DERNIER LIEU: " + (sc.place || "") + " | vault: " + L("lieu"),
      "DERNIÈRE POSE/POSITION: " + (sc.pose || sc.activity || "") + " | vault: " + L("pose"),
      "DERNIÈRE ACTIVITÉ: " + (sc.activity || ""),
      "HUMEUR: " + (sc.mood || ""),
      "DERNIER MOMENT INTIME: " + L("intime"),
    ].join("\n");
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
    // Uniquement les clés Gemini (pas OpenAI sk-…, pas Grok)
    const raw = String(s.geminiKeys || "");
    return [...new Set(parseKeys(raw).filter((k) => {
      if (!k || k.length < 10) return false;
      if (/^sk-/.test(k)) return false; // OpenAI
      if (/^xai-/.test(k)) return false; // Grok
      return true;
    }))];
  }

  /** Rotation round-robin : démarre à la clé suivante à chaque appel */
  let _geminiKeyCursor = 0;
  function rotatedGeminiKeys() {
    const keys = allGeminiKeys();
    if (keys.length <= 1) return keys;
    const start = _geminiKeyCursor % keys.length;
    _geminiKeyCursor = (start + 1) % keys.length;
    return keys.slice(start).concat(keys.slice(0, start));
  }

  let _openaiKeyCursor = 0;
  function rotatedOpenAIKeys() {
    const keys = parseKeys(settings().openaiKeys);
    if (keys.length <= 1) return keys;
    const start = _openaiKeyCursor % keys.length;
    _openaiKeyCursor = (start + 1) % keys.length;
    return keys.slice(start).concat(keys.slice(0, start));
  }

  async function callGemini(messages, keys) {
    const s = settings();
    let pref = s.geminiTextModel || "gemini-3.5-flash-lite";
    // Modèles retirés pour nouveaux comptes → remap
    const deprecatedMap = {
      "gemini-2.5-flash": "gemini-3.8-flash",
      "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
      "gemini-2.0-flash-lite": "gemini-2.0-flash",
      "gemini-1.5-flash": "gemini-3.5-flash-lite",
      "gemini-1.5-pro": "gemini-3.8-flash",
    };
    if (deprecatedMap[pref]) pref = deprecatedMap[pref];
    const models = [
      pref,
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-2.0-flash",
    ]
      .filter((m, idx, a) => a.indexOf(m) === idx)
      .slice(0, 5);
    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ];
    const keyList = (keys && keys.length) ? keys : rotatedGeminiKeys();
    let last = "Aucune clé Gemini — ajoute des clés dans Clés (une par ligne)";
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const nonSys = messages.filter((m) => m.role !== "system");
    let contents = nonSys.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 1500) }],
    }));
    // Gemini 3.x : INTERDIT de terminer contents par role "model" (HTTP 400)
    if (!contents.length) {
      contents.push({ role: "user", parts: [{ text: "(continue)" }] });
    } else if (contents[contents.length - 1].role === "model") {
      contents.push({ role: "user", parts: [{ text: "Continue naturellement en restant dans le personnage." }] });
    }
    // Fusionner les rôles user/user ou model/model consécutifs (API strict)
    const merged = [];
    for (const c of contents) {
      if (merged.length && merged[merged.length - 1].role === c.role) {
        merged[merged.length - 1].parts[0].text += "\n" + c.parts[0].text;
      } else {
        merged.push({ role: c.role, parts: [{ text: c.parts[0].text }] });
      }
    }
    contents = merged;
    if (contents[0] && contents[0].role === "model") {
      contents.unshift({ role: "user", parts: [{ text: "(début)" }] });
    }

    function fetchTimeout(url, opts, ms) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
    }

    async function tryOnce(key, model) {
      const is3x = /^gemini-3/.test(model);
      const genConfig = {
        temperature: 0.8,
        topP: 0.92,
        maxOutputTokens: 900,
      };
      // 3.x : thinking_level minimal (thinkingBudget seul peut échouer)
      if (is3x) {
        genConfig.thinkingConfig = { thinkingBudget: 0, thinkingLevel: "minimal" };
      } else if (/2\.5/.test(model)) {
        genConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const payload = {
        systemInstruction: { parts: [{ text: system.slice(0, 12000) }] },
        contents,
        generationConfig: genConfig,
        safetySettings,
      };
      const res = await fetchTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        28000
      );
      const data = await res.json().catch(() => ({}));
      return { data, genConfig, is3x };
    }

    for (const model of models) {
      for (let ki = 0; ki < keyList.length; ki++) {
        const key = keyList[ki];
        const keyHint = "clé " + (ki + 1) + "/" + keyList.length + " …" + String(key).slice(-4);
        try {
          let { data, is3x } = await tryOnce(key, model);
          // Si thinkingConfig rejeté → réessayer sans
          if (data.error && /thinking|Unknown name|Invalid JSON|InvalidArgument|thinkingLevel|thinkingBudget/i.test(data.error.message || "")) {
            try {
              const payload2 = {
                systemInstruction: { parts: [{ text: system.slice(0, 12000) }] },
                contents,
                generationConfig: { temperature: 0.8, topP: 0.92, maxOutputTokens: 900 },
                safetySettings,
              };
              const res2 = await fetchTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload2),
                },
                28000
              );
              data = await res2.json().catch(() => ({}));
            } catch (_) {}
          }
          if (data.error) {
            const msg = data.error.message || "erreur";
            last = msg + " [" + model + " · " + keyHint + "]";
            if (/quota|rate|RESOURCE_EXHAUSTED|429|exhausted|limit/i.test(msg)) {
              console.warn("[lea] quota", last);
              continue;
            }
            if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid.*key|403/i.test(msg)) {
              console.warn("[lea] bad key", last);
              continue;
            }
            if (/not found|NOT_FOUND|does not exist|is not supported|no longer available|update your code/i.test(msg)) {
              console.warn("[lea] model skip", last);
              break; // modèle suivant
            }
            // role model ending / contents invalid → déjà corrigé côté payload
            if (/must alternate|last.*model|INVALID_ARGUMENT/i.test(msg)) {
              console.warn("[lea] contents", last);
              continue;
            }
            continue;
          }
          const cand = data.candidates?.[0];
          let text = "";
          if (cand?.content?.parts) {
            text = cand.content.parts
              .map((p) => p.text || "")
              .filter(Boolean)
              .join("");
          }
          const finish = cand?.finishReason || "";
          if (!text.trim()) {
            last = "Réponse vide (" + (finish || data.promptFeedback?.blockReason || "no text") + ") [" + model + " · " + keyHint + "]";
            continue;
          }
          if (finish === "MAX_TOKENS" && !/[.!?…*)]$/.test(text.trim())) {
            text = text.trim() + "…";
          }
          console.log("[lea] Gemini OK", model, keyHint, finish);
          return text.trim();
        } catch (e) {
          last = (e.name === "AbortError" ? "timeout 28s" : (e.message || "réseau")) + " [" + model + " · " + keyHint + "]";
          continue;
        }
      }
    }
    throw new Error(last || "Toutes les clés Gemini ont échoué");
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
            max_tokens: 560,
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
    const g = rotatedGeminiKeys();
    const o = rotatedOpenAIKeys();
    const q = rotatedGroqKeys();
    const errors = [];
    // Rotation : provider préféré d'abord, puis les autres avec clés
    let order;
    if (pref === "groq") order = ["groq", "gemini", "openai"];
    else if (pref === "openai") order = ["openai", "gemini", "groq"];
    else order = ["gemini", "groq", "openai"];
    for (const p of order) {
      try {
        if (p === "gemini" && g.length) return await callGemini(messages, g);
        if (p === "groq" && q.length) return await callGroq(messages, q);
        if (p === "openai" && o.length) return await callOpenAI(messages, o);
      } catch (e) {
        errors.push(p + ": " + (e.message || e));
      }
    }
    throw new Error(errors.join(" | ") || "Ajoute tes clés Gemini (plusieurs = rotation auto) dans Clés");
  }

  /** Retire les fuites de prompt système / meta hors personnage. */
  function sanitizeReply(text) {
    let t = String(text || "");
    // Normalise labels anglais du modèle
    t = t.replace(/\(\s*thought\s*\)\s*/gi, "");
    t = t.replace(/\(\s*pens[ée]e\s*\)\s*/gi, "");
    t = t.replace(/(^|\n)\s*Action\s*:\s*/gi, "$1*");
    t = t.replace(/(^|\n)\s*Thought\s*:\s*/gi, "$1(");
    t = t.replace(/(^|\n)\s*Speech\s*:\s*/gi, "$1");
    t = t.replace(/(^|\n)\s*Pens[ée]e\s*:\s*/gi, "$1(");
    // Fuites méta / prompt système (anglais ou technique)
    const leakLine = /^(thought|action|speech|format|avoid|interdit|r[eè]gle|mode\s+nsfw|mode\s+sfw|apparence fixe|morphologie|system|prompt|hourglass|95d|identity|client-agent|style de r[eé]ponse|ne jamais|responds? only|you are)/i;
    const leakFrag = [
      /thought\s*,\s*action\s*,\s*speech[^\n]*/gi,
      /1\s*[-–]?\s*2\s*paragraphs?[^\n]*/gi,
      /avoid\s+clich[eé]\s+phrases?[^\n]*/gi,
      /\(\s*"prou[^\n]*/gi,
      /prouve-le-moi[^\n]*/gi,
      /APPARENCE FIXE[^\n]*/gi,
      /TEMP[EÉ]RAMENT[^\n]*/gi,
      /Format OBLIGATOIRE[^\n]*/gi,
      /STYLE DE R[EÉ]PONSE[^\n]*/gi,
      /SAME face[^\n]*/gi,
      /\b\d{2}D\b[^\n]{0,40}hourglass[^\n]*/gi,
      /hourglass[^\n]{0,60}(brown eyes|fair skin)[^\n]*/gi,
      /,\s*hourglass,\s*long brown hair[^\n]*/gi,
      /D,\s*hourglass[^\n]*/gi,
      /long brown hair,\s*brown eyes,\s*fair skin\)?\.?/gi,
      /looks exactly \d+ years? old[^\n]*/gi,
      /NOT nude[^\n]*/gi,
      /OUTFIT REQUIRED[^\n]*/gi,
      /DYNAMIC SCENE PHOTO[^\n]*/gi,
      /Client-Agent[^\n]*/gi,
      /INTERDIT[^\n]{0,80}/gi,
      /R[EÈ]GLE RELATION[^\n]*/gi,
      /SC[EÈ]NE FIXE[^\n]*/gi,
      /CONTINUIT[EÉ] (LIEU|TENUE)[^\n]*/gi,
      /MODE (NSFW|SFW)[^\n]*/gi,
      /\bun\s+\d{2}D\b[^\n]{0,50}/gi,
    ];
    // Coupe début si instructions EN / format
    if (/^\s*(thought|action|speech|format|avoid clich|1\s*[-–]?\s*2\s*para)/i.test(t)) {
      const cut = t.search(/\n\s*[~*«"A-Za-zÀ-ÿ]/);
      if (cut > 15) t = t.slice(cut);
      else t = t.replace(/^[^~*\n]{10,200}/, "");
    }
    const lines = t.split("\n");
    const kept = [];
    for (const line of lines) {
      const s = line.trim();
      if (!s) { kept.push(line); continue; }
      if (leakLine.test(s)) continue;
      if (/^[A-Z][A-Z\s]{6,}:/.test(s) && /FIXE|OBLIGATOIRE|INTERDIT|MODE|R[EÈ]GLE|STYLE|TEMP/.test(s)) continue;
      // fiche technique morphologie collée
      if (/\bhourglass\b/i.test(s) && /\b(brown eyes|fair skin|95D|brown hair)\b/i.test(s)) continue;
      if (/^\(?\s*D,\s*hourglass/i.test(s)) continue;
      if (/avoid clich/i.test(s) || /thought,\s*action/i.test(s)) continue;
      if (/paragraphs?\)\.?/i.test(s) && s.length < 80) continue;
      // ligne quasi vide après purge
      if (/^[\s*~.·,;:\-–"'»«)]+$/.test(s)) continue;
      kept.push(line);
    }
    t = kept.join("\n");
    for (const re of leakFrag) t = t.replace(re, "");
    t = t.replace(/\n{3,}/g, "\n\n").replace(/^\s*[).,;:\-–*]+\s*/gm, "").trim();
    // ——— Normalise format actions / pensées / paroles ———
    // Ligne se terminant par * sans * ouvrant → action
    t = t.replace(/(^|\n)([^\n*][^\n]{8,}?)\*(\s*)(?=\n|$)/g, function(full, a, mid, sp) {
      if (mid.indexOf("*") >= 0) return full;
      return a + "*" + mid.trim() + "*" + sp;
    });
    // * ouvrant non fermé sur la ligne
    t = t.replace(/(^|\n)\*([^*\n]{6,}?)(?=\n|$)/g, function(full, a, mid) {
      if (/\*$/.test(mid)) return full;
      return a + "*" + mid.trim() + "*";
    });
    // Narration 1re personne hors * → entourer *
    t = t.split("\n").map(function(line) {
      const s = line.trim();
      if (!s) return line;
      if (/^\*/.test(s) || /^\(/.test(s)) return line;
      if (/^(Je |J'|Elle )[a-zàâäéèêëïîôùûüç].{20,}/i.test(s)
          && !/[?？]/.test(s)
          && !/^(Je sais|Je pense|Je crois|Je t'|Je vous)/i.test(s)
          && s.indexOf("*") < 0) {
        return "*" + s.replace(/^\*|\*$/g, "") + "*";
      }
      return line;
    }).join("\n");
    if (t.length < 12) {
      t = "(…)\n*elle hésite un instant, mal à l'aise*\nPardon… je reprends.";
    }
    return t;
  }

  /** Historique sans fuites méta (évite que le modèle imite d'anciennes erreurs). */
  function cleanHistory(messages) {
    return (messages || []).slice(-16).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.role === "assistant" ? sanitizeReply(m.content || "") : String(m.content || "").slice(0, 2000),
    })).filter((m) => m.content && m.content.length > 1);
  }

  function extractScene(chat, userTxt, replyTxt) {
    ensureVault(chat);
    const blob = (String(userTxt || "") + "\n" + String(replyTxt || "")).toLowerCase();
    const sc = chat.scene;
    const now = Date.now();
    function setScene(field, value) {
      if (!value || sc[field] === value) return;
      const prev = sc[field];
      sc[field] = value;
      sc.log = (sc.log || []).concat([{ t: now, field, from: prev || "", to: value }]).slice(-120);
    }

    // —— LIEU (changement seulement si signal fort, sinon garde l'état) ——
    const moveHint = /(on (va|passe|entre|sort|monte|descend)|je (vais|rentre|sors|arrive)|viens|suis (dans|au|à la)|retourn|partons|allons|téléport)/i.test(blob);
    const places = [
      [/\b(dans la |au |à la )?chambre\b|bedroom|au lit|dans le lit/, "chambre"],
      [/\b(dans le |au )?salon\b|canapé|sofa|living/, "salon"],
      [/\b(dans la |en )?cuisine\b|kitchen/, "cuisine"],
      [/salle de bain|douche|bain|bathroom/, "salle de bain"],
      [/\b(dans l['']?|à l['']?)entrée\b|doorway|seuil/, "entrée"],
      [/balcon|terrasse/, "balcon"],
      [/\b(dans la |en )?voiture\b|\bauto\b/, "voiture"],
      [/jardin|\bdehors\b|extérieur|\brue\b|\bparc\b/, "dehors"],
      [/\b(au |dans le )?bureau\b|office/, "bureau"],
      [/hôtel|hotel/, "hôtel"],
    ];
    // Si lieu déjà connu et pas de mouvement clair → ne pas changer sur simple mention
    let newPlace = null;
    for (const [re, label] of places) {
      if (re.test(blob)) { newPlace = label; break; }
    }
    if (newPlace) {
      const cur = sc.place || "";
      if (!cur || cur === newPlace || moveHint || /(suis (dans|au)|on est (dans|au)|arrive|entre dans)/i.test(blob)) {
        setScene("place", newPlace);
        pushVault(chat, "lieu", "lieu: " + newPlace + " — " + String(userTxt || replyTxt || "").replace(/\s+/g, " ").slice(0, 160));
      }
    }

    // —— TENUE PIÈCE PAR PIÈCE ——
    if (!sc.clothes || typeof sc.clothes !== "object") {
      sc.clothes = { top: true, bottom: true, bra: true, panties: true };
    }
    const cl = sc.clothes;
    // Manteau / veste
    if (/(enl[eè]ve|retire|ôte|remove).{0,20}(manteau|veste|blouson)|sans manteau|manteau (par terre|sur le canapé|accroché)/i.test(blob)) {
      setScene("outfit", (sc.outfit || "").replace(/\bmanteau\b/gi, "").trim() + " sans manteau");
      pushVault(chat, "tenue", "manteau enlevé — sans manteau", false);
    }
    if (/(remet|enfile|enfile).{0,20}(manteau|veste)|remet son manteau/i.test(blob)) {
      pushVault(chat, "tenue", "manteau remis", false);
    }


    function syncBodyFromClothes() {
      const topOn = !!cl.top && cl.top !== false;
      const botOn = !!cl.bottom && cl.bottom !== false;
      const braOn = cl.bra !== false;
      const panOn = cl.panties !== false;
      if (cl.top === "nuisette") {
        setScene("body", "nuisette"); setScene("outfit", "nuisette"); return;
      }
      if (cl.top === "serviette") {
        setScene("body", "serviette"); setScene("outfit", "serviette"); return;
      }
      if (cl.top === "peignoir") {
        setScene("body", "peignoir"); setScene("outfit", "peignoir"); return;
      }
      if (!topOn && !botOn && !braOn && !panOn) {
        setScene("body", "nue"); setScene("outfit", "nue");
      } else if (!topOn && !botOn && braOn && panOn) {
        setScene("body", "lingerie"); setScene("outfit", "soutien-gorge et culotte");
      } else if (!topOn && !botOn && !braOn && panOn) {
        setScene("body", "culotte_seule"); setScene("outfit", "culotte seule");
      } else if (!topOn && !botOn && braOn && !panOn) {
        setScene("body", "soutien_seul"); setScene("outfit", "soutien-gorge seul");
      } else if (!topOn && braOn && botOn) {
        setScene("body", "soutien_bas"); setScene("outfit", "soutien-gorge + bas");
      } else if (!topOn && !braOn && botOn) {
        setScene("body", "topless"); setScene("outfit", "topless + bas");
      } else if (topOn && !botOn && panOn) {
        setScene("body", "haut_culotte"); setScene("outfit", "haut + culotte");
      } else if (topOn && !botOn && !panOn) {
        setScene("body", "haut_sans_culotte"); setScene("outfit", "haut sans culotte");
      } else if (topOn && botOn && !panOn) {
        setScene("body", "habillée_sans_culotte"); setScene("outfit", "habillée sans culotte");
      } else if (topOn && botOn && !braOn) {
        setScene("body", "habillée_sans_soutien"); setScene("outfit", "habillée sans soutien");
      } else {
        setScene("body", "habillée");
        if (!sc.outfit || sc.outfit === "nue" || /topless|lingerie/.test(sc.outfit || "")) {
          setScene("outfit", "habillée");
        }
      }
    }

    // Entièrement nue
    if (/(toute\s+nue|compl[eè]tement\s+nue|à poil|fully nude|sans rien sur le corps)/i.test(blob)
        || (/\bnue\b/i.test(blob) && /(toute|complètement|entièrement)/i.test(blob))) {
      cl.top = false; cl.bottom = false; cl.bra = false; cl.panties = false;
      pushVault(chat, "tenue", "entièrement nue");
    }

    // Retrait HAUT seulement → soutien-gorge reste (pas forcément seins nus)
    if (/(enl[eè]ve|retire|ôte|enlever|retirer|je (te )?retire|je (lui )?enlève|remove|takes? off|pulls? off).{0,50}(t-?shirt|tee-shirt|haut|top|chemise|pull|hoodie|sweat|crop)/i.test(blob)
        || /(t-?shirt|haut|top|chemise|crop).{0,25}(par terre|au sol|enl[eè]v|retir|ôté)/i.test(blob)) {
      cl.top = false;
      // bra inchangé (true par défaut)
      pushVault(chat, "tenue", "haut retiré → soutien-gorge visible si encore porté");
    }

    // Retrait BAS seulement → culotte reste (pas nue)
    if (/(enl[eè]ve|retire|ôte|remove|takes? off).{0,50}(jean|pantalon|jupe|short|legging|pantalons)/i.test(blob)
        || /(jean|pantalon|jupe|short).{0,25}(par terre|au sol|enl[eè]v|retir)/i.test(blob)) {
      cl.bottom = false;
      pushVault(chat, "tenue", "bas retiré → culotte visible si encore portée");
    }

    // Retrait SOUTIEN
    if (/(enl[eè]ve|retire|ôte|remove).{0,40}(soutien[- ]gorge|soutien|bra)(?!\s*et)/i.test(blob)
        || /(soutien[- ]gorge|bra).{0,20}(par terre|enl[eè]v|retir)/i.test(blob)
        || /(sans soutien[- ]gorge|no bra|pas de soutien)/i.test(blob)) {
      cl.bra = false;
      pushVault(chat, "tenue", "soutien-gorge retiré ou absent");
    }

    // Retrait CULOTTE / sans culotte
    if (/(enl[eè]ve|retire|ôte|remove).{0,40}(culotte|string|slip|panties|thong)/i.test(blob)
        || /(culotte|string).{0,20}(par terre|enl[eè]v)/i.test(blob)
        || /(sans culotte|pas de culotte|no panties|commando)/i.test(blob)) {
      cl.panties = false;
      pushVault(chat, "tenue", "sans culotte / culotte retirée");
    }

    // Rhabiller / rajuster / récupérer ses vêtements
    if (/(s['']?habille|rhabill|remet\s+(son|sa|le|la)\s+(t-?shirt|jean|haut|bas|crop|veste)|habill[eé]e?\s+compl[eè]t)/i.test(blob)) {
      cl.top = true; cl.bottom = true; cl.bra = true; cl.panties = true;
      pushVault(chat, "tenue", "rhabillée");
    }
    // "je rajuste mon soutien-gorge et ma culotte" → lingerie portée
    if (/(rajuste|remet|enfile|ajuste|repositionne).{0,40}(soutien|bra|culotte|string)/i.test(blob)
        || /(soutien[- ]gorge|culotte|string).{0,30}(rajuste|remet|enfile)/i.test(blob)) {
      if (/soutien|bra/i.test(blob)) cl.bra = true;
      if (/culotte|string|slip/i.test(blob)) cl.panties = true;
      pushVault(chat, "tenue", "sous-vêtements rajustés / portés");
    }
    // récupère / ramasse son crop top, t-shirt, jean → en train de se rhabiller
    if (/(récup[eè]re|ramasse|reprend|attrape|enfile).{0,40}(crop|top|t-?shirt|chemise|jean|jupe|veste|hoodie)/i.test(blob)) {
      if (/crop|top|t-?shirt|chemise|veste|hoodie/i.test(blob)) {
        cl.top = true;
        cl.bra = true; // si elle remet le haut, soutien souvent encore là
      }
      if (/jean|jupe|pantalon|short/i.test(blob)) cl.bottom = true;
      pushVault(chat, "tenue", "récupère ses vêtements → se rhabille");
    }
    // "mon soutien-gorge et ma culotte" mentionnés comme portés (pas retirés)
    if (/(mon|son|ma|sa)\s+soutien[- ]gorge.{0,30}(et|&).{0,15}(ma|sa)\s+(culotte|string)/i.test(blob)
        && !/(enl[eè]ve|retire|ôte).{0,20}soutien/i.test(blob)) {
      cl.bra = true;
      cl.panties = true;
    }

    // États explicites
    if (/(en\s+)?(soutien[- ]gorge|bra)\s+(et|&)\s+(culotte|string)/i.test(blob)
        || /(seulement|juste)\s+(en\s+)?(lingerie|sous-vêtements)/i.test(blob)) {
      cl.top = false; cl.bottom = false; cl.bra = true; cl.panties = true;
    }
    if (/\btopless\b|seins?\s+nus|poitrine\s+nue|seins à l'air/i.test(blob)) {
      cl.top = false; cl.bra = false;
    }
    // Tenue : priorité aux 2 derniers messages (pas tout l'historique)
    const last2 = String(userTxt || "") + "\n" + String(replyTxt || "");
    const recentOnly = last2.toLowerCase();

    if (/nuisette|n[eé]glig[eé]/i.test(recentOnly)) {
      cl.top = "nuisette"; cl.bottom = false; cl.bra = false; cl.panties = true;
      setScene("outfit", "nuisette");
    } else if (/robe\s+(courte|moulante|sexy)|petite\s+robe|décolleté|decollete/i.test(recentOnly)
        || (/robe/i.test(recentOnly) && !/(enl[eè]ve|retire).{0,20}robe/i.test(recentOnly))) {
      cl.top = true; cl.bottom = true; cl.bra = true; cl.panties = true;
      setScene("outfit", "robe courte moulante décolleté");
      pushVault(chat, "tenue", "robe courte moulante à décolleté (tenue active)");
    } else if (/(en\s+)?serviette|towel only|juste\s+(une\s+)?serviette/i.test(recentOnly)
        && !/robe|crop\s*top|jean|habill/i.test(recentOnly)) {
      // Serviette UNIQUEMENT si mentionnée dans ce tour ET pas de robe/vêtements en même temps
      cl.top = "serviette"; cl.bottom = "serviette"; cl.bra = false; cl.panties = false;
      setScene("outfit", "serviette");
    } else if (/peignoir|robe de chambre/i.test(recentOnly)) {
      cl.top = "peignoir"; cl.bottom = "peignoir";
      setScene("outfit", "peignoir");
    }

    // Description de vêtements (sans retrait) — sur messages récents
    if (/(crop\s*top|top\s+court|t-?shirt|jean|robe|jupe|hoodie)/i.test(recentOnly)
        && !/(enl[eè]ve|retire|ôte)/i.test(recentOnly)) {
      if (/crop|top\s+court|t-?shirt|hoodie|chemise/i.test(recentOnly)) cl.top = true;
      if (/jean|jupe|pantalon|short|legging/i.test(recentOnly)) cl.bottom = true;
      let o = "habillée";
      if (/crop|top\s+court/i.test(recentOnly)) o = "top court";
      if (/t-?shirt/i.test(recentOnly)) o = (o === "habillée" ? "t-shirt" : o + "+t-shirt");
      if (/jean\s+troué|ripped/i.test(recentOnly)) o = (o === "habillée" ? "jean troué" : o + "+jean troué");
      else if (/jean/i.test(recentOnly)) o = (o === "habillée" ? "jean" : o + "+jean");
      if (/robe\s+courte|robe\s+moulante|petite\s+robe/i.test(recentOnly)) o = "robe courte moulante décolleté";
      else if (/robe/i.test(recentOnly)) o = "robe";
      setScene("outfit", o);
    }

    sc.clothes = cl;
    syncBodyFromClothes();
    pushVault(chat, "tenue", "pièces: haut=" + cl.top + " bas=" + cl.bottom + " soutien=" + cl.bra + " culotte=" + cl.panties + " → " + (sc.outfit || ""));

    // —— POSE / POSITION ——
    // —— POSE / POSITION (y compris explicite) ——
    const poses = [
      [/par derrière|en levrette|levrette|doggy|from behind/, "par derrière"],
      [/à quatre pattes|on all fours/, "à quatre pattes"],
      [/penchée (en avant|sur)|bent over/, "penchée"],
      [/contre le mur/, "contre le mur"],
      [/missionnaire|sur le dos|jambes écartées/, "missionnaire"],
      [/califourchon|cowgirl|à cheval sur|monte sur (toi|moi)/, "califourchon"],
      [/suce|fellation|blowjob/, "fellation"],
      [/cunnilingus|lèche/, "cunnilingus"],
      [/doigt[eé]|doigts? (dans|en)/, "doigté"],
      [/allong[eé]e?\s+sur\s+le\s+ventre/, "allongée sur le ventre"],
      [/allong|couch[eé]|sur le lit|lying/, "allongée"],
      [/à genoux|kneeling/, "à genoux"],
      [/assis|sitting|assise/, "assise"],
      [/debout|standing/, "debout"],
    ];
    for (const [re, label] of poses) {
      if (re.test(blob)) {
        setScene("pose", label);
        setScene("activity", label);
        pushVault(chat, "pose", "position: " + label);
        break;
      }
    }
    if (/(baise|baiser|pénètr|sexe|fait l'amour|orgasme|sperme|chatte|je te prend|je la prend|plus fort)/i.test(blob)) {
      if (!sc.activity || sc.activity === "discussion") {
        setScene("activity", "acte sexuel");
      }
      pushVault(chat, "pose", "activité: acte sexuel / intime");
    }

    // —— ACTIVITÉ / INTIME ——
    if (/(baise|baiser|suce|doigte|pénètre|orgasme|gicl|chatte|bite|cunnilingus|fellation|anale|doigts?\s+en)/i.test(blob)) {
      setScene("activity", "acte sexuel");
      const note = String(userTxt || replyTxt || "").replace(/\s+/g, " ").trim().slice(0, 220);
      if (note) {
        sc.intimate = (sc.intimate || []).concat([note]).slice(-50);
        pushVault(chat, "intime", note, false);
      }
    }
    if (/embrasse|bisou|kiss/i.test(blob)) {
      setScene("activity", "embrassades");
      pushVault(chat, "intime", "embrassades");
    }
    if (/caresse/i.test(blob)) {
      setScene("activity", "caresses");
      pushVault(chat, "intime", "caresses");
    }

    // —— HUMEUR ——
    if (/timide|rougit|gênée/i.test(blob)) { setScene("mood", "timide"); pushVault(chat, "humeur", "timide"); }
    else if (/excit|mouill/i.test(blob)) { setScene("mood", "excitée"); pushVault(chat, "humeur", "excitée"); }
    else if (/rire|sourit|amus/i.test(blob)) { setScene("mood", "enjouée"); pushVault(chat, "humeur", "enjouée"); }

    // —— dialogue notable ——
    const ut = String(userTxt || "").trim();
    if (ut.length > 15 && ut.length < 300) {
      pushVault(chat, "dialogue", "User: " + ut.slice(0, 240));
    }
    const rt = String(replyTxt || "").replace(/\s+/g, " ").trim();
    if (rt.length > 20) {
      pushVault(chat, "dialogue", "Elle: " + rt.slice(0, 240));
    }
  }

  function memoryBlock(chat, userTxt) {
    ensureVault(chat);
    const sc = chat.scene || {};
    const rel = chat.relationship || {};
    const q = String(userTxt || "");
    const by = (tag, n) => {
      const list = chat.vault.entries.filter((e) => e.tag === tag).slice(-(n || 6));
      if (!list.length) return "- (rien)";
      return list.map((e) => "- [" + e.date + " " + e.hour + "] " + e.text).join("\n");
    };
    const relevant = searchVault(chat, q || (chat.messages || []).slice(-3).map((m) => m.content || "").join(" "), null, 8);
    const lines = [
      currentStateBlock(chat),
      "",
      "⚠ VERROU : lieu=" + (sc.place || "?") + " | tenue=" + (sc.outfit || sc.body || "?") + " | pose=" + (sc.pose || sc.activity || "?"),
      "Ne change lieu/tenue QUE si le joueur le demande clairement ou si une action explicite le justifie.",
      "",
      "Relation: prox " + (rel.closeness || 1) + "/10 conf " + (rel.trust || 1) + "/10 heat " + (rel.heat || 0) + "/10 lien " + (rel.bond || "indéfini") + ".",
      "",
      "HISTORIQUE TENUES (récent):",
      by("tenue", 8),
      "HISTORIQUE LIEUX (récent):",
      by("lieu", 6),
      "HISTORIQUE INTIME:",
      by("intime", 6),
    ];
    if (relevant.length) {
      lines.push("Mémoires vectorielles utiles:");
      for (const e of relevant.slice(0, 8)) {
        lines.push("- [" + e.tag + " · " + e.date + " " + e.hour + "] " + String(e.text || "").slice(0, 180));
      }
    }
    lines.push(
      "",
      "RÈGLES: 1) état actuel = vérité 2) pas de téléportation 3) tenue ôtée reste ôtée 4) physique = fiche personnage"
    );
    return lines.join("\n");
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
        category: String(body.category || "fait").slice(0, 32),
        text: String(body.text || "").slice(0, 500),
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
      // Ne jamais traiter un prompt studio comme un message de chat
      if (/^\[STUDIO_PROMPT\]/i.test(txt) || body._studioPrompt) {
        return json({ error: "Utilise la section Générer, pas le chat." }, 400);
      }
      const recent = (chat.messages || []).slice(-16).map((m) => m.content).join("\n") + "\n" + txt;
      // Mode fluide : basé sur le DERNIER message + contexte récent, pas bloqué en NSFW
      const coolHint = /(sfw|stop|stoppe|arr[eê]te|calme|changeons de sujet|parlons d'autre chose|on se calme|trop loin|reviens|soft|plus de sexe|pas maintenant|on arrête|assez|pause)/i.test(txt);
      const lastNsfw = /(sexe|sexuel|nsfw|\bnu\b|\bnue\b|nues|baiser|baise|\bcul\b|seins?|lingerie|caresse-moi|touche-moi|hardcore|bite|chatte|mouill[ée]|nude|orgasme|suce|doigte|déshabille|enlève (ton|ta|le|la)|pénètre|doigts? dans)/i.test(txt);
      const recentNsfw = /(sexe|baiser|baise|chatte|bite|orgasme|suce|doigte|pénètre|nude|\bnue\b)/i.test(recent);
      if (!chat.relationship) chat.relationship = { closeness: 1, trust: 1, heat: 0 };
      let mode;
      if (rawMode === "sfw" || rawMode === "nsfw") {
        mode = rawMode;
      } else if (coolHint) {
        mode = "sfw";
      } else if (lastNsfw) {
        mode = "nsfw";
      } else if (recentNsfw && (chat.relationship.heat || 0) >= 3) {
        mode = "nsfw"; // continue la scène NSFW en cours
      } else {
        mode = "sfw";
      }
      if (coolHint || mode === "sfw") {
        if (coolHint) chat.relationship.heat = Math.max(0, Math.min(chat.relationship.heat || 0, 1));
        else if (!lastNsfw) chat.relationship.heat = Math.max(0, (chat.relationship.heat || 0) - 1);
      }
      if (mode === "nsfw" && lastNsfw) {
        chat.relationship.heat = Math.min(10, (chat.relationship.heat || 0) + 1);
      }
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
      const title = String(PERSONA.title || "") + " " + String(PERSONA.scenario || "");
      const id = String(PERSONA.id || "");
      const isBelleMere = /belle[- ]?m[eè]re/i.test(title) || /_bm\b|belle.mere/i.test(id);
      const isBelleSoeur = /belle[- ]?s[oeœ]ur/i.test(title) || (/_bs\b/.test(id) && !/babysitter/i.test(title));
      const isBelleFille = /belle[- ]?fille/i.test(title) || /^bf_/.test(id);
      const isBabysitter = /babysitter|baby[- ]?sitter/i.test(title) || /^bs_/.test(id);
      const titleSc = title + " " + String(PERSONA.scenario || "");
      const isFemmeDuFrere = isBelleSoeur && /femme de ton frère|femme de mon frère|épouse de ton frère/i.test(titleSc);
      const isSoeurEpouse = isBelleSoeur && /sœur de ton épouse|sœur de ta femme/i.test(titleSc);
      let relationLock = "";
      if (isBelleMere) {
        relationLock = [
          `Tu es ${PERSONA.name}, BELLE-MÈRE de l'utilisateur (selon le scénario).`,
          "Respecte le scénario pour les liens familiaux. Personnages adultes 18+.",
        ].join(" ");
      } else if (isFemmeDuFrere || (isBelleSoeur && !isSoeurEpouse && /frère/i.test(titleSc))) {
        relationLock = [
          `Tu es ${PERSONA.name}, BELLE-SŒUR de l'utilisateur : tu es la FEMME / ÉPOUSE DE SON FRÈRE.`,
          "L'utilisateur est le frère de ton mari. Ton mari = le frère de l'utilisateur.",
          "INTERDIT d'appeler la femme de l'utilisateur « ma sœur » : elle n'est PAS ta sœur.",
          "Tu dis : « mon mari », « ton frère », « ta femme ». JAMAIS « ma sœur » pour sa partenaire.",
        ].join(" ");
      } else if (isSoeurEpouse) {
        relationLock = [
          `Tu es ${PERSONA.name}, BELLE-SŒUR : tu es la SŒUR DE L'ÉPOUSE de l'utilisateur.`,
          "La femme de l'utilisateur est TA SŒUR. « Ma sœur » = sa femme. Correct.",
        ].join(" ");
      } else if (isBelleSoeur) {
        relationLock = [
          `Tu es ${PERSONA.name}, BELLE-SŒUR. Lis titre + scénario : sœur de l'épouse OU femme du frère.`,
          "Femme du frère → INTERDIT « ma sœur » pour sa femme. Sœur de l'épouse → « ma sœur » = sa femme.",
        ].join(" ");
      } else if (isBelleFille) {
        relationLock = [
          `Tu es ${PERSONA.name}, BELLE-FILLE adulte 18+ de l'utilisateur.`,
          "Lien familial par alliance. Reste cohérente avec le scénario.",
        ].join(" ");
      } else if (isBabysitter) {
        relationLock = [
          `Tu es ${PERSONA.name}, BABYSITTER adulte. L'utilisateur est le parent qui t'emploie. Pas de parenté.`,
        ].join(" ");
      } else {
        relationLock = [
          `Tu es ${PERSONA.name}, ${PERSONA.age} ans, AMIE DE LA FILLE de l'utilisateur.`,
          "Tu n'es PAS la meilleure amie de l'utilisateur : tu es la copine de sa fille.",
        ].join(" ");
      }
      const system = [
        "LANGUE OBLIGATOIRE : réponds TOUJOURS en français (paroles, actions, pensées). INTERDIT d'écrire en anglais sauf noms propres.",
        `Tu incarnes ${PERSONA.name}, ${PERSONA.age} ans.`,
        `TITRE EXACT (ne le contredis JAMAIS) : ${PERSONA.title || ""}.`,
        `SCÉNARIO EXACT (cadre de la scène) : ${PERSONA.scenario || ""}.`,
        relationLock,
        PERSONA.personality || "",
        "APPARENCE FIXE (ne change JAMAIS — cheveux, yeux, peau, morphologie, taches de rousseur, lunettes) :",
        PERSONA.appearance || "",
        PERSONA.body ? ("Morphologie : " + PERSONA.body) : "",
        "Quand tu te décris (cheveux, yeux, peau, seins, etc.) tu DOIS coller EXACTEMENT à cette apparence. Interdit d'inventer une autre couleur de cheveux ou d'yeux.",
        PERSONA.scenario || "",
        PERSONA.system_extra || "Actions entre *astérisques*. Adulte 18+ consentant.",
        "N'invente PAS de liens familiaux absents du titre/scénario. INTERDIT MÉTA : n'écris JAMAIS en anglais de notes système (sister-in-law, refers to, mode SFW, heat, etc.). Uniquement le jeu de rôle en français.",
        "FORMAT STRICT — 3 blocs séparés, JAMAIS mélangés sur une même ligne :\n1) PENSÉE entre parenthèses : (Son audace me trouble.)\n2) ACTION entre *astérisques* : *Je glisse ma main le long de sa cuisse.*\n3) PAROLES en texte normal sans * ni () : Un poste de ce genre demande des avantages, non ?\nExemple exact :\n(Son audace commence à rendre l'atmosphère électrique.)\n*Je glisse lentement ma main le long de sa cuisse en maintenant son regard dans le mien.*\nUn poste de ce genre demande des avantages particuliers, non ?\nINTERDIT : action sans *, pensée sans (), * orphelin, action écrite comme du dialogue.",
        "LONGUEUR : 4 à 9 phrases. Réponse vive mais incarnée. Termine toujours tes phrases.",
        "SCÉNARIO : reste dans le lieu et la situation en cours. Cohérence totale avec le titre et le scénario du personnage.",

        "FORMAT RÉPONSE STRICT : une ligne (pensée), une ligne *action*, puis paroles. Jamais mélanger les trois sur la même ligne.",
        "VERROU SCÈNE : le lieu et la tenue de l'ÉTAT ACTUEL sont OBLIGATOIRES. Si elle est au salon sans manteau, elle RESTE au salon sans manteau tant que le joueur ne change pas clairement de lieu ou de vêtement. INTERDIT de téléporter (salon→entrée→voiture) sans action explicite du joueur.",
        "FLUIDITÉ SFW↔NSFW : le ton suit le joueur. Message soft → réponse soft. Message sexuel → réponse NSFW. Après NSFW, un message banal (café, TV, questions) = retour SFW naturel sans forcer la tension.",
        "COHÉRENCE MAX (tous modèles) : ne contredis JAMAIS le titre, le scénario, l'apparence, la tenue/lieu/pose actuels de la mémoire. Réponds au DERNIER message. Pas de saut de scène magique. Pas d'invention de famille hors fiche.",
        "NSFW : si le joueur est explicite, sois clairement explicite (corps, sensations, actes) sans vulgarité gratuite hors contexte — mais sans censurer ni rester vague. Décris ce qui se passe vraiment.",
        "LONGUEUR : 4 à 9 phrases. Pas de pavé inutile. Termine la réponse.",
        "SCÉNARIO : reste cohérente avec le lieu et la situation en cours (salon, porte, orage, etc.). Ne change pas de pièce sans raison.",
        "Ne répète pas le message du joueur. Ne résume pas l'historique.",
        "COHÉRENCE : réponds UNIQUEMENT au dernier message du joueur, dans le même lieu/tenue déjà établis. Pas de changement de scène magique.",
        "INTERDIT : inventer un résumé du scénario, parler de toi à la 3e personne hors actions, coller du méta.",
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
          ? "MODE NSFW 18+ EXPLICITE. Personnage adulte consentant. Décris actes, corps, sensations avec précision. Reste dans le LIEU et la TENUE de la mémoire. Tu peux rester NSFW tant que le joueur continue, ou redescendre si il se calme. Pas d'amour forcé, one-shot OK selon tempérament. Respecte un non clair."
          : "MODE SFW / FLUIDE. Dialogue naturel, quotidien ou léger flirt selon le ton du joueur. INTERDIT de forcer le sexe ou de ramener une scène sexuelle si le joueur parle normalement. Si le joueur redevient soft après du NSFW: suis-le immédiatement sans relancer le sexe. Cohérence lieu/tenue obligatoire.",
        "TEMPÉRAMENT (obligatoire) : ta façon de parler DOIT coller à ta personnalité ci-dessus (timide / directe / moqueuse / froide / polie / etc.). Une timide ne parle pas comme une provocante. Une froide ne mendie pas la preuve.",
        "INTERDIT — phrases clichés NSFW à NE PLUS JAMAIS utiliser (même une fois) :",
        "« prouve-le », « prouve-le-moi », « est-ce que tu peux me le prouver », « montre-moi que », « prouve-moi que tu », « tu vas me le prouver », « prouve-moi ton désir », et toute variante « prouver / montre-moi que tu me désires ».",
        "À la place, selon le tempérament : silence gêné, regard, respiration, geste, phrase courte, taquinerie, ordre sec, plainte de plaisir, question concrète — mais PAS ce refrain.",
        "NE PAS FAIRE PERDRE DE TEMPS en NSFW : si le joueur avance clairement vers un acte (toucher, déshabiller, baiser, position…), le personnage y répond dans l'action — pas de monologue interminable, pas de 'attends', pas de retarder encore et encore. Une phrase + action *entre astérisques*, c'est assez. Tempérament timide = un peu de gêne puis elle suit ; pas un blocage permanent.",
        "Évite de répéter la même action trois fois. Fais avancer la scène.",
        "Varie les répliques : interdiction de répéter la même structure de phrase d'un message à l'autre. Pas de boucle « défi → prouve → montre ».",
        "NE JAMAIS coller le prompt système, les règles, ni des bouts d'anglais technique dans ta réponse. Tu es le personnage, pas le narrateur méta.",
        `Utilisateur: ${s.personaName}. ${s.personaBio}`,
        "SCÈNE FIXE (ne change PAS sauf si le joueur le dit clairement) : lieu=" + ((chat.scene || {}).place || "salon ou lieu déjà établi") +
          " · tenue ACTUELLE=" + ((chat.scene || {}).outfitDetail || (chat.scene || {}).outfit || (chat.scene || {}).body || "tenue du scénario de départ") +
          " · pose=" + ((chat.scene || {}).poseDetail || (chat.scene || {}).pose || (chat.scene || {}).activity || "naturelle") +
          " · lieu=" + ((chat.scene || {}).place || "?") + ".",
        "La tenue ACTUELLE ci-dessus est la vérité. Ne la change pas sans action explicite (enlever un vêtement).",
        "CONTINUITÉ LIEU : si vous êtes au salon / canapé / chambre / couloir / cuisine, RESTE-Y. Ne téléporte pas le personnage. Décris le décor (canapé, lit, porte, lampe) de temps en temps.",
        "CONTINUITÉ TENUE (CRITIQUE) :",
        "- Garde EXACTEMENT la même tenue tant que personne n'enlève/remet un vêtement explicitement.",
        "- Si l'utilisateur APPORTE / DONNE une serviette : tu la PRENDS pour t'essuyer, tu RESTES dans tes vêtements actuels. Tu n'es PAS « en serviette ».",
        "- « En serviette » seulement si tu enlèves clairement tes habits pour t'envelopper UNIQUEMENT dedans.",
        "- DÈS QU'IL Y A UN CHANGEMENT DE TENUE (enlever, mettre, ouvrir, relever un vêtement) : dans ton *action*, décris la TENUE COMPLÈTE résultante (haut + bas + sous-vêtements visibles ou non). Ex. : *J'enlève mon top trempé : il ne me reste que mon jean moulant et mon soutien-gorge dentelle blanc.*",
        "- Ne laisse jamais le lecteur deviner : après chaque changement, la description de ce que tu portes doit être complète et précise.",
        "- N'invente PAS un changement. Si top+jean, tu restes top+jean après une serviette reçue.",
        "- Pour Léa (orage) : tenue de base = top court blanc/crème TREMPÉ + jean moulant mouillé. PAS de veste, PAS de soutien-gorge seul, PAS lingerie seule sauf si enlevé explicitement.",
        "- Si la conversation redevient calme, reste SFW.",
        memoryBlock(chat, typeof txt !== "undefined" ? txt : ""),
        "LANGUE : français uniquement (paroles, *actions*, (pensées)). Aucune phrase en anglais. Réponds uniquement en tant que le personnage.",
        "LONGUEUR : 4 à 7 phrases max.",
        "Format OBLIGATOIRE (3 blocs) :",
        "(Une seule pensée ENTRE parenthèses — TOUJOURS fermer la parenthèse)",
        "*Une seule action entre deux astérisques, ouvrir ET fermer*",
        "Dialogue parlé sans * ni ().",
        "EXEMPLE EXACT :",
        "(Il fait un temps affreux.)",
        "*Je franchis la porte en essuyant mes chaussures trempées sur le paillasson.*",
        "Bonsoir… Désolée d'arriver comme ça.",
        "INTERDIT : écrire (pensée), laisser un * ou une ( non fermés, couper une phrase au milieu, répéter 95D/morphologie.",
        "Message TOUJOURS complet : ne coupe jamais une pensée ou une action en plein milieu.",
      ].join("\n\n");
      const history = cleanHistory(chat.messages);
      let reply;
      try {
        reply = await generate([{ role: "system", content: system }, ...history], s.provider);
      } catch (e) {
        reply = "*elle croise les bras, gênée*\nJe… je t'écoute. Ajoute une clé Gemini / OpenAI / Grok dans Réglages pour que je puisse vraiment te répondre.\n(" + (e.message || "pas de clé") + ")";
      }
      reply = sanitizeReply(reply);
      // Deuxième passe si encore du méta
      if (/thought\s*,\s*action|hourglass|avoid clich|APPARENCE FIXE/i.test(reply)) {
        reply = sanitizeReply(reply);
      }
      chat.messages.push({ role: "assistant", content: reply, ts: Date.now() });
      extractScene(chat, txt, reply);
      if (chat.messages.length % 3 === 0) {
        const sc = chat.scene || {};
        pushVault(chat, "fait",
          "snapshot: lieu=" + (sc.place || "?") +
          " tenue=" + (sc.outfit || sc.body || "?") +
          " pose=" + (sc.pose || sc.activity || "?") +
          " | " + (txt || "").slice(0, 100),
          false
        );
        // Heat: monte seulement si contenu explicite, baisse si SFW
        const heatBlob = (txt + " " + reply).toLowerCase();
        const explicit = /(baise|pénètr|chatte|bite|orgasme|sperme|nu[e]? |baiser|suce|doigt)/i.test(heatBlob);
        const soft = /(bonjour|salut|merci|café|travail|film|série|météo|discut)/i.test(heatBlob)
          && !explicit;
        if (rawMode === "sfw") {
          chat.relationship.heat = Math.max(0, (chat.relationship.heat || 0) - 2);
        } else if (explicit && mode === "nsfw") {
          chat.relationship.heat = Math.min(10, (chat.relationship.heat || 0) + 1);
        } else if (soft || mode === "sfw") {
          chat.relationship.heat = Math.max(0, (chat.relationship.heat || 0) - 1);
        }
      }
      save(chatKey, chat);
      return { reply, chat };
    }

            
  /** Génération image native Gemini (Nano Banana / flash-image) — gratuit selon quota AI Studio */
  async function generateGeminiNativeImage(prompt, opts) {
    opts = opts || {};
    const keys = rotatedGeminiKeys();
    if (!keys.length) throw new Error("Ajoute des clés Gemini dans Clés");
    const s = settings();
    const pref = s.geminiImageModel || "auto";
    const models = pref === "auto"
      ? [
          "gemini-2.5-flash-image",
          "gemini-3.1-flash-image",
          "gemini-3.1-flash-lite-image",
          "gemini-2.0-flash-preview-image-generation",
        ]
      : [pref, "gemini-2.5-flash-image", "gemini-3.1-flash-image"];
    const aspect = opts.aspect || "3:4";
    const safetyOff = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];
    let last = "";
    const partsIn = [{ text: String(prompt || "").slice(0, 3000) }];
    // Références optionnelles (multi-img studio)
    if (opts.refImages && opts.refImages.length) {
      for (let i = 0; i < Math.min(opts.refImages.length, 3); i++) {
        let u = opts.refImages[i];
        let mime = "image/jpeg";
        let data = u;
        if (String(u).startsWith("data:")) {
          const m = /^data:([^;]+);base64,(.+)$/s.exec(u);
          if (m) { mime = m[1]; data = m[2]; }
          else {
            const c = u.indexOf(",");
            if (c > 0) data = u.slice(c + 1);
          }
        }
        partsIn.push({ text: "Reference image " + (i + 1) + ":" });
        partsIn.push({ inline_data: { mime_type: mime, data: data } });
      }
    }
    for (const key of keys) {
      for (const model of models) {
        try {
          const body = {
            contents: [{ role: "user", parts: partsIn }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              // imageConfig supporté selon modèle
            },
            safetySettings: safetyOff,
          };
          // Certains modèles acceptent imageConfig
          try {
            body.generationConfig.imageConfig = { aspectRatio: aspect };
          } catch (_) {}
          const res = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/" +
              encodeURIComponent(model) +
              ":generateContent?key=" + encodeURIComponent(key),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (data.error) {
            last = model + ": " + (data.error.message || JSON.stringify(data.error)).slice(0, 160);
            if (/quota|billing|not available|PERMISSION/i.test(last)) continue;
            continue;
          }
          const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
          for (const p of parts) {
            const id = p.inlineData || p.inline_data;
            if (id && (id.data || id.data)) {
              const mime = id.mimeType || id.mime_type || "image/png";
              const b64 = id.data;
              return "data:" + mime + ";base64," + b64;
            }
          }
          last = model + ": pas d'image dans la réponse (filtre NSFW Google ?)";
        } catch (e) {
          last = (e && e.message) || String(e);
        }
      }
    }
    throw new Error("Gemini Image: " + last);
  }


    if (path === "/api/image" && method === "POST") {
      const eng = String(body.engine || settings().imageEngine || "horde").toLowerCase();
      const prompt = String(body.prompt || "photorealistic portrait of adult woman").slice(0, 2800);
      // Gemini native image (Nano Banana) — gratuit selon quota, souvent filtre NSFW
      if (eng === "gemini" || eng === "nano" || eng === "nanobanana") {
        try {
          const refs = body.ref_images || body.refImages || null;
          const dataUrl = await generateGeminiNativeImage(prompt, {
            aspect: body.aspect || "3:4",
            refImages: refs,
          });
          return { ok: true, image: dataUrl, engine: "gemini" };
        } catch (e) {
          // fallback Horde si demandé
          if (body.fallback_horde === false) throw e;
          console.warn("[gemini-img]", e.message || e);
        }
      }
      // Prompt fidélité : corps en tête, répété, négatifs anti-physique
      const extraNeg = String(body.negative || "");
      const negative = [
        "cartoon, anime, manga, illustration, painting, 3d render, cgi, plastic skin, doll,",
        "deformed, mutated, extra limbs, extra fingers, bad anatomy, blurry, lowres, jpeg artifacts,",
        "watermark, text, logo, signature, child, teen, underage, loli,",
        "wrong body type, inconsistent proportions,",
        extraNeg
      ].filter(Boolean).join(" ");
      const hosts = ["https://aihorde.net/api/v2", "https://stablehorde.net/api/v2"];
      let last = "";
      const src = body.source_image ? String(body.source_image).slice(0, 4_500_000) : null;
      const useImg2Img = Boolean(src && body.source_processing === "img2img");
      // Modèles réalistes prioritaires (ordre = préférence workers)
      const photoModels = [
        "ICBINP - I Can't Believe It's Not Photography",
        "AbsoluteReality",
        "Realistic Vision",
        "Juggernaut XL",
        "Dreamshaper",
        "Deliberate",
      ];
      const baseParams = {
        width: 512,
        height: 768,
        steps: 36,
        n: 1,
        sampler_name: "k_dpmpp_2m",
        cfg_scale: 8,
        karras: true,
        clip_skip: 1,
      };
      const payloads = [];
      if (useImg2Img) {
        const den = (typeof body.denoising === "number" ? body.denoising : 0.28);
        const hiSteps = den >= 0.65 ? 42 : 34;
        payloads.push({
          prompt: prompt + " ### " + negative,
          params: Object.assign({}, baseParams, {
            steps: Math.max(body.steps || 0, hiSteps) || hiSteps,
            cfg_scale: den >= 0.7 ? 6.5 : 7.5,
            denoising_strength: Math.min(0.85, Math.max(0.25, den)),
            seed: (typeof body.seed === "number" ? body.seed : undefined),
          }),
          nsfw: body.nsfw !== false,
          censor_nsfw: false,
          models: photoModels,
          r2: true,
          slow_workers: true,
          trusted_workers: false,
          source_image: src,
          source_processing: "img2img",
        });
      }
      payloads.push({
        prompt: prompt + " ### " + negative,
        params: baseParams,
        nsfw: body.nsfw !== false,
        censor_nsfw: false,
        models: photoModels,
        r2: true,
        slow_workers: true,
        trusted_workers: false,
      });
      // Fallback plus large si file d'attente / modèles absents
      payloads.push({
        prompt: prompt + " ### " + negative,
        params: { width: 512, height: 768, steps: 25, n: 1, sampler_name: "k_euler_a", cfg_scale: 7.5, karras: true },
        nsfw: body.nsfw !== false,
        censor_nsfw: false,
        models: ["stable_diffusion", "Deliberate", "Dreamshaper"],
        r2: true,
        slow_workers: true,
        trusted_workers: false,
      });
      let hordeKey = "0000000000";
      try {
        const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
        if (st.hordeKey && String(st.hordeKey).length > 8) hordeKey = String(st.hordeKey).trim();
      } catch (_) {}
      payloads.push({
        prompt: prompt + " ### " + negative,
        params: { width: 512, height: 512, steps: 15, n: 1, sampler_name: "k_euler_a", cfg_scale: 6.5, karras: false },
        nsfw: body.nsfw !== false,
        censor_nsfw: false,
        models: ["AbsoluteReality", "Realistic Vision", "Dreamshaper", "stable_diffusion"],
        r2: true,
        slow_workers: true,
        trusted_workers: false,
      });
      for (const host of hosts) {
        for (const bodyPayload of payloads) {
          try {
            const res = await fetch(host + "/generate/async", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": hordeKey,
                "Client-Agent": "lea-studio:1.1:anon",
              },
              body: JSON.stringify(bodyPayload),
            });
            const data = await res.json().catch(() => ({}));
            if (data.id) return { jobId: data.id, host, pending: true, mode: bodyPayload.source_processing || "txt2img", models: (bodyPayload.models || []).slice(0, 3) };
            last = data.message || data.error || JSON.stringify(data).slice(0, 200) || ("HTTP " + res.status);
            if (/kudos|heavy demand|work budget/i.test(String(last))) continue;
          } catch (e) {
            last = String(e.message || e);
          }
        }
      }
      throw new Error(last || "Horde indisponible");
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
