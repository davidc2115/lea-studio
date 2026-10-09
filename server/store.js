import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");
const CHATS = path.join(DATA, "chats.json");
const SETTINGS = path.join(DATA, "settings.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function loadCharacters() {
  return readJson(path.join(DATA, "characters.json"), []);
}

export function loadSettings() {
  return readJson(SETTINGS, {
    provider: process.env.DEFAULT_PROVIDER || "gemini",
    personaName: "Toi",
    personaBio: "La personne chez qui Léa se réfugie.",
  });
}

export function saveSettings(next) {
  const cur = loadSettings();
  const merged = { ...cur, ...next };
  writeJson(SETTINGS, merged);
  return merged;
}

export function loadChats() {
  return readJson(CHATS, {});
}

export function getChat(characterId) {
  const all = loadChats();
  if (!all[characterId]) {
    all[characterId] = {
      messages: [],
      memories: [],
      summaries: [],
      relationship: { closeness: 1, trust: 1, heat: 0 },
      updatedAt: Date.now(),
    };
    writeJson(CHATS, all);
  }
  return all[characterId];
}

export function saveChat(characterId, chat) {
  const all = loadChats();
  chat.updatedAt = Date.now();
  all[characterId] = chat;
  writeJson(CHATS, all);
  return chat;
}
