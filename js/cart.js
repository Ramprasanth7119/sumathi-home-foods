/* =====================================================================
   CART — state, persistence (localStorage), totals and the cart drawer.
   The cart stores only { id, size, qty }; names and prices are always
   looked up from products.js so a price change never leaves stale prices
   in a customer's saved cart.
   Next.js migration: state → a React context / Zustand store; `totals()`
   is pure and can be reused on the server to re-price orders.
   ===================================================================== */
(function () {
  const SHF = window.SHF;
  const U = SHF.utils;
  const { money, escapeHTML, icon, store, $ } = U;
  const KEYS = SHF.config.storageKeys;
  const DISC = SHF.config.discounts;
  const MAX_QTY = 50;

  const byId = (id) => SHF.products.find((p) => p.id === id);
  const packOf = (p, size) => p && p.packs.find((k) => k.size === size);
  const keyOf = (id, size) => `${id}__${size}`;

  /* ---------- state ---------- */
  let lines = sanitize(store.get(KEYS.cart, []));
  let discountCode = store.get(KEYS.discount, "") || "";
  const listeners = new Set();

  function sanitize(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((l) => l && packOf(byId(l.id), l.size) && byId(l.id).available)
      .map((l) => ({ id: l.id, size: l.size, qty: Math.min(MAX_QTY, Math.max(1, parseInt(l.qty, 10) || 1)) }));
  }

  function commit() {
    store.set(KEYS.cart, lines);
    store.set(KEYS.discount, discountCode);
    listeners.forEach((fn) => fn());
  }

  /* ---------- mutations ---------- */
  function add(id, size, qty = 1) {
    const p = byId(id);
    if (!p || !p.available || !packOf(p, size)) return false;
    const existing = lines.find((l) => l.id === id && l.size === size);
    if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + qty);
    else lines.push({ id, size, qty: Math.min(MAX_QTY, qty) });
    commit();
    return true;
  }
  function setQty(key, qty) {
    const l = lines.find((x) => keyOf(x.id, x.size) === key);
    if (!l) return;
    if (qty <= 0) return remove(key);
    l.qty = Math.min(MAX_QTY, qty);
    commit();
  }
  function changeSize(key, newSize) {
    const l = lines.find((x) => keyOf(x.id, x.size) === key);
    if (!l || l.size === newSize) return;
    const target = lines.find((x) => x.id === l.id && x.size === newSize);
    if (target) {
      target.qty = Math.min(MAX_QTY, target.qty + l.qty);
      lines = lines.filter((x) => x !== l);
    } else l.size = newSize;
    commit();
  }
  function remove(key) {
    const idx = lines.findIndex((x) => keyOf(x.id, x.size) === key);
    if (idx < 0) return;
    const [removed] = lines.splice(idx, 1);
    commit();
    const p = byId(removed.id);
    U.toast(`${p.name} (${removed.size}) removed`, {
      type: "info",
      action: { label: "Undo", onClick: () => { lines.splice(idx, 0, removed); commit(); } },
    });
  }
  function clear() {
    lines = [];
    discountCode = "";
    commit();
  }

  /* ---------- discounts (DEMO codes from config) ---------- */
  function evaluateCode(code, subtotal) {
    if (!DISC.enabled || !code) return { ok: false, amount: 0 };
    const rule = DISC.codes[code.toUpperCase()];
    if (!rule) return { ok: false, amount: 0, reason: "This code isn't valid." };
    if (subtotal < rule.minSubtotal) return { ok: false, amount: 0, reason: `Add items worth ${money(rule.minSubtotal - subtotal)} more to use ${code.toUpperCase()}.`, pending: true };
    const amount = rule.type === "percent" ? Math.round((subtotal * rule.value) / 100) : Math.min(rule.value, subtotal);
    return { ok: true, amount, label: rule.label, code: code.toUpperCase() };
  }
  function applyCode(code) {
    const c = String(code || "").trim().toUpperCase();
    const r = evaluateCode(c, totals().subtotal);
    if (r.ok || r.pending) {
      discountCode = c;
      commit();
    }
    return r;
  }
  function removeCode() {
    discountCode = "";
    commit();
  }

  /* ---------- derived ---------- */
  function items() {
    return lines.map((l) => {
      const p = byId(l.id);
      const pack = packOf(p, l.size);
      return { key: keyOf(l.id, l.size), product: p, size: l.size, qty: l.qty, unit: pack.price, total: pack.price * l.qty };
    });
  }
  const count = () => lines.reduce((s, l) => s + l.qty, 0);

  function totals(pincode = SHF.delivery.getPincode()) {
    const subtotal = items().reduce((s, i) => s + i.total, 0);
    const disc = evaluateCode(discountCode, subtotal);
    const discount = disc.ok ? disc.amount : 0;
    const net = subtotal - discount;
    const delivery = SHF.delivery.quote(net, pincode);
    const charge = delivery.status === "outside" || delivery.status === "invalid" ? 0 : delivery.charge;
    return { subtotal, discount, discountInfo: disc, discountCode, net, delivery, charge, total: subtotal ? net + charge : 0 };
  }

  /* ---------- drawer UI ---------- */
  const drawer = () => $("#cartDrawer");

  function renderBadge() {
    const n = count();
    const badge = $("#cartCount");
    badge.textContent = n > 99 ? "99+" : n;
    badge.classList.toggle("is-empty", n === 0);
    $("#cartOpen").setAttribute("aria-label", `Open cart, ${n} item${n === 1 ? "" : "s"}`);
    const bar = $("#mobileCartBar");
    if (bar) {
      bar.hidden = n === 0;
      $("#mcbCount").textContent = `${n} item${n === 1 ? "" : "s"}`;
      $("#mcbTotal").textContent = money(totals().net);
    }
  }
  function bump() {
    const b = $("#cartOpen");
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
  }

  function deliveryBlock(t) {
    const d = t.delivery;
    const pin = SHF.delivery.getPincode();
    let status = "";
    if (d.status === "unknown") status = `<p class="cd-status">${icon("info")}Enter your pincode for the exact delivery charge.</p>`;
    else if (d.status === "outside") status = `<p class="cd-status is-error">${icon("alert")}${escapeHTML(pin)} is currently outside our delivery area.</p>`;
    else if (d.status === "free") status = `<p class="cd-status is-ok">${icon("check")}Free delivery to ${escapeHTML(pin)} · ${escapeHTML(d.zone.eta)}</p>`;
    else if (d.status === "paid") status = `<p class="cd-status is-ok">${icon("truck")}Delivers to ${escapeHTML(pin)} · ${escapeHTML(d.zone.eta)}</p>`;

    let progress = "";
    if ((d.status === "paid" || d.status === "unknown") && d.toFree > 0) {
      const pct = Math.min(100, Math.round((t.net / d.freeAbove) * 100));
      progress = `<div class="free-meter" role="img" aria-label="${pct}% of the way to free delivery">
          <div class="free-bar"><span style="width:${pct}%"></span></div>
          <p>Add <b>${money(d.toFree)}</b> more for free delivery${d.status === "unknown" ? " (in most nearby areas)" : ""}.</p>
        </div>`;
    } else if (d.status === "free" || (d.status === "unknown" && d.charge === 0)) {
      progress = `<div class="free-meter is-done"><div class="free-bar"><span style="width:100%"></span></div><p>${icon("check")}You've unlocked free delivery${d.status === "unknown" ? " — confirm with your pincode" : ""}.</p></div>`;
    }

    return `<form class="cart-pin" id="cartPinForm" novalidate>
        <label for="cartPin">Delivery pincode</label>
        <div class="cart-pin-row">
          <input id="cartPin" inputmode="numeric" maxlength="6" placeholder="6-digit pincode" value="${escapeHTML(pin)}" autocomplete="postal-code" />
          <button type="submit" class="btn btn-ghost btn-sm">Check</button>
        </div>
        ${status}
      </form>${progress}`;
  }

  function discountBlock(t) {
    if (!DISC.enabled) return "";
    if (t.discountCode) {
      const i = t.discountInfo;
      return `<div class="promo-applied ${i.ok ? "" : "is-pending"}">
          ${icon("tag")}<span><b>${escapeHTML(t.discountCode)}</b> ${i.ok ? escapeHTML(i.label) : escapeHTML(i.reason || "")}</span>
          <button type="button" class="link-btn" id="promoRemove">Remove</button></div>`;
    }
    return `<details class="promo">
        <summary>Have a discount code?</summary>
        <form class="promo-form" id="promoForm" novalidate>
          <label for="promoInput" class="sr-only">Discount code</label>
          <input id="promoInput" placeholder="Enter code" autocomplete="off" autocapitalize="characters" />
          <button type="submit" class="btn btn-ghost btn-sm">Apply</button>
        </form>
        <p class="promo-hint">Demo codes for testing: WELCOME10, FESTIVE50</p>
      </details>`;
  }

  function render() {
    renderBadge();
    const content = $("#cartContent");
    const foot = $("#cartFoot");
    if (!content) return;
    const list = items();

    if (!list.length) {
      content.innerHTML = `<div class="cart-empty">
          <div class="cart-empty-art">${icon("bag")}</div>
          <h3>Your cart is empty</h3>
          <p>Fresh murukku, laddu and more are waiting for you.</p>
          <button type="button" class="btn btn-primary" data-goto="#foods">Browse our foods</button>
        </div>`;
      foot.innerHTML = "";
      foot.hidden = true;
      return;
    }

    const t = totals();
    content.innerHTML = `<ul class="cart-lines">${list
      .map(
        (i) => `<li class="cart-line" data-key="${i.key}">
          <div class="cl-img">${U.picture(i.product.image, i.product.alt, { sizes: "72px", w: 480, h: 480 })}</div>
          <div class="cl-main">
            <div class="cl-top"><h3>${escapeHTML(i.product.name)}</h3>
              <button type="button" class="icon-btn icon-btn-sm" data-remove aria-label="Remove ${escapeHTML(i.product.name)} ${i.size}">${icon("trash")}</button></div>
            <div class="cl-controls">
              <label class="select-field select-sm"><span class="sr-only">Pack size for ${escapeHTML(i.product.name)}</span>
                <select data-size>${i.product.packs.map((k) => `<option value="${k.size}" ${k.size === i.size ? "selected" : ""}>${k.size} · ${money(k.price)}</option>`).join("")}</select>${icon("chevron")}</label>
              <div class="stepper stepper-sm" role="group" aria-label="Quantity for ${escapeHTML(i.product.name)} ${i.size}">
                <button type="button" data-step="-1" aria-label="Decrease quantity">${icon("minus")}</button>
                <output aria-live="polite">${i.qty}</output>
                <button type="button" data-step="1" aria-label="Increase quantity" ${i.qty >= MAX_QTY ? "disabled" : ""}>${icon("plus")}</button>
              </div>
            </div>
            <p class="cl-price"><span>${money(i.unit)} × ${i.qty}</span><b>${money(i.total)}</b></p>
          </div>
        </li>`
      )
      .join("")}</ul>
      ${deliveryBlock(t)}
      ${discountBlock(t)}`;

    const d = t.delivery;
    const deliveryLabel =
      d.status === "outside" || d.status === "invalid" ? "—" : t.charge === 0 ? '<span class="free">Free</span>' : money(t.charge) + (d.estimate ? "*" : "");
    const blocked = d.belowMin || d.status === "outside";
    foot.hidden = false;
    foot.innerHTML = `<dl class="summary">
        <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
        ${t.discount ? `<div class="discount"><dt>Discount (${escapeHTML(t.discountCode)})</dt><dd>− ${money(t.discount)}</dd></div>` : ""}
        <div><dt>Delivery</dt><dd>${deliveryLabel}</dd></div>
        <div class="total"><dt>Total</dt><dd>${money(t.total)}</dd></div>
      </dl>
      ${d.estimate ? '<p class="summary-note">* Estimated — exact charge depends on your pincode.</p>' : ""}
      ${d.belowMin ? `<p class="summary-warn">${icon("info")}Minimum order is ${money(d.minOrder)}. Add ${money(d.shortOfMin)} more to check out.</p>` : ""}
      <button type="button" class="btn btn-primary btn-block btn-lg" id="checkoutBtn" ${blocked ? "disabled" : ""}>
        Proceed to Checkout ${icon("arrow")}</button>
      <p class="summary-note center">You'll review everything before sending it on WhatsApp.</p>`;
  }

  function wireDrawer() {
    const dlg = drawer();
    U.wireDialog(dlg);
    $("#cartOpen").addEventListener("click", () => U.openDialog(dlg));
    $("#mobileCartBar").addEventListener("click", () => U.openDialog(dlg));

    dlg.addEventListener("click", (e) => {
      const line = e.target.closest(".cart-line");
      const key = line && line.dataset.key;
      const step = e.target.closest("[data-step]");
      if (step && key) {
        const l = items().find((i) => i.key === key);
        setQty(key, l.qty + Number(step.dataset.step));
        focusAfterRender(`[data-key="${key}"] [data-step="${step.dataset.step}"]`);
        return;
      }
      if (e.target.closest("[data-remove]") && key) return remove(key);
      if (e.target.closest("#promoRemove")) return removeCode();
      const go = e.target.closest("[data-goto]");
      if (go) {
        U.closeDialog(dlg);
        setTimeout(() => $(go.dataset.goto).scrollIntoView({ behavior: "smooth" }), 200);
      }
      if (e.target.closest("#checkoutBtn")) SHF.checkout.open();
    });
    dlg.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-size]");
      if (sel) changeSize(sel.closest(".cart-line").dataset.key, sel.value);
    });
    dlg.addEventListener("input", (e) => {
      if (e.target.id === "cartPin") e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });
    dlg.addEventListener("submit", (e) => {
      e.preventDefault();
      if (e.target.id === "cartPinForm") {
        const v = $("#cartPin").value.trim();
        if (!SHF.delivery.isPincode(v)) return U.toast("Please enter a valid 6-digit pincode.", { type: "error" });
        SHF.delivery.setPincode(v);
        focusAfterRender("#cartPin");
      }
      if (e.target.id === "promoForm") {
        const r = applyCode($("#promoInput").value);
        if (r.ok) U.toast(`Code applied: ${r.label}`);
        else U.toast(r.reason || "Please enter a code.", { type: r.pending ? "info" : "error" });
      }
    });
  }

  /* Re-rendering replaces nodes; restore keyboard focus to the equivalent control. */
  function focusAfterRender(sel) {
    requestAnimationFrame(() => {
      const el = drawer().querySelector(sel);
      if (el && !el.disabled) el.focus();
    });
  }

  function init() {
    wireDrawer();
    listeners.add(render);
    document.addEventListener("shf:pincode", render);
    // keep tabs in sync
    window.addEventListener("storage", (e) => {
      if (e.key === KEYS.cart || e.key === KEYS.discount) {
        lines = sanitize(store.get(KEYS.cart, []));
        discountCode = store.get(KEYS.discount, "") || "";
        listeners.forEach((fn) => fn());
      }
    });
    render();
  }

  SHF.cart = { init, add, setQty, remove, clear, items, count, totals, applyCode, removeCode, subscribe: (fn) => listeners.add(fn), open: () => U.openDialog(drawer()), bump, MAX_QTY };
})();
