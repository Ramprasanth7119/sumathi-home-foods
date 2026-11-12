/* =====================================================================
   Shared helpers: formatting, safe storage, DOM, dialogs, toasts, WhatsApp.
   Next.js migration: becomes `lib/utils.js` (pure functions) +
   small hooks/components for toasts and dialogs.
   ===================================================================== */
(function () {
  const SHF = (window.SHF = window.SHF || {});
  const cfg = SHF.config;

  const money = (n) =>
    cfg.currency.symbol +
    Math.round(n).toLocaleString(cfg.currency.locale, { maximumFractionDigits: 0 });

  const escapeHTML = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const icon = (name, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* Responsive <picture> for an image base path (see products.js). */
  function picture(base, alt, { sizes = "(max-width: 600px) 92vw, 360px", lazy = true, w = 960, h = 960, cls = "" } = {}) {
    const load = lazy ? 'loading="lazy" decoding="async"' : 'decoding="async"';
    return `<picture class="${cls}">
      <source type="image/webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w" sizes="${sizes}">
      <img src="${base}-960.jpg" srcset="${base}-480.jpg 480w, ${base}-960.jpg 960w" sizes="${sizes}"
           alt="${escapeHTML(alt)}" width="${w}" height="${h}" ${load}>
    </picture>`;
  }

  /* localStorage can throw (private mode, blocked storage) — never let it break the page. */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable — state lives for this visit only */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Dialogs (native <dialog>: focus trap + Esc for free) ---------- */
  let lastFocus = null;
  function openDialog(dlg) {
    if (!dlg || dlg.open) return;
    lastFocus = document.activeElement;
    dlg.showModal();
    document.documentElement.classList.add("has-modal");
  }
  function closeDialog(dlg) {
    if (!dlg || !dlg.open) return;
    dlg.classList.add("is-closing");
    const done = () => {
      dlg.classList.remove("is-closing");
      dlg.close();
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reduce ? done() : setTimeout(done, 180);
  }
  function wireDialog(dlg) {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close]")) closeDialog(dlg);
    });
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDialog(dlg);
    });
    dlg.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("has-modal");
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    });
  }

  /* ---------- Toasts ---------- */
  function toast(message, { type = "success", action } = {}) {
    const region = $("#toastRegion");
    if (!region) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    const ic = type === "error" ? "alert" : type === "info" ? "info" : "check";
    el.innerHTML = `${icon(ic)}<span>${escapeHTML(message)}</span>`;
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "toast-action";
      b.textContent = action.label;
      b.addEventListener("click", () => {
        action.onClick();
        dismiss();
      });
      el.appendChild(b);
    }
    region.appendChild(el);
    // Popover = top layer, so toasts stay visible above open dialogs.
    if (region.showPopover) {
      try { if (region.matches(":popover-open")) region.hidePopover(); region.showPopover(); } catch {}
    }
    while (region.children.length > 3) region.firstElementChild.remove();
    const t = setTimeout(dismiss, 3800);
    function dismiss() {
      clearTimeout(t);
      el.classList.add("toast-out");
      setTimeout(() => {
        el.remove();
        if (!region.children.length && region.hidePopover) try { region.hidePopover(); } catch {}
      }, 250);
    }
  }

  /* ---------- WhatsApp ---------- */
  function waUrl(text) {
    const n = String(cfg.business.whatsappNumber).replace(/\D/g, "");
    return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  }
  function openWhatsApp(text) {
    if (cfg.business.whatsappIsPlaceholder) {
      toast("Demo mode: the WhatsApp number is a placeholder — set it in js/config.js.", { type: "info" });
    }
    const win = window.open(waUrl(text), "_blank", "noopener");
    if (!win) window.location.href = waUrl(text); // popup blocked → same tab
  }

  /* ---------- Validation ---------- */
  const normalizePhone = (v) => {
    let d = String(v).replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    return d;
  };
  const isValidPhone = (v) => /^[6-9]\d{9}$/.test(normalizePhone(v));

  function setFieldError(input, message) {
    const err = document.getElementById(`${input.id}-err`);
    if (message) {
      input.setAttribute("aria-invalid", "true");
      if (err) {
        err.textContent = message;
        input.setAttribute("aria-describedby", err.id);
      }
    } else {
      input.removeAttribute("aria-invalid");
      if (err) err.textContent = "";
    }
  }

  /* Dates as local YYYY-MM-DD (input[type=date] format). */
  function isoDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function prettyDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

  SHF.utils = {
    money, escapeHTML, icon, picture, store, $, $$,
    openDialog, closeDialog, wireDialog, toast,
    waUrl, openWhatsApp, normalizePhone, isValidPhone, setFieldError,
    isoDate, prettyDate, getPath,
  };
})();
