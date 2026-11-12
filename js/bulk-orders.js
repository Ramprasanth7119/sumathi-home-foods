/* =====================================================================
   BULK ORDER ENQUIRY → formatted WhatsApp message.
   ===================================================================== */
(function () {
  const SHF = window.SHF;
  const U = SHF.utils;
  const { $, $$, escapeHTML } = U;
  const cfg = SHF.config;

  function buildBulkMessage(v) {
    return [
      `${cfg.business.name.toUpperCase()} - BULK ORDER ENQUIRY`,
      "",
      `Name: ${v.name}`,
      `Phone: ${v.phone}`,
      `Event: ${v.event}`,
      `Delivery Date: ${U.prettyDate(v.date)}`,
      `Delivery Location: ${v.location}`,
      "",
      "PRODUCTS REQUIRED:",
      ...v.products.map((p) => `- ${p}`),
      "",
      `Estimated Quantity: ${v.quantity}`,
      v.notes ? `Additional Requirements: ${v.notes}` : null,
      "",
      "Please share availability and a quote.",
    ]
      .filter((l) => l !== null)
      .join("\n");
  }

  function init() {
    const form = $("#bulkForm");
    if (!form) return;
    const minDate = U.isoDate(cfg.bulk.leadDays);

    $("#bEvent").innerHTML =
      `<option value="">Select an event</option>` + cfg.bulk.eventTypes.map((t) => `<option>${escapeHTML(t)}</option>`).join("");
    $("#bDate").min = minDate;
    $("#bProducts").innerHTML =
      SHF.products
        .map((p) => `<label class="check"><input type="checkbox" name="products" value="${escapeHTML(p.name)}" /><span>${escapeHTML(p.name)}</span></label>`)
        .join("") + `<label class="check"><input type="checkbox" name="products" value="Other (see notes)" /><span>Other</span></label>`;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = {
        name: $("#bName"), phone: $("#bPhone"), event: $("#bEvent"), date: $("#bDate"),
        quantity: $("#bQty"), location: $("#bLocation"),
      };
      const products = $$('input[name="products"]:checked', form).map((c) => c.value);
      const v = {
        name: f.name.value.trim(), phone: f.phone.value.trim(), event: f.event.value, date: f.date.value,
        quantity: f.quantity.value.trim(), location: f.location.value.trim(), notes: $("#bNotes").value.trim(), products,
      };
      const errors = {
        name: v.name.length < 2 ? "Please enter your name." : "",
        phone: !U.isValidPhone(v.phone) ? "Enter a valid 10-digit Indian mobile number." : "",
        event: !v.event ? "Select the type of event." : "",
        date: !v.date ? "Choose the delivery date." : v.date < minDate ? `Bulk orders need at least ${cfg.bulk.leadDays} days' notice — earliest ${U.prettyDate(minDate)}.` : "",
        quantity: !v.quantity ? "Tell us roughly how much you need." : "",
        location: v.location.length < 3 ? "Enter the delivery location." : "",
      };
      let first = null;
      Object.entries(errors).forEach(([k, msg]) => {
        U.setFieldError(f[k], msg);
        if (msg && !first) first = f[k];
      });
      const pErr = $("#bProducts-err");
      pErr.textContent = products.length ? "" : "Select at least one product.";
      if (!products.length && !first) first = $('input[name="products"]', form);
      if (first) {
        first.focus();
        U.toast("Please fix the highlighted fields.", { type: "error" });
        return;
      }
      v.phone = U.normalizePhone(v.phone);
      U.openWhatsApp(buildBulkMessage(v));
      U.toast("Enquiry opened in WhatsApp — press send. We'll reply with a quote.");
    });

    form.addEventListener("input", (e) => {
      if (e.target.getAttribute("aria-invalid") === "true") U.setFieldError(e.target, "");
      if (e.target.name === "products") $("#bProducts-err").textContent = "";
    });
  }

  SHF.bulk = { init, buildBulkMessage };
})();
