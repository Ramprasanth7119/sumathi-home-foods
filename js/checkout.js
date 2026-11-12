/* =====================================================================
   CHECKOUT — details → review → "sent to WhatsApp".
   An order is NOT confirmed when WhatsApp opens; the UI says so plainly.
   Next.js migration: `buildOrderMessage()` is pure; the steps become a
   client component, and an API route can store the order before
   redirecting to WhatsApp.
   ===================================================================== */
(function () {
  const SHF = window.SHF;
  const U = SHF.utils;
  const { money, escapeHTML, icon, store, $ } = U;
  const cfg = SHF.config;
  const KEY = cfg.storageKeys.customer;

  let step = "details";
  let data = {};
  let lastMessage = "";

  const dlg = () => $("#checkoutDialog");
  const body = () => $("#checkoutBody");

  function buildOrderMessage(d, items, t) {
    const lines = [
      `${cfg.business.name.toUpperCase()} - ORDER`,
      "",
      `Customer: ${d.name}`,
      `Phone: ${d.phone}`,
      `Delivery Address: ${d.address}${d.landmark ? ` (Landmark: ${d.landmark})` : ""}, ${d.pincode}`,
      "",
      "ORDER DETAILS:",
      ...items.map((i) => `- ${i.product.name} - ${i.size} x ${i.qty} = ${money(i.total)}`),
      "",
      `Subtotal: ${money(t.subtotal)}`,
    ];
    if (t.discount) lines.push(`Discount (${t.discountCode}): -${money(t.discount)}`);
    lines.push(`Delivery: ${t.charge === 0 ? "Free" : money(t.charge)}`);
    lines.push(`Total: ${money(t.total)}`);
    lines.push("");
    lines.push(`Preferred Delivery Date: ${U.prettyDate(d.date)}`);
    if (d.slot) lines.push(`Preferred Time: ${d.slot}`);
    if (d.notes) lines.push(`Notes: ${d.notes}`);
    lines.push("", "Please confirm my order.");
    return lines.join("\n");
  }

  function header(title, sub) {
    const steps = ["details", "review", "sent"];
    const idx = steps.indexOf(step);
    return `<header class="modal-head">
        <div>
          <ol class="steps" aria-label="Checkout progress">
            ${["Details", "Review", "Send"].map((s, i) => `<li class="${i < idx ? "done" : i === idx ? "current" : ""}" ${i === idx ? 'aria-current="step"' : ""}>${s}</li>`).join("")}
          </ol>
          <h2 id="coTitle">${title}</h2>
          ${sub ? `<p class="modal-sub">${sub}</p>` : ""}
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Close checkout">${icon("x")}</button>
      </header>`;
  }

  function miniSummary(t) {
    return `<aside class="co-mini" aria-label="Order summary">
        <ul>${SHF.cart.items().map((i) => `<li><span>${escapeHTML(i.product.name)} <small>${i.size} × ${i.qty}</small></span><b>${money(i.total)}</b></li>`).join("")}</ul>
        <dl class="summary summary-sm">
          <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
          ${t.discount ? `<div class="discount"><dt>Discount</dt><dd>− ${money(t.discount)}</dd></div>` : ""}
          <div><dt>Delivery</dt><dd id="coDelivery">${t.delivery.status === "outside" || t.delivery.status === "invalid" ? "—" : t.charge === 0 ? "Free" : money(t.charge)}</dd></div>
          <div class="total"><dt>Total</dt><dd id="coTotal">${money(t.total)}</dd></div>
        </dl>
      </aside>`;
  }

  function renderDetails() {
    const t = SHF.cart.totals(data.pincode);
    const minDate = U.isoDate(cfg.delivery.prepDays);
    body().innerHTML = `${header("Delivery details", "No account needed. We use these details only to deliver your order.")}
      <div class="co-grid">
        <form id="coForm" class="co-form" novalidate>
          <div class="field-grid">
            <div class="field"><label for="coName">Full name *</label><input id="coName" autocomplete="name" value="${escapeHTML(data.name || "")}" required /><p class="field-error" id="coName-err"></p></div>
            <div class="field"><label for="coPhone">Phone number *</label><input id="coPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10-digit mobile" value="${escapeHTML(data.phone || "")}" required /><p class="field-error" id="coPhone-err"></p></div>
            <div class="field field-full"><label for="coAddress">Delivery address *</label><textarea id="coAddress" rows="2" autocomplete="street-address" placeholder="House no., street, area" required>${escapeHTML(data.address || "")}</textarea><p class="field-error" id="coAddress-err"></p></div>
            <div class="field"><label for="coLandmark">Landmark</label><input id="coLandmark" value="${escapeHTML(data.landmark || "")}" placeholder="Optional" /></div>
            <div class="field"><label for="coPincode">Pincode *</label><input id="coPincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" value="${escapeHTML(data.pincode || "")}" required /><p class="field-error" id="coPincode-err"></p></div>
            <div class="field"><label for="coDate">Preferred delivery date *</label><input id="coDate" type="date" min="${minDate}" value="${escapeHTML(data.date && data.date >= minDate ? data.date : minDate)}" required /><p class="field-error" id="coDate-err"></p></div>
            <div class="field"><label for="coSlot">Preferred time</label>
              <div class="select-field select-block"><select id="coSlot">${cfg.delivery.timeSlots.map((s) => `<option ${s === data.slot ? "selected" : ""}>${escapeHTML(s)}</option>`).join("")}</select>${icon("chevron")}</div></div>
            <div class="field field-full"><label for="coNotes">Notes for us</label><textarea id="coNotes" rows="2" placeholder="Less spicy, gift packing, call before delivery…">${escapeHTML(data.notes || "")}</textarea></div>
          </div>
          <p class="co-pin-status" id="coPinStatus" role="status" aria-live="polite"></p>
          <div class="co-actions">
            <button type="button" class="btn btn-ghost" data-close>Back to cart</button>
            <button type="submit" class="btn btn-primary btn-lg">Review order ${icon("arrow")}</button>
          </div>
        </form>
        ${miniSummary(t)}
      </div>`;

    const pin = $("#coPincode");
    const phone = $("#coPhone");
    pin.addEventListener("input", () => {
      pin.value = pin.value.replace(/\D/g, "").slice(0, 6);
      if (pin.value.length === 6) updatePinStatus(pin.value);
      else $("#coPinStatus").textContent = "";
    });
    phone.addEventListener("input", () => (phone.value = phone.value.replace(/[^\d+ ]/g, "").slice(0, 16)));
    if (data.pincode) updatePinStatus(data.pincode);
    $("#coForm").addEventListener("submit", onSubmitDetails);
    setTimeout(() => $("#coName").focus(), 50);
  }

  function updatePinStatus(pinValue) {
    const t = SHF.cart.totals(pinValue);
    const s = $("#coPinStatus");
    const d = t.delivery;
    if (d.status === "outside") {
      s.className = "co-pin-status is-error";
      s.innerHTML = `${icon("alert")}Sorry — ${escapeHTML(pinValue)} is currently outside our delivery area.`;
    } else if (d.status === "free" || d.status === "paid") {
      s.className = "co-pin-status is-ok";
      s.innerHTML = `${icon("check")}${escapeHTML(d.zone.name)}: ${d.status === "free" ? "free delivery" : `delivery ${money(d.charge)}`} · ${escapeHTML(d.zone.eta)}`;
    }
    const del = $("#coDelivery");
    if (del) {
      del.textContent = d.status === "outside" || d.status === "invalid" ? "—" : t.charge === 0 ? "Free" : money(t.charge);
      $("#coTotal").textContent = money(t.total);
    }
  }

  function onSubmitDetails(e) {
    e.preventDefault();
    const f = {
      name: $("#coName"), phone: $("#coPhone"), address: $("#coAddress"),
      pincode: $("#coPincode"), date: $("#coDate"),
    };
    const v = {
      name: f.name.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(),
      landmark: $("#coLandmark").value.trim(), pincode: f.pincode.value.trim(), date: f.date.value,
      slot: $("#coSlot").value, notes: $("#coNotes").value.trim(),
    };
    const minDate = U.isoDate(cfg.delivery.prepDays);
    const errors = {
      name: v.name.length < 2 ? "Please enter your name." : "",
      phone: !U.isValidPhone(v.phone) ? "Enter a valid 10-digit Indian mobile number." : "",
      address: v.address.length < 8 ? "Please enter your full delivery address." : "",
      pincode: !SHF.delivery.isPincode(v.pincode)
        ? "Enter a 6-digit pincode."
        : !SHF.delivery.findZone(v.pincode)
        ? "We don't deliver to this pincode yet. Message us on WhatsApp to check."
        : "",
      date: !v.date ? "Choose a delivery date." : v.date < minDate ? `Earliest available date is ${U.prettyDate(minDate)}.` : "",
    };
    let first = null;
    Object.entries(errors).forEach(([k, msg]) => {
      U.setFieldError(f[k], msg);
      if (msg && !first) first = f[k];
    });
    if (first) {
      first.focus();
      return;
    }
    const t = SHF.cart.totals(v.pincode);
    if (t.delivery.belowMin) {
      U.toast(`Minimum order is ${money(t.delivery.minOrder)}.`, { type: "error" });
      return;
    }
    v.phone = U.normalizePhone(v.phone);
    data = v;
    store.set(KEY, { ...store.get(KEY, {}), name: v.name, phone: v.phone, address: v.address, landmark: v.landmark, pincode: v.pincode });
    SHF.delivery.setPincode(v.pincode);
    step = "review";
    render();
  }

  function renderReview() {
    const items = SHF.cart.items();
    const t = SHF.cart.totals(data.pincode);
    body().innerHTML = `${header("Review your order", "Check everything once — this is exactly what we'll receive.")}
      <div class="review">
        <section class="review-block">
          <div class="review-block-head"><h3>${icon("pin")} Deliver to</h3><button type="button" class="link-btn" id="coEdit">Edit</button></div>
          <p><b>${escapeHTML(data.name)}</b> · ${escapeHTML(data.phone)}</p>
          <p>${escapeHTML(data.address)}${data.landmark ? `, near ${escapeHTML(data.landmark)}` : ""} — ${escapeHTML(data.pincode)}</p>
          <p>${icon("calendar")} ${escapeHTML(U.prettyDate(data.date))}${data.slot ? ` · ${escapeHTML(data.slot)}` : ""}</p>
          ${data.notes ? `<p class="review-notes">“${escapeHTML(data.notes)}”</p>` : ""}
        </section>
        <section class="review-block">
          <h3>${icon("bag")} Items</h3>
          <ul class="review-items">${items.map((i) => `<li><span>${escapeHTML(i.product.name)} — ${i.size} × ${i.qty}</span><b>${money(i.total)}</b></li>`).join("")}</ul>
          <dl class="summary">
            <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
            ${t.discount ? `<div class="discount"><dt>Discount (${escapeHTML(t.discountCode)})</dt><dd>− ${money(t.discount)}</dd></div>` : ""}
            <div><dt>Delivery (${escapeHTML(t.delivery.zone.name)})</dt><dd>${t.charge === 0 ? "Free" : money(t.charge)}</dd></div>
            <div class="total"><dt>Total</dt><dd>${money(t.total)}</dd></div>
          </dl>
        </section>
        <p class="confirm-note">${icon("info")}<span>Tapping the button opens WhatsApp with this order typed out. <b>Please press send in WhatsApp.</b> Your order is confirmed only after ${escapeHTML(cfg.business.name)} replies to you. Payment details will be shared when we confirm.</span></p>
        <div class="co-actions">
          <button type="button" class="btn btn-ghost" id="coBack">Back</button>
          <button type="button" class="btn btn-whatsapp btn-lg" id="coSend">${icon("chat")} Place Order on WhatsApp</button>
        </div>
      </div>`;
    $("#coEdit").addEventListener("click", () => { step = "details"; render(); });
    $("#coBack").addEventListener("click", () => { step = "details"; render(); });
    $("#coSend").addEventListener("click", () => {
      lastMessage = buildOrderMessage(data, items, t);
      U.openWhatsApp(lastMessage);
      step = "sent";
      render();
    });
    setTimeout(() => $("#coSend").focus(), 50);
  }

  function renderSent() {
    body().innerHTML = `${header("Almost done — please send the message", "")}
      <div class="sent">
        <div class="sent-art">${icon("chat")}</div>
        <p class="sent-lead">WhatsApp should now be open with your order typed out. <b>Press send</b> to share it with us.</p>
        <div class="pending-badge">${icon("clock")} Status: waiting for our confirmation</div>
        <p>Your order is <b>not confirmed yet</b>. We'll reply on WhatsApp to confirm availability, the delivery time and payment details.</p>
        <details class="sent-copy"><summary>WhatsApp didn't open? Copy the message instead</summary>
          <pre id="coMsg">${escapeHTML(lastMessage)}</pre>
          <button type="button" class="btn btn-ghost btn-sm" id="coCopy">Copy message</button>
        </details>
        <div class="co-actions co-actions-stack">
          <button type="button" class="btn btn-ghost" id="coReopen">${icon("chat")} Open WhatsApp again</button>
          <button type="button" class="btn btn-primary" id="coDone">I've sent it — clear my cart</button>
        </div>
        <p class="summary-note center">Not sent yet? Close this window — your cart is saved.</p>
      </div>`;
    $("#coReopen").addEventListener("click", () => U.openWhatsApp(lastMessage));
    $("#coCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(lastMessage);
        U.toast("Order message copied.");
      } catch {
        U.toast("Couldn't copy — please select the text and copy it.", { type: "error" });
      }
    });
    $("#coDone").addEventListener("click", () => {
      SHF.cart.clear();
      U.closeDialog(dlg());
      U.closeDialog($("#cartDrawer"));
      U.toast("Thank you! We'll confirm your order on WhatsApp shortly.");
    });
  }

  function render() {
    if (step === "details") renderDetails();
    else if (step === "review") renderReview();
    else renderSent();
    body().scrollTop = 0;
  }

  function open() {
    if (!SHF.cart.items().length) return U.toast("Your cart is empty.", { type: "info" });
    const saved = store.get(KEY, {});
    data = { ...saved, ...data, pincode: SHF.delivery.getPincode() || saved.pincode || "" };
    step = "details";
    render();
    U.openDialog(dlg());
  }

  function init() {
    U.wireDialog(dlg());
  }

  SHF.checkout = { init, open, buildOrderMessage };
})();
