import { KeyPool, parseKeys } from "./keys.js";

function envPools() {
  return {
    openai: new KeyPool(parseKeys(process.env.OPENAI_API_KEYS)),
    gemini: new KeyPool(parseKeys(process.env.GEMINI_API_KEYS)),
  };
}

let pools = envPools();

export function reloadPools() {
  pools = envPools();
}

export function keyStatus() {
  return {
    openai: pools.openai.count(),
    gemini: pools.gemini.count(),
    openaiAvailable: pools.openai.available().length,
    geminiAvailable: pools.gemini.available().length,
    defaultProvider: process.env.DEFAULT_PROVIDER || "gemini",
  };
}

async function callOpenAI(messages) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  let lastErr = "Aucune clé OpenAI";
  for (let i = 0; i < Math.max(pools.openai.count(), 1); i++) {
    const key = pools.openai.next();
    if (!key) break;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, temperature: 0.9, max_tokens: 700 }),
      });
      const data = await res.json();
      if (!res.ok) {
        pools.openai.fail(key, res.status === 429 ? 120000 : 30000);
        lastErr = data.error?.message || res.statusText;
        continue;
      }
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
      pools.openai.fail(key, 20000);
      lastErr = e.message;
    }
  }
  throw new Error(lastErr);
}

const GEMINI_SAFETY = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
];

function geminiTextModels() {
  const pref = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const all = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"];
  return [pref, ...all.filter((m) => m !== pref)];
}

async function callGemini(messages) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  let lastErr = "Aucune clé Gemini";
  for (let i = 0; i < Math.max(pools.gemini.count(), 1); i++) {
    const key = pools.gemini.next();
    if (!key) break;
    for (const model of geminiTextModels()) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.95, maxOutputTokens: 1200 },
            safetySettings: GEMINI_SAFETY,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          lastErr = (data.error?.message || res.statusText) + " [" + model + "]";
          if (data.error?.status === "RESOURCE_EXHAUSTED") pools.gemini.fail(key, 120000);
          continue;
        }
        const cand = data.candidates?.[0];
        const text = cand?.content?.parts?.map((p) => p.text).join("") || "";
        if (text) return text.trim();
        lastErr = "Réponse Gemini vide (" + (cand?.finishReason || "no text") + ") [" + model + "]";
      } catch (e) {
        lastErr = e.message;
      }
    }
  }
  throw new Error(lastErr);
}

export async function generate(messages, provider) {
  const pref = (provider || process.env.DEFAULT_PROVIDER || "gemini").toLowerCase();
  const order = pref === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
  const errors = [];
  for (const p of order) {
    try {
      if (p === "openai" && pools.openai.count()) return await callOpenAI(messages);
      if (p === "gemini" && pools.gemini.count()) return await callGemini(messages);
    } catch (e) {
      errors.push(`${p}: ${e.message}`);
    }
  }
  throw new Error(errors.join(" | ") || "Aucune clé API configurée");
}
