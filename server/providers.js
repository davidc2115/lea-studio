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

async function callGemini(messages) {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
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
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.9, maxOutputTokens: 700 },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        pools.gemini.fail(key, data.error?.status === "RESOURCE_EXHAUSTED" ? 120000 : 30000);
        lastErr = data.error?.message || res.statusText;
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      if (!text) {
        lastErr = "Réponse Gemini vide";
        continue;
      }
      return text.trim();
    } catch (e) {
      pools.gemini.fail(key, 20000);
      lastErr = e.message;
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
