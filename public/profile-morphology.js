(function (root) {
  "use strict";

  function explicitCup(card) {
    const appearance = String((card && card.appearance) || "");
    const line = (appearance.match(/(?:^|\n)\s*Poitrine\s*:\s*([^\n]+)/i) || [])[1] || "";
    const match =
      line.match(/\bbonnet\s*([A-J])\b/i) ||
      line.match(/\b\d{2,3}\s*([A-J])\b/i) ||
      line.match(/\b([A-J])\s*-?\s*cup\b/i);
    return match ? String(match[1] || match[2]).toUpperCase() : "";
  }

  function explicitShape(card) {
    const appearance = String((card && card.appearance) || "");
    const start = appearance.match(/(?:^|\n)\s*Corps et silhouette\s*:\s*/i);
    if (!start) return "";
    const from = start.index + start[0].length;
    const rest = appearance.slice(from);
    const next = rest.search(/\n\s*(?:Poitrine|Peau|Origine|Fiche\s+body)\s*:/i);
    return rest.slice(0, next < 0 ? undefined : next).replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  }

  function translateShape(value) {
    const text = String(value || "").toLowerCase();
    if (/sablier|hourglass/.test(text)) {
      return "curvy hourglass figure with a defined waist, full hips and rounded curves";
    }
    if (/athl[eé]t|athletic|tonique|toned/.test(text)) {
      return "athletic, toned figure with defined muscles and fit legs";
    }
    if (/mince|slim|longiligne|élanc[eé]e|lean/.test(text)) {
      return "slim, slender figure with a narrow waist and long lines";
    }
    if (/ronde|pulpeuse|plus[\s-]?size|chubby|plump|corpulent/.test(text)) {
      return "fuller, soft-curved figure with natural proportions";
    }
    if (/harmonieuse|harmonieux|proportions naturelles|balanced|natural proportions/.test(text)) {
      return "balanced feminine figure with natural proportions";
    }
    if (/fine|finement|d[eé]licate|petite/.test(text)) {
      return "delicate, petite figure with natural proportions";
    }
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function legacyShape(value) {
    return String(value || "")
      .split(/[.;,\n]+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((part) => part && !/(?:bonnet\s*[A-J]|\b[A-J]\s*-?\s*cup|\b\d{2,3}\s*[A-J]\b|breasts?|boobs?|chest|bust|cleavage|poitrine|seins?)/i.test(part))
      .join(", ");
  }

  function cupDescription(cup) {
    if (!cup) return "";
    return cup + "-cup breasts, matching the explicit character description";
  }

  function shapeTag(shape) {
    const text = String(shape || "").toLowerCase();
    if (/sablier|hourglass/.test(text)) return "silhouette sablier";
    if (/athl[eé]t|athletic|tonique|toned/.test(text)) return "athlétique";
    if (/mince|slim|longiligne|élanc[eé]e|lean/.test(text)) return "mince";
    if (/ronde|pulpeuse|plus[\s-]?size|chubby|plump|corpulent/.test(text)) return "ronde";
    if (/harmonieuse|harmonieux|balanced|proportions naturelles/.test(text)) return "proportions naturelles";
    if (/fine|finement|d[eé]licate|petite/.test(text)) return "petite";
    return "";
  }

  function isDuo(card) {
    return Boolean(
      card &&
      (card.is_duo === true ||
        Array.isArray(card.people) ||
        /^duo[_-]/i.test(String(card.id || "")))
    );
  }

  function normalizeCard(card) {
    if (!card || typeof card !== "object" || isDuo(card)) return card;

    const cup = explicitCup(card);
    const shapeFr = explicitShape(card);
    if (!cup && !shapeFr) return card;

    const shapeText = shapeFr || card.morphology_fr || legacyShape(card.body);
    const shapeEn = translateShape(shapeText);
    const cupEn = cupDescription(cup);
    const morphology = [shapeEn, cupEn].filter(Boolean).join(", ");
    card.morphology_fr = shapeText || "";
    card.morphology_en = morphology || card.morphology_en || "";

    if (cup) {
      card.appearance = String(card.appearance || "")
        .replace(/((?:^|\n)\s*Poitrine\s*:\s*)[^\n]*/i, "$1bonnet " + cup + ".");
      card.title = String(card.title || "").replace(/bonnet\s*[A-J]\b/gi, "bonnet " + cup);
      card.title = card.title.replace(/\b\d{2,3}\s*[A-J]\b/gi, cup + "-cup");
    }

    card.appearance = String(card.appearance || "").replace(
      /(\bFiche\s+body\s*:\s*)[^\n]*/i,
      "$1" + morphology
    );
    card.body = morphology || String(card.body || "").trim();

    if (Array.isArray(card.tags)) {
      const bodyTag = /bonnet\s*[A-J]|\b[A-J]\s*-?\s*cup\b|seins?|poitrine|breast|chest|bust|ronde|pulpeuse|mince|slim|\bthin\b|slender|lean|athl[eé]t|athletic|sablier|hourglass|curvy|chubby|plus[\s-]?size|plump|corpulent|toned|skinny|voluptuous|thick/i;
      const kept = card.tags.filter((tag) => !bodyTag.test(String(tag)));
      if (cup) kept.push("bonnet " + cup);
      const translatedTag = shapeTag(shapeFr);
      if (translatedTag) kept.push(translatedTag);
      card.tags = [...new Set(kept)];
    }

    if (card.looks_en) {
      const bodyPhrase = /\b(?:[A-J]\s*-?\s*cup|(?:\d{2,3}\s*)[A-J])\b|breasts?|boobs?|chest|bust|cleavage|slim|slender|lean|\bthin\b|athletic|toned|hourglass|curvy|chubby|plus[\s-]?size|plump|voluptuous|skinny|thick|wide hips|full hips|narrow frame|soft belly|round butt|petite frame|body type|figure|physique|long legs/i;
      const identityTraits = String(card.looks_en)
        .split(/[,;]+/)
        .map((part) => part.replace(/[()]/g, "").replace(/:\d+(?:\.\d+)?/g, "").trim())
        .filter((part) => part && !bodyPhrase.test(part));
      card.looks_en = [...identityTraits, shapeEn, cupEn].filter(Boolean).join(", ");
    }

    return card;
  }

  function normalizeAll() {
    for (const key of Object.keys(root)) {
      if (!/^LEA_CAST_/.test(key) || !Array.isArray(root[key])) continue;
      root[key].forEach(normalizeCard);
    }
  }

  normalizeAll();
  root.LeaProfileMorphology = {
    explicitCup,
    explicitShape,
    normalizeCard,
    normalizeAll,
    translateShape,
  };
})(window);
