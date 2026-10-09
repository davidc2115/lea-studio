export function parseKeys(raw) {
  return String(raw || "")
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export class KeyPool {
  constructor(keys = []) {
    this.keys = keys;
    this.index = 0;
    this.disabledUntil = new Map();
  }

  available() {
    const now = Date.now();
    return this.keys.filter((k) => (this.disabledUntil.get(k) || 0) < now);
  }

  next() {
    const pool = this.available();
    if (!pool.length) return null;
    const key = pool[this.index % pool.length];
    this.index += 1;
    return key;
  }

  fail(key, ms = 60_000) {
    if (!key) return;
    this.disabledUntil.set(key, Date.now() + ms);
  }

  count() {
    return this.keys.length;
  }
}
