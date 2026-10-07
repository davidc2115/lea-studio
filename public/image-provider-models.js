(function (root) {
  "use strict";

  const catalog = {
    cloudflare: [
      {
        id: "@cf/black-forest-labs/flux-2-dev",
        label: "FLUX.2 [dev] — Cloudflare Workers AI",
      },
      {
        id: "@cf/black-forest-labs/flux-2-klein-9b",
        label: "FLUX.2 Klein 9B — Cloudflare Workers AI",
      },
      {
        id: "@cf/black-forest-labs/flux-2-klein-4b",
        label: "FLUX.2 Klein 4B — Cloudflare Workers AI",
      },
    ],
    pollinations: [
      {
        id: "black-forest-labs/flux.2-klein-4b",
        label: "FLUX.2 Klein 4B — édition avec image de référence",
        acceptsReference: true,
      },
      {
        id: "black-forest-labs/flux.1-schnell",
        label: "FLUX (alias FLUX.1 Schnell) — texte seul",
        acceptsReference: false,
      },
    ],
    horde: [
      { label: "Juggernaut XL v9", match: /^Juggernaut\s+XL\s+v?9$/i },
      { label: "RealVisXL V5", match: /^RealVisXL\s+V5(?:\.0)?$/i },
      { label: "Juggernaut XL (version non précisée)", match: /^Juggernaut\s+XL$/i },
      { label: "FLUX.2 [dev]", match: /^FLUX\.2[\s-]*\[?dev\]?$/i },
      { label: "FLUX.1 [dev]", match: /^FLUX\.1[\s-]*\[?dev\]?(?:\s+fp8)?$/i },
      { label: "RealVisXL V4", match: /^RealVisXL\s+V4(?:\.0)?$/i },
      { label: "FLUX.2 Klein 9B", match: /^FLUX\.2\s+Klein\s+9B$/i },
      { label: "FLUX.2 Klein 4B", match: /^FLUX\.2\s+Klein\s+4B$/i },
      { label: "Realistic Vision V6", match: /^Realistic\s+Vision\s+V6(?:\.0)?$/i },
      { label: "Realistic Vision (version non précisée)", match: /^Realistic\s+Vision$/i },
    ],
  };

  function cleanFluxText(value) {
    const seen = new Set();
    return String(value || "")
      .replace(/\(([^()]+):\d+(?:\.\d+)?\)/g, "$1")
      .replace(/[()]/g, "")
      .split(/[,;\n]+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((part) => part && !/^(?:NOT|NO)\b/i.test(part))
      .filter((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(", ");
  }

  function buildFluxPrompt(scene, identity, morphology, options) {
    const duo = Boolean(options && options.isDuo);
    const id = cleanFluxText(identity).slice(0, 420);
    const body = cleanFluxText(morphology).slice(0, 240);
    const setting = cleanFluxText(scene).slice(0, 2300);
    return [
      duo
        ? "Photorealistic editorial photograph of exactly two distinct adult women in one shared scene."
        : "Photorealistic editorial photograph of one adult woman.",
      id ? "Character identity; preserve these traits: " + id + "." : "",
      body ? "Authoritative body morphology; match this exactly: " + body + "." : "",
      duo
        ? "Keep LEFT and RIGHT identities, ages, hair and body morphologies separate; do not merge, average, swap or omit either woman."
        : "",
      "Follow the selected scene, action, pose, wardrobe, location and props; do not replace them with a generic studio portrait.",
      setting ? "Scene: " + setting + "." : "",
      "Natural anatomy, realistic skin and fabric, coherent lighting, sharp focus on the subject.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, duo ? 3600 : 3200);
  }

  root.LeaImageProviderModels = {
    catalog,
    cleanFluxText,
    buildFluxPrompt,
  };
})(window);
