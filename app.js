(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const EVENT_DATE = new Date("2026-10-17T21:00:00-03:00");
  const form = document.querySelector("[data-rsvp-form]");
  const success = document.querySelector("[data-rsvp-success]");
  const toast = document.querySelector("[data-toast]");

  function setupArtDialog() {
    const openButton = document.querySelector("[data-art-open]");
    const dialog = document.querySelector("[data-art-dialog]");
    const closeButton = dialog?.querySelector("[data-art-close]");
    const zoomButton = dialog?.querySelector("[data-art-zoom]");
    const scrollArea = dialog?.querySelector("[data-art-scroll]");
    const dialogImage = dialog?.querySelector(".art-dialog-image");
    if (!openButton || !dialog || !closeButton || !zoomButton || !scrollArea || !dialogImage) return;

    function setZoom(zoomed) {
      dialog.classList.toggle("is-zoomed", zoomed);
      zoomButton.setAttribute("aria-pressed", String(zoomed));
      zoomButton.textContent = zoomed ? "Ajustar à tela" : "Ampliar 2×";
      scrollArea.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    function closeDialog() {
      dialog.close();
    }

    openButton.addEventListener("click", () => {
      if (typeof dialog.showModal !== "function") {
        window.open(openButton.querySelector("img").src, "_blank", "noopener");
        return;
      }
      if (!dialogImage.hasAttribute("src")) dialogImage.src = dialogImage.dataset.src;
      setZoom(false);
      dialog.showModal();
    });
    closeButton.addEventListener("click", closeDialog);
    zoomButton.addEventListener("click", () => setZoom(!dialog.classList.contains("is-zoomed")));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", () => setZoom(false));
  }

  function updateHeader() {
    document.querySelector("[data-header]")?.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  function startCountdown() {
    const root = document.querySelector("[data-countdown]");
    if (!root) return;

    const fields = {
      days: root.querySelector("[data-days]"),
      hours: root.querySelector("[data-hours]"),
      minutes: root.querySelector("[data-minutes]"),
      seconds: root.querySelector("[data-seconds]"),
    };

    function tick() {
      const remaining = Math.max(0, EVENT_DATE.getTime() - Date.now());
      const days = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining / 3600000) % 24);
      const minutes = Math.floor((remaining / 60000) % 60);
      const seconds = Math.floor((remaining / 1000) % 60);

      fields.days.textContent = String(days).padStart(2, "0");
      fields.hours.textContent = String(hours).padStart(2, "0");
      fields.minutes.textContent = String(minutes).padStart(2, "0");
      fields.seconds.textContent = String(seconds).padStart(2, "0");
    }

    let timer = null;

    function syncTimer() {
      if (document.hidden) {
        window.clearInterval(timer);
        timer = null;
        return;
      }
      tick();
      if (!timer) timer = window.setInterval(tick, 1000);
    }

    document.addEventListener("visibilitychange", syncTimer);
    syncTimer();
  }

  function setupReveals() {
    const elements = document.querySelectorAll(".reveal");
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px" },
    );

    elements.forEach((element) => observer.observe(element));
  }

  function setupAttendanceToggle() {
    const radios = form?.querySelectorAll('input[name="attendance"]');
    if (!radios) return;

    function update() {
      const attending = form.elements.attendance.value === "sim";
      const answered = Boolean(form.elements.attendance.value);
      const error = form.querySelector('[data-error-for="attendance"]');
      radios.forEach((radio) => radio.setAttribute("aria-invalid", "false"));
      if (answered) error.textContent = "";
      form.querySelectorAll(".attending-only").forEach((element) => {
        element.classList.toggle("is-hidden", !attending);
        element.setAttribute("aria-hidden", String(!attending));
        element.inert = !attending;
        element.querySelectorAll("input, textarea").forEach((field) => {
          field.disabled = !attending;
        });
      });
    }

    radios.forEach((radio) => radio.addEventListener("change", update));
    update();
  }

  function formatPhone(event) {
    const input = event.currentTarget;
    let digits = input.value.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    let output = digits;

    if (digits.length > 2) output = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) output = `${output.slice(0, -4)}-${output.slice(-4)}`;
    input.value = output;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function validateForm() {
    const attendance = form.elements.attendance.value;
    const attendanceError = form.querySelector('[data-error-for="attendance"]');
    const attendanceValid = attendance === "sim" || attendance === "nao";
    const name = form.elements.name;
    const error = form.querySelector('[data-error-for="name"]');
    const value = window.GabrieleRSVP.cleanText(name.value);
    const valid = value.length >= 3 && value.includes(" ");

    name.classList.toggle("has-error", !valid);
    name.setAttribute("aria-invalid", String(!valid));
    form.querySelectorAll('input[name="attendance"]').forEach((radio) => {
      radio.setAttribute("aria-invalid", String(!attendanceValid));
    });
    attendanceError.textContent = attendanceValid ? "" : "Escolha uma das opções para continuar.";
    error.textContent = valid ? "" : "Digite seu nome e sobrenome para continuar.";
    if (!attendanceValid) form.querySelector('input[name="attendance"]').focus();
    else if (!valid) name.focus();
    return attendanceValid && valid;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.classList.add("is-loading");
    submit.setAttribute("aria-busy", "true");

    const data = new FormData(form);
    let result;

    try {
      result = window.GabrieleRSVP.upsert({
        name: data.get("name"),
        attendance: data.get("attendance"),
        phone: data.get("phone"),
        companions: data.get("companions"),
        dietary: data.get("dietary"),
        message: data.get("message"),
      });
      form.querySelector("[data-form-status]").textContent = "";
    } catch (error) {
      console.error("Não foi possível salvar a resposta.", error);
      form.querySelector("[data-form-status]").textContent =
        "Não foi possível salvar neste navegador. Verifique as permissões e tente novamente.";
      submit.disabled = false;
      submit.classList.remove("is-loading");
      submit.removeAttribute("aria-busy");
      showToast("Não foi possível salvar sua resposta.");
      return;
    }

    const attending = result.response.attendance === "sim";
    success.querySelector("[data-success-title]").textContent = attending
      ? "Presença confirmada."
      : "Resposta registrada.";
    success.querySelector("[data-success-copy]").textContent = attending
      ? "Agora é só contar os dias. Esperamos você para essa noite inesquecível."
      : "Sentiremos sua falta. Obrigada por nos avisar.";
    form.hidden = true;
    success.hidden = false;
    success.focus();
    submit.disabled = false;
    submit.classList.remove("is-loading");
    submit.removeAttribute("aria-busy");
    showToast(result.updated ? "Sua resposta foi atualizada." : "Sua resposta foi salva.");
  }

  function setupMobileBar() {
    const bar = document.querySelector("[data-mobile-rsvp]");
    const rsvp = document.querySelector("#confirmar");
    const footer = document.querySelector(".site-footer");
    const primaryAction = document.querySelector(".hero-actions");
    if (!bar || !rsvp || !footer || !primaryAction || !("IntersectionObserver" in window)) return;

    const visibleSections = new Set();
    let primaryActionVisible = true;

    function setBarHidden(hidden) {
      bar.classList.toggle("is-hidden", hidden);
      bar.setAttribute("aria-hidden", String(hidden));
      bar.inert = hidden;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === primaryAction) {
            primaryActionVisible = entry.isIntersecting;
          } else if (entry.isIntersecting) visibleSections.add(entry.target);
          else visibleSections.delete(entry.target);
        });
        setBarHidden(primaryActionVisible || visibleSections.size > 0);
      },
      { threshold: 0.1 },
    );
    observer.observe(rsvp);
    observer.observe(footer);
    observer.observe(primaryAction);
  }

  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  startCountdown();
  setupReveals();
  setupArtDialog();
  setupAttendanceToggle();
  setupMobileBar();

  form?.addEventListener("submit", handleSubmit);
  form?.elements.phone?.addEventListener("blur", formatPhone);
  form?.elements.name?.addEventListener("input", () => {
    form.elements.name.classList.remove("has-error");
    form.elements.name.setAttribute("aria-invalid", "false");
    form.querySelector('[data-error-for="name"]').textContent = "";
  });
  document.querySelector("[data-edit-response]")?.addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
})();
