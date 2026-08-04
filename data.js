(function () {
  "use strict";

  const API_URL = "/api/rsvps";

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Não foi possível concluir a solicitação.");
      error.code = payload?.error?.code || "REQUEST_FAILED";
      throw error;
    }

    return payload;
  }

  async function load() {
    const payload = await request(API_URL);
    return Array.isArray(payload?.items) ? payload.items : [];
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

  async function upsert(payload) {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanText(payload.name),
        attendance: payload.attendance,
        phone: cleanText(payload.phone),
        companions: parseCompanions(payload.companions),
        dietary: cleanText(payload.dietary),
        message: cleanText(payload.message),
      }),
    });
    window.dispatchEvent(new CustomEvent("gabriele:rsvps-changed"));
    return result;
  }

  async function remove(id) {
    const result = await request(`${API_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    window.dispatchEvent(new CustomEvent("gabriele:rsvps-changed"));
    return result;
  }

  async function clear() {
    const result = await request(API_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "REMOVER_TODAS" }),
    });
    window.dispatchEvent(new CustomEvent("gabriele:rsvps-changed"));
    return result;
  }

  function getPersonCount(item) {
    if (item.attendance !== "sim") return 0;
    return 1 + (Array.isArray(item.companions) ? item.companions.length : 0);
  }

  window.GabrieleRSVP = {
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
