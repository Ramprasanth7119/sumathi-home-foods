/* =====================================================================
   DELIVERY RULES + PINCODE CHECKER
   Pure pricing logic lives in `quote()` so it can move unchanged into a
   Next.js server action / API route later.
   ===================================================================== */
(function () {
  const SHF = window.SHF;
  const { money, escapeHTML, icon, store, $ } = SHF.utils;
  const D = SHF.config.delivery;
  const KEY = SHF.config.storageKeys.customer;

  const isPincode = (v) => /^\d{6}$/.test(String(v).trim());
  const findZone = (pin) => D.zones.find((z) => z.pincodes.includes(String(pin).trim())) || null;

  /**
   * Delivery quote for a given (post-discount) subtotal and optional pincode.
   * status: "unknown"  – no pincode yet (default charge shown as an estimate)
   *         "invalid"  – not a 6-digit pincode
   *         "outside"  – pincode not served
   *         "free"     – served, free-delivery threshold met
   *         "paid"     – served, delivery charge applies
   */
  function quote(subtotal, pincode) {
    const belowMin = subtotal > 0 && subtotal < D.minOrder;
    const base = { belowMin, minOrder: D.minOrder, shortOfMin: Math.max(0, D.minOrder - subtotal) };

    if (!pincode) {
      const free = subtotal >= D.defaultFreeAbove;
      return { ...base, status: "unknown", zone: null, charge: free ? 0 : D.defaultCharge, freeAbove: D.defaultFreeAbove, toFree: Math.max(0, D.defaultFreeAbove - subtotal), estimate: true };
    }
    if (!isPincode(pincode)) return { ...base, status: "invalid", zone: null, charge: 0 };
    const zone = findZone(pincode);
    if (!zone) return { ...base, status: "outside", zone: null, charge: 0 };
    const free = subtotal >= zone.freeAbove;
    return { ...base, status: free ? "free" : "paid", zone, charge: free ? 0 : zone.charge, freeAbove: zone.freeAbove, toFree: Math.max(0, zone.freeAbove - subtotal), estimate: false };
  }

  const getPincode = () => (store.get(KEY, {}).pincode || "");
  function setPincode(pin) {
    const c = store.get(KEY, {});
    c.pincode = pin;
    store.set(KEY, c);
    document.dispatchEvent(new CustomEvent("shf:pincode", { detail: pin }));
  }

  /* Message shown by the checker in the delivery section. */
  function describe(pin, subtotal) {
    if (!isPincode(pin)) return { type: "error", html: `${icon("alert")}<div><b>Please enter a valid 6-digit pincode.</b></div>` };
    const zone = findZone(pin);
    if (!zone) {
      return {
        type: "error",
        html: `${icon("alert")}<div><b>Currently Outside Our Delivery Area</b><span>We don't deliver to ${escapeHTML(pin)} yet. Message us on WhatsApp — for bigger orders we may be able to arrange something.</span></div>`,
      };
    }
    const q = quote(subtotal, pin);
    if (q.status === "free") {
      return { type: "success", html: `${icon("check")}<div><b>Free Delivery Available</b><span>${escapeHTML(zone.name)} · ${escapeHTML(zone.eta)}. Your current cart qualifies for free delivery.</span></div>` };
    }
    return {
      type: "success",
      html: `${icon("check")}<div><b>Delivery Available</b><span>${escapeHTML(zone.name)} · ${escapeHTML(zone.eta)}. Delivery ${money(zone.charge)}, <strong>free on orders above ${money(zone.freeAbove)}</strong>${subtotal > 0 ? ` — add ${money(q.toFree)} more to qualify` : ""}.</span></div>`,
    };
  }

  function renderSection() {
    const list = $("#zoneList");
    if (list) {
      list.innerHTML = D.zones
        .map(
          (z) => `<li class="zone">
            <div class="zone-top"><b>${escapeHTML(z.name)}</b><span class="zone-eta">${icon("clock")}${escapeHTML(z.eta)}</span></div>
            <p class="zone-desc">${escapeHTML(z.description)}</p>
            <p class="zone-areas">${z.areas.map(escapeHTML).join(" · ")}</p>
            <div class="zone-price"><span>Delivery ${money(z.charge)}</span><span class="zone-free">Free above ${money(z.freeAbove)}</span></div>
          </li>`
        )
        .join("");
    }
    const rules = $("#deliveryRules");
    if (rules) {
      const minFree = Math.min(...D.zones.map((z) => z.freeAbove));
      const minCharge = Math.min(...D.zones.map((z) => z.charge));
      rules.innerHTML = `
        <div class="rule">${icon("tag")}<div><b>${money(minFree)}+</b><span>Free delivery starts from (nearby areas)</span></div></div>
        <div class="rule">${icon("truck")}<div><b>From ${money(minCharge)}</b><span>Delivery on smaller orders</span></div></div>
        <div class="rule">${icon("package")}<div><b>${money(D.minOrder)}</b><span>Minimum order value</span></div></div>`;
    }

    const form = $("#pincodeForm");
    const input = $("#pincodeInput");
    const out = $("#pincodeResult");
    if (!form) return;
    input.value = getPincode();
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = input.value.trim();
      const r = describe(pin, SHF.cart ? SHF.cart.totals().net : 0);
      out.className = `pincode-result is-${r.type}`;
      out.innerHTML = r.html;
      input.setAttribute("aria-invalid", r.type === "error" && !isPincode(pin) ? "true" : "false");
      if (isPincode(pin)) setPincode(pin);
    });
  }

  SHF.delivery = { quote, findZone, isPincode, getPincode, setPincode, describe, renderSection };
})();
