(function () {
  "use strict";

  const list = document.querySelector("[data-guest-list]");
  const emptyState = document.querySelector("[data-empty-state]");
  const tableWrap = document.querySelector("[data-table-wrap]");
  const search = document.querySelector("[data-search]");
  const filter = document.querySelector("[data-filter]");
  const exportButton = document.querySelector("[data-export]");
  const emptyInvite = document.querySelector("[data-empty-invite]");
  const emptyReset = document.querySelector("[data-empty-reset]");
  const toast = document.querySelector("[data-toast]");
  const modal = document.querySelector("[data-modal]");
  const clearButton = document.querySelector("[data-clear]");
  let allItems = [];
  let isLoading = true;
  let loadError = false;
  let pendingAction = null;
  let modalTrigger = null;

  function escapeHTML(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function getFilteredItems() {
    const query = window.GabrieleRSVP.normalize(search.value);
    const status = filter.value;

    return allItems.filter((item) => {
      const names = [item.name, ...(item.companions || [])].join(" ");
      const matchesQuery = !query || window.GabrieleRSVP.normalize(names).includes(query);
      const matchesStatus = status === "todos" || item.attendance === status;
      return matchesQuery && matchesStatus;
    });
  }

  function updateMetrics(items) {
    const yes = items.filter((item) => item.attendance === "sim");
    const no = items.filter((item) => item.attendance === "nao");
    const companions = yes.reduce((total, item) => total + (item.companions?.length || 0), 0);
    const people = yes.reduce((total, item) => total + window.GabrieleRSVP.getPersonCount(item), 0);

    document.querySelector("[data-metric-people]").textContent = people;
    document.querySelector("[data-metric-yes]").textContent = yes.length;
    document.querySelector("[data-metric-companions]").textContent = companions;
    document.querySelector("[data-metric-no]").textContent = no.length;
  }

  function render() {
    const items = getFilteredItems();
    updateMetrics(allItems);
    document.querySelector("[data-visible-count]").textContent = items.length;

    if (isLoading || loadError) {
      document.querySelector("[data-toolbar-summary]").textContent = isLoading
        ? "Carregando respostas..."
        : "Não foi possível atualizar a lista";
      emptyState.querySelector("[data-empty-title]").textContent = isLoading
        ? "Buscando as respostas da festa."
        : "Não foi possível carregar as respostas.";
      emptyState.querySelector("[data-empty-copy]").textContent = isLoading
        ? "Isso deve levar apenas alguns instantes."
        : "Verifique sua conexão e tente novamente.";
      emptyInvite.hidden = true;
      emptyReset.hidden = isLoading;
      emptyReset.textContent = "Tentar novamente";
      tableWrap.hidden = true;
      emptyState.hidden = false;
      exportButton.disabled = true;
      clearButton.disabled = true;
      return;
    }

    const isSearching = Boolean(search.value.trim() || filter.value !== "todos");
    document.querySelector("[data-toolbar-summary]").textContent = isSearching
      ? `${items.length} de ${allItems.length} respostas`
      : `${allItems.length} ${allItems.length === 1 ? "resposta no total" : "respostas no total"}`;
    exportButton.textContent = isSearching ? "Exportar filtradas" : "Exportar CSV";
    emptyState.querySelector("[data-empty-title]").textContent = isSearching
      ? "Nenhuma resposta encontrada."
      : "A lista está pronta para receber os primeiros nomes.";
    emptyState.querySelector("[data-empty-copy]").textContent = isSearching
      ? "Tente outro nome ou remova o filtro aplicado."
      : "As confirmações feitas pelo convite aparecerão aqui automaticamente.";
    emptyInvite.hidden = isSearching;
    emptyReset.hidden = !isSearching;
    emptyReset.textContent = "Limpar busca e filtros";
    exportButton.disabled = allItems.length === 0;
    clearButton.disabled = allItems.length === 0;

    tableWrap.hidden = items.length === 0;
    emptyState.hidden = items.length !== 0;

    list.innerHTML = items
      .map((item) => {
        const attending = item.attendance === "sim";
        const people = window.GabrieleRSVP.getPersonCount(item);
        const companions = item.companions || [];
        const status = `<span class="status status-${item.attendance}">${attending ? "Confirmado" : "Não irá"}</span>`;
        const phoneDigits = String(item.phone || "").replace(/\D/g, "");
        const dialDigits = phoneDigits.startsWith("55") && phoneDigits.length >= 12 ? phoneDigits : `55${phoneDigits}`;
        const phoneLink = phoneDigits
          ? `<a class="guest-phone" href="tel:+${dialDigits}">${escapeHTML(item.phone)}</a>`
          : "—";
        const details = [
          companions.length ? `<span><b>Acompanhantes:</b> ${escapeHTML(companions.join(", "))}</span>` : "",
          item.dietary ? `<span><b>Restrição:</b> ${escapeHTML(item.dietary)}</span>` : "",
          item.message ? `<span><b>Mensagem:</b> ${escapeHTML(item.message)}</span>` : "",
        ]
          .filter(Boolean)
          .join("");

        return `
          <tr>
            <td data-label="Convidado">
              <div class="guest-name-row">
                <strong>${escapeHTML(item.name)}</strong>
                <span class="mobile-status" aria-hidden="true">${status}</span>
              </div>
              ${details ? `<details class="guest-details"><summary>Ver detalhes</summary><div class="guest-details-content">${details}</div></details>` : ""}
            </td>
            <td class="status-cell" data-label="Resposta">${status}</td>
            <td data-label="Pessoas"><strong>${attending ? people : "—"}</strong></td>
            <td data-label="Contato">${phoneLink}</td>
            <td data-label="Recebida em">${formatDate(item.updatedAt || item.createdAt)}</td>
            <td class="row-action">
              <button type="button" data-delete="${escapeHTML(item.id)}" aria-label="Remover resposta de ${escapeHTML(item.name)}">Remover</button>
            </td>
          </tr>`;
      })
      .join("");
  }

  async function refresh() {
    isLoading = true;
    loadError = false;
    render();
    try {
      allItems = await window.GabrieleRSVP.load();
    } catch (error) {
      console.error("Não foi possível carregar as respostas.", error);
      allItems = [];
      loadError = true;
    } finally {
      isLoading = false;
      render();
    }
  }

  function openModal(options) {
    modalTrigger = document.activeElement;
    pendingAction = options.action;
    modal.querySelector("[data-modal-title]").textContent = options.title;
    modal.querySelector("[data-modal-copy]").textContent = options.copy;
    modal.querySelector("[data-modal-confirm]").textContent = options.confirmLabel;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    document.querySelector(".dashboard-header").inert = true;
    document.querySelector(".dashboard-main").inert = true;
    modal.querySelector("[data-modal-cancel]").focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    document.querySelector(".dashboard-header").inert = false;
    document.querySelector(".dashboard-main").inert = false;
    pendingAction = null;
    if (modalTrigger?.isConnected) modalTrigger.focus();
    else search.focus();
    modalTrigger = null;
  }

  function exportCSV() {
    const items = getFilteredItems();
    if (!items.length) {
      showToast("Não há respostas para exportar.");
      return;
    }

    const cell = (value) => {
      let safeValue = String(value ?? "");
      if (/^[\t\r\n ]*[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["Nome", "Resposta", "Total de pessoas", "Acompanhantes", "WhatsApp", "Restrição alimentar", "Mensagem", "Data da resposta"],
      ...items.map((item) => [
        item.name,
        item.attendance === "sim" ? "Confirmado" : "Não irá",
        window.GabrieleRSVP.getPersonCount(item),
        (item.companions || []).join(", "),
        item.phone,
        item.dietary,
        item.message,
        formatDate(item.updatedAt || item.createdAt),
      ]),
    ];
    const csv = `\ufeff${rows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `convidados-gabriele-xv-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Lista exportada com sucesso.");
  }

  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  exportButton.addEventListener("click", exportCSV);
  emptyReset.addEventListener("click", () => {
    if (loadError) {
      refresh();
      return;
    }
    search.value = "";
    filter.value = "todos";
    render();
    search.focus();
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    const item = allItems.find((entry) => entry.id === button.dataset.delete);
    if (!item) return;
    const row = button.closest("tr");
    const adjacentButton = (row.nextElementSibling || row.previousElementSibling)?.querySelector("[data-delete]");
    const adjacentId = adjacentButton?.dataset.delete;
    openModal({
      title: `Remover ${item.name}?`,
      copy: "A confirmação e os acompanhantes ligados a ela serão removidos da lista compartilhada.",
      confirmLabel: "Remover resposta",
      action: async () => {
        await window.GabrieleRSVP.remove(item.id);
        allItems = allItems.filter((entry) => entry.id !== item.id);
        render();
        modalTrigger = adjacentId
          ? [...list.querySelectorAll("[data-delete]")].find((entry) => entry.dataset.delete === adjacentId) || search
          : search;
        showToast("Resposta removida.");
      },
    });
  });

  clearButton.addEventListener("click", () => {
    if (!allItems.length) {
      showToast("A lista já está vazia.");
      return;
    }
    openModal({
      title: "Tirar todas as respostas?",
      copy: "Todos os nomes serão removidos da lista compartilhada. Esta ação não pode ser desfeita.",
      confirmLabel: "Tirar todas",
      action: async () => {
        await window.GabrieleRSVP.clear();
        allItems = [];
        render();
        showToast("Todas as respostas foram removidas.");
      },
    });
  });

  modal.querySelector("[data-modal-cancel]").addEventListener("click", closeModal);
  modal.querySelector("[data-modal-confirm]").addEventListener("click", async () => {
    const confirmButton = modal.querySelector("[data-modal-confirm]");
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-busy", "true");
    try {
      await pendingAction?.();
    } catch (error) {
      console.error("Não foi possível concluir a ação.", error);
      showToast("Não foi possível alterar a lista compartilhada.");
    } finally {
      confirmButton.disabled = false;
      confirmButton.removeAttribute("aria-busy");
      closeModal();
    }
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") closeModal();
    if (event.key === "Tab") {
      const focusable = [...modal.querySelectorAll("button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("focus", () => {
    if (!isLoading && modal.hidden) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isLoading && modal.hidden) refresh();
  });

  refresh();
})();
