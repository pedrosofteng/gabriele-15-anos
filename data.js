(function () {
  "use strict";

  const STORAGE_KEY = "gabriele-xv-rsvps-v1";

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      console.warn("Não foi possível ler as confirmações salvas.", error);
      return [];
    }
  }

  function persist(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("gabriele:rsvps-changed"));
  }

  function parseCompanions(value) {
    const seen = new Set();

    return String(value || "")
      .split(/[\n,;]+/)
      .map(cleanText)
      .filter((name) => {
        const key = normalize(name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function upsert(payload) {
    const items = load();
    const now = new Date().toISOString();
    const name = cleanText(payload.name);
    const phone = cleanText(payload.phone);
    const existingIndex = items.findIndex((item) => {
      const samePhone = phone && cleanText(item.phone) === phone;
      return samePhone || normalize(item.name) === normalize(name);
    });

    const existing = existingIndex >= 0 ? items[existingIndex] : null;
    const response = {
      id: existing?.id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      name,
      attendance: payload.attendance === "nao" ? "nao" : "sim",
      phone,
      companions: payload.attendance === "nao" ? [] : parseCompanions(payload.companions),
      dietary: payload.attendance === "nao" ? "" : cleanText(payload.dietary),
      message: cleanText(payload.message),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) items.splice(existingIndex, 1, response);
    else items.unshift(response);

    persist(items);
    return { response, updated: existingIndex >= 0 };
  }

  function remove(id) {
    const items = load();
    persist(items.filter((item) => item.id !== id));
  }

  function clear() {
    persist([]);
  }

  function getPersonCount(item) {
    if (item.attendance !== "sim") return 0;
    return 1 + (Array.isArray(item.companions) ? item.companions.length : 0);
  }

  window.GabrieleRSVP = {
    key: STORAGE_KEY,
    load,
    upsert,
    remove,
    clear,
    normalize,
    cleanText,
    parseCompanions,
    getPersonCount,
  };
})();
