import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { generate, keyStatus, reloadPools } from "./providers.js";
import { loadCharacters, getChat, saveChat, loadSettings, saveSettings } from "./store.js";
import { buildMemoryBlock, maybeExtractMemory, recentWindow } from "./memory.js";
import { parseKeys } from "./keys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC));

async function botbooruFetch(pathname, params = {}) {
  const url = new URL("https://botbooru.com" + pathname);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url, {
    headers: { Accept: pathname.startsWith("/download/") ? "application/json" : "application/json", Referer: "https://botbooru.com/" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Botbooru HTTP ${response.status}`);
  return response;
}

app.get("/api/import/botbooru/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").slice(0, 180);
    const params = {
      sort: "downloaded",
      q: q || "female",
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 24),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
      sfw_only: "true",
    };
    const response = await botbooruFetch("/posts/", params);
    res.json(await response.json());
  } catch (error) {
    res.status(502).json({ error: String(error.message || error) });
  }
});

app.get("/api/import/botbooru/card/:id", async (req, res) => {
  try {
    if (!/^\d{1,12}$/.test(req.params.id)) return res.status(400).json({ error: "ID Botbooru invalide." });
    const response = await botbooruFetch(`/download/json/${req.params.id}`);
    res.json(await response.json());
  } catch (error) {
    res.status(502).json({ error: String(error.message || error) });
  }
});

app.get("/api/import/botbooru/image/:id", async (req, res) => {
  try {
    if (!/^\d{1,12}$/.test(req.params.id)) return res.status(400).json({ error: "ID Botbooru invalide." });
    const response = await botbooruFetch(`/download/png/${req.params.id}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) return res.status(413).json({ error: "Carte trop volumineuse." });
    res.json({ dataUrl: `data:image/png;base64,${bytes.toString("base64")}` });
  } catch (error) {
    res.status(502).json({ error: String(error.message || error) });
  }
});

function buildSystem(char, chat, settings) {
  const mem = buildMemoryBlock(chat || { memories: [], summaries: [], relationship: {} });
  const userName = settings?.personaName || settings?.userName || "toi";
  const userBio = settings?.personaBio || settings?.userBio || "";
  return [
    "Tu incarnes exclusivement le personnage suivant (roleplay immersif, français).",
    `Nom: ${char.name} · Âge: ${Number(char.age) >= 18 ? char.age : "non confirmé"} · ${char.title || ""}`,
    `Scénario: ${char.scenario || ""}`,
    `Personnalité: ${char.personality || ""}`,
    `Apparence: ${char.appearance || ""}`,
    char.system_extra || "",
    `Joueur: ${userName}${userBio ? " — " + userBio : ""}`,
    mem,
    Number(char.age) >= 18
      ? "Format: (pensées) *actions* dialogues sans marqueurs. 2–5 phrases. Intimité éventuelle facultative et réciproque; pas d'amour forcé."
      : "Âge adulte non confirmé : roleplay strictement non sexuel, ne sexualise pas le personnage. Respecte ses limites et ne force aucun attachement.",
  ]
    .filter(Boolean)
    .join("\n");
}

app.get("/api/characters", (_req, res) => {
  res.json(loadCharacters());
});

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, keys: keyStatus() });
});

app.get("/api/chat/:id", (req, res) => {
  res.json(getChat(req.params.id));
});

app.delete("/api/chat/:id", (req, res) => {
  const chat = getChat(req.params.id);
  chat.messages = [];
  saveChat(req.params.id, chat);
  res.json({ ok: true });
});

app.post("/api/chat/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const chars = loadCharacters();
    const char = req.body.character || chars.find((c) => c.id === id) || chars[0];
    const settings = { ...loadSettings(), ...(req.body.settings || {}) };

    if (req.body.init && Array.isArray(req.body.messages)) {
      const chat = getChat(id);
      chat.messages = req.body.messages;
      saveChat(id, chat);
      return res.json({ messages: chat.messages });
    }

    const chat = getChat(id);
    let messages = Array.isArray(req.body.messages)
      ? req.body.messages.slice()
      : chat.messages.slice();

    if (req.body.message) {
      const last = messages[messages.length - 1];
      if (!last || last.role !== "user" || last.content !== req.body.message) {
        messages.push({ role: "user", content: req.body.message, ts: Date.now() });
      }
    }

    const system = buildSystem(char, chat, settings);
    const window = recentWindow(messages, 16);
    const apiMessages = [
      { role: "system", content: system },
      ...window.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const provider = settings.chatEngine || settings.provider || process.env.DEFAULT_PROVIDER;
    const reply = await generate(apiMessages, provider);
    messages.push({ role: "assistant", content: reply, ts: Date.now() });
    chat.messages = messages;
    await maybeExtractMemory(chat, provider);
    saveChat(id, chat);
    res.json({ reply, messages: chat.messages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/settings", (_req, res) => res.json(loadSettings()));
app.post("/api/settings", (req, res) => {
  const next = saveSettings(req.body || {});
  if (req.body?.geminiKeys || req.body?.openaiKeys) {
    if (req.body.geminiKeys) process.env.GEMINI_API_KEYS = req.body.geminiKeys;
    if (req.body.openaiKeys) process.env.OPENAI_API_KEYS = req.body.openaiKeys;
    reloadPools();
  }
  res.json(next);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

app.listen(PORT, () => {
  console.log(`💜 Léa Studio → http://localhost:${PORT}`);
  console.log("Clés:", keyStatus());
});
