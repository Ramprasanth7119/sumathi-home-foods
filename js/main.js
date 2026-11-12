/* =====================================================================
   MAIN — page rendering & interactions.
   Each render* function is the equivalent of a future React component:
     renderCategories → <CategoryGrid/>, renderCatalog → <ProductGrid/>,
     productCard → <ProductCard/>, openProduct → <ProductModal/>, etc.
   ===================================================================== */
(function () {
  const SHF = window.SHF;
  const U = SHF.utils;
  const { $, $$, money, escapeHTML, icon } = U;
  const cfg = SHF.config;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- per-card selection state ---------------- */
  const selection = new Map(); // id → { size, qty }
  const sel = (p) => {
    if (!selection.has(p.id)) selection.set(p.id, { size: p.packs[0].size, qty: 1 });
    return selection.get(p.id);
  };
  const priceOf = (p, size) => p.packs.find((k) => k.size === size).price;
  const fromPrice = (p) => Math.min(...p.packs.map((k) => k.price));

  /* ---------------- config-driven text ---------------- */
  function fillConfigText() {
    $$("[data-config]").forEach((el) => {
      const v = U.getPath(cfg, el.dataset.config);
      if (v != null) el.textContent = v;
    });
    $("#year").textContent = new Date().getFullYear();
    $$("[data-wa]").forEach((a) => {
      a.href = U.waUrl(`Hello ${cfg.business.name}! I'd like to place an order.`);
      a.target = "_blank";
      a.rel = "noopener";
      a.addEventListener("click", (e) => {
        if (cfg.business.whatsappIsPlaceholder) {
          e.preventDefault();
          U.openWhatsApp(`Hello ${cfg.business.name}! I'd like to place an order.`);
        }
      });
    });
    const call = $("#callBtn");
    call.href = `tel:${cfg.business.phoneHref}`;
  }

  /* ---------------- header & navigation ---------------- */
  function initNav() {
    const header = $("#siteHeader");
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const toggle = $("#menuToggle");
    const nav = $("#primaryNav");
    const setOpen = (open) => {
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.documentElement.classList.toggle("menu-lock", open);
    };
    toggle.addEventListener("click", () => setOpen(!header.classList.contains("menu-open")));
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && header.classList.contains("menu-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 981px)").addEventListener("change", (m) => m.matches && setOpen(false));

    // active link highlighting
    const links = $$('.primary-nav a[href^="#"]:not(.btn)');
    const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && map.has(en.target.id)) {
            links.forEach((l) => l.removeAttribute("aria-current"));
            map.get(en.target.id).setAttribute("aria-current", "true");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    map.forEach((_, id) => {
      const s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ---------------- categories ---------------- */
  function renderCategories() {
    $("#categoryGrid").innerHTML = SHF.categories
      .map(
        (c, i) => `<article class="cat-card reveal" style="--d:${i * 80}ms">
          <div class="cat-media">${U.picture(c.image, c.alt, { sizes: "(max-width: 600px) 92vw, (max-width: 1100px) 46vw, 300px", w: 960, h: 720 })}</div>
          <div class="cat-body">
            <h3>${escapeHTML(c.title)}</h3>
            <p>${escapeHTML(c.text)}</p>
            ${
              c.href
                ? `<a class="cat-link" href="${c.href}">Plan an order ${icon("arrow")}</a>`
                : `<button type="button" class="cat-link" data-cat-filter="${c.filter}">Explore ${icon("arrow")}</button>`
            }
          </div>
        </article>`
      )
      .join("");
    $("#categoryGrid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat-filter]");
      if (!b) return;
      setFilter(b.dataset.catFilter);
      $("#foods").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------------- catalogue ---------------- */
  const catalog = { filter: "all", sort: "popularity", query: "" };

  const matches = (p, q) => {
    if (!q) return true;
    const hay = `${p.name} ${p.nameTa || ""} ${p.short} ${p.category} ${p.festival ? "festival" : ""}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  };

  function visibleProducts() {
    let list = SHF.products.filter((p) => {
      if (catalog.filter === "festival") return p.festival;
      if (catalog.filter !== "all") return p.category === catalog.filter;
      return true;
    });
    list = list.filter((p) => matches(p, catalog.query));
    const s = catalog.sort;
    list.sort((a, b) =>
      s === "price-asc" ? fromPrice(a) - fromPrice(b) : s === "price-desc" ? fromPrice(b) - fromPrice(a) : b.popularity - a.popularity
    );
    // available first, always
    return list.sort((a, b) => Number(b.available) - Number(a.available));
  }

  function productCard(p) {
    const st = sel(p);
    const badge = p.festival ? `<span class="badge badge-gold">${icon("flame")}Festival special</span>` : "";
    return `<article class="product-card ${p.available ? "" : "is-unavailable"}" data-id="${p.id}">
      <button type="button" class="pc-media" data-details aria-label="View details for ${escapeHTML(p.name)}">
        ${U.picture(p.image, p.alt, { sizes: "(max-width: 600px) 92vw, (max-width: 1100px) 46vw, 380px", w: 960, h: 960 })}
        <span class="pc-badges">${badge}<span class="badge">${p.category === "snacks" ? "Snack" : "Sweet"}</span></span>
        <span class="pc-view">${icon("search")} Quick view</span>
      </button>
      <div class="pc-body">
        <div class="pc-head">
          <div>
            ${p.nameTa ? `<p class="pc-ta" lang="ta">${escapeHTML(p.nameTa)}</p>` : ""}
            <h3><button type="button" class="pc-title" data-details>${escapeHTML(p.name)}</button></h3>
          </div>
          <p class="pc-price"><b data-price>${money(priceOf(p, st.size))}</b><span data-per>/ ${st.size}</span></p>
        </div>
        <p class="pc-desc">${escapeHTML(p.short)}</p>
        <p class="avail ${p.available ? "is-on" : "is-off"}"><span class="dot" aria-hidden="true"></span>${p.available ? "Available · made fresh to order" : "Currently unavailable"}</p>
        ${
          p.available
            ? `<fieldset class="packs">
                <legend class="sr-only">Pack size for ${escapeHTML(p.name)}</legend>
                ${p.packs
                  .map(
                    (k) => `<label class="pack"><input type="radio" name="pack-${p.id}" value="${k.size}" ${k.size === st.size ? "checked" : ""} /><span>${k.size}</span></label>`
                  )
                  .join("")}
              </fieldset>
              <div class="pc-actions">
                ${stepper(st.qty, p.name)}
                <button type="button" class="btn btn-primary btn-add" data-add>${icon("bag")}<span>Add to cart</span></button>
              </div>`
            : `<a href="#" class="btn btn-ghost btn-block" data-wa-ask="${escapeHTML(p.name)}">${icon("chat")} Ask when it's back</a>`
        }
      </div>
    </article>`;
  }

  const stepper = (qty, name) => `<div class="stepper" role="group" aria-label="Quantity for ${escapeHTML(name)}">
      <button type="button" data-qty="-1" aria-label="Decrease quantity" ${qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
      <output aria-live="polite" data-qty-out>${qty}</output>
      <button type="button" data-qty="1" aria-label="Increase quantity">${icon("plus")}</button>
    </div>`;

  function renderCatalog() {
    const list = visibleProducts();
    const grid = $("#productGrid");
    grid.innerHTML = list.map(productCard).join("");
    $("#emptyResults").hidden = list.length > 0;
    const label = { all: "foods", snacks: "snacks", sweets: "sweets", festival: "festival specials" }[catalog.filter];
    $("#resultsInfo").textContent = catalog.query
      ? `${list.length} result${list.length === 1 ? "" : "s"} for “${catalog.query}”`
      : `Showing ${list.length} ${label}`;
    // stagger-in
    if (!reduceMotion) $$(".product-card", grid).forEach((c, i) => { c.style.setProperty("--d", `${i * 50}ms`); c.classList.add("card-in"); });
  }

  function setFilter(f) {
    catalog.filter = f;
    $$("#filterChips .chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.filter === f)));
    renderCatalog();
  }

  function addToCart(p, size, qty, sourceEl) {
    if (SHF.cart.add(p.id, size, qty)) {
      SHF.cart.bump();
      U.toast(`${p.name} ${size} × ${qty} added to cart`, { action: { label: "View cart", onClick: () => SHF.cart.open() } });
      if (sourceEl) {
        sourceEl.classList.add("is-added");
        const label = sourceEl.querySelector("span");
        const old = label && label.textContent;
        if (label) label.textContent = "Added";
        setTimeout(() => {
          sourceEl.classList.remove("is-added");
          if (label) label.textContent = old;
        }, 1300);
      }
    }
  }

  function initCatalog() {
    renderCatalog();
    const chips = $("#filterChips");
    chips.addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (c) setFilter(c.dataset.filter);
    });
    // arrow-key navigation for the radiogroup
    chips.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
      const all = $$(".chip", chips);
      const i = all.indexOf(document.activeElement);
      const next = all[(i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length];
      next.focus();
      setFilter(next.dataset.filter);
    });
    $("#sortSelect").addEventListener("change", (e) => {
      catalog.sort = e.target.value;
      renderCatalog();
    });
    let t;
    $("#catalogSearch").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        catalog.query = e.target.value.trim();
        renderCatalog();
      }, 120);
    });
    $("#clearFilters").addEventListener("click", () => {
      catalog.query = "";
      $("#catalogSearch").value = "";
      setFilter("all");
    });

    const grid = $("#productGrid");
    grid.addEventListener("change", (e) => {
      const r = e.target.closest('input[type="radio"]');
      if (!r) return;
      const card = r.closest(".product-card");
      const p = SHF.products.find((x) => x.id === card.dataset.id);
      sel(p).size = r.value;
      card.querySelector("[data-price]").textContent = money(priceOf(p, r.value));
      card.querySelector("[data-per]").textContent = `/ ${r.value}`;
    });
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".product-card");
      if (!card) return;
      const p = SHF.products.find((x) => x.id === card.dataset.id);
      const st = sel(p);
      if (e.target.closest("[data-details]")) return openProduct(p);
      const q = e.target.closest("[data-qty]");
      if (q) {
        st.qty = Math.max(1, Math.min(SHF.cart.MAX_QTY, st.qty + Number(q.dataset.qty)));
        card.querySelector("[data-qty-out]").textContent = st.qty;
        card.querySelector('[data-qty="-1"]').disabled = st.qty <= 1;
        return;
      }
      const add = e.target.closest("[data-add]");
      if (add) {
        addToCart(p, st.size, st.qty, add);
        st.qty = 1;
        card.querySelector("[data-qty-out]").textContent = 1;
        card.querySelector('[data-qty="-1"]').disabled = true;
      }
      const ask = e.target.closest("[data-wa-ask]");
      if (ask) {
        e.preventDefault();
        U.openWhatsApp(`Hello! Please let me know when ${ask.dataset.waAsk} is available again.`);
      }
    });
  }

  /* ---------------- product details modal ---------------- */
  function openProduct(p) {
    const dlg = $("#productDialog");
    const st = { ...sel(p) };
    const body = $("#productDialogBody");
    body.innerHTML = `
      <button type="button" class="icon-btn modal-close" data-close aria-label="Close">${icon("x")}</button>
      <div class="pd-grid">
        <div class="pd-media">${U.picture(p.image, p.alt, { lazy: false, sizes: "(max-width: 760px) 92vw, 440px", w: 960, h: 960 })}</div>
        <div class="pd-info">
          ${p.nameTa ? `<p class="pc-ta" lang="ta">${escapeHTML(p.nameTa)}</p>` : ""}
          <h2 id="pdTitle">${escapeHTML(p.name)}</h2>
          <div class="pd-badges">${p.festival ? `<span class="badge badge-gold">${icon("flame")}Festival special</span>` : ""}<span class="badge">${p.category === "snacks" ? "Traditional snack" : "Homemade sweet"}</span></div>
          <p class="pd-desc">${escapeHTML(p.description)}</p>
          ${
            p.available
              ? `<fieldset class="pd-packs">
                  <legend>Choose pack size</legend>
                  ${p.packs.map((k) => `<label class="pd-pack"><input type="radio" name="pd-pack" value="${k.size}" ${k.size === st.size ? "checked" : ""}/><span><b>${k.size}</b><em>${money(k.price)}</em></span></label>`).join("")}
                </fieldset>
                <div class="pd-buy">
                  ${stepper(st.qty, p.name)}
                  <button type="button" class="btn btn-primary btn-lg" id="pdAdd">${icon("bag")} Add · <span id="pdTotal">${money(priceOf(p, st.size) * st.qty)}</span></button>
                </div>`
              : `<p class="avail is-off"><span class="dot"></span>Currently unavailable</p>`
          }
          <ul class="pd-facts">
            <li>${icon("home")}<span>Prepared at home in small batches</span></li>
            <li>${icon("truck")}<span>Local delivery — <a href="#delivery" data-close>check your pincode</a></span></li>
            <li>${icon("info")}<span>Shelf life &amp; storage: <em class="sample-flag">to be confirmed by the kitchen</em></span></li>
          </ul>
        </div>
      </div>`;

    const update = () => {
      body.querySelector("[data-qty-out]").textContent = st.qty;
      body.querySelector('[data-qty="-1"]').disabled = st.qty <= 1;
      $("#pdTotal").textContent = money(priceOf(p, st.size) * st.qty);
    };
    if (p.available) {
      body.querySelector(".pd-packs").addEventListener("change", (e) => {
        st.size = e.target.value;
        update();
      });
      body.querySelector(".stepper").addEventListener("click", (e) => {
        const q = e.target.closest("[data-qty]");
        if (!q) return;
        st.qty = Math.max(1, Math.min(SHF.cart.MAX_QTY, st.qty + Number(q.dataset.qty)));
        update();
      });
      $("#pdAdd").addEventListener("click", () => {
        addToCart(p, st.size, st.qty);
        U.closeDialog(dlg);
      });
    }
    U.openDialog(dlg);
  }

  /* ---------------- global search ---------------- */
  function initSearch() {
    const dlg = $("#searchDialog");
    U.wireDialog(dlg);
    const input = $("#globalSearch");
    const results = $("#searchResults");
    const render = () => {
      const q = input.value.trim();
      const list = SHF.products.filter((p) => matches(p, q));
      results.innerHTML = list.length
        ? list
            .map(
              (p) => `<li><button type="button" class="sr-item" data-id="${p.id}">
                ${U.picture(p.image, "", { sizes: "56px", w: 480, h: 480 })}
                <span><b>${escapeHTML(p.name)}</b><small>${escapeHTML(p.short)}</small></span>
                <em>from ${money(fromPrice(p))}</em></button></li>`
            )
            .join("")
        : `<li class="sr-empty">No matches for “${escapeHTML(q)}”. Try “laddu” or “murukku”.</li>`;
    };
    $("#searchOpen").addEventListener("click", () => {
      input.value = "";
      render();
      U.openDialog(dlg);
      setTimeout(() => input.focus(), 30);
    });
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const first = results.querySelector(".sr-item");
        if (first) first.focus();
      }
      if (e.key === "Enter") {
        catalog.query = input.value.trim();
        $("#catalogSearch").value = catalog.query;
        setFilter("all");
        U.closeDialog(dlg);
        setTimeout(() => $("#foods").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }), 200);
      }
    });
    results.addEventListener("keydown", (e) => {
      const items = $$(".sr-item", results);
      const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); i > 0 ? items[i - 1].focus() : input.focus(); }
    });
    results.addEventListener("click", (e) => {
      const b = e.target.closest(".sr-item");
      if (!b) return;
      const p = SHF.products.find((x) => x.id === b.dataset.id);
      U.closeDialog(dlg);
      setTimeout(() => openProduct(p), 200);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        $("#searchOpen").click();
      }
    });
  }

  /* ---------------- FAQ (answers built from config so they never go stale) ---------------- */
  function renderFAQ() {
    const D = cfg.delivery;
    const zones = D.zones;
    const freeList = zones.map((z) => `${z.name.toLowerCase()} above ${money(z.freeAbove)}`).join(", ");
    const faqs = [
      ["Are all products homemade?", "Yes. Everything is prepared in our home kitchen in small batches, using traditional recipes. We don't resell factory-made snacks."],
      ["Which areas do you deliver to?", `We currently deliver to ${zones.map((z) => z.name.toLowerCase()).join(", ")} around our kitchen. Use the <a href="#delivery">pincode checker</a> to see if we reach you. If your area isn't listed, message us — we'll tell you honestly.`],
      ["Is free delivery available?", `Yes, on qualifying orders — free delivery for ${freeList}. Smaller orders have a delivery charge from ${money(Math.min(...zones.map((z) => z.charge)))}. Free delivery isn't available outside our delivery areas.`],
      ["Can I order in bulk?", `Absolutely. We take orders for weddings, functions, festivals, corporate events and return gifts. Fill in the <a href="#bulk">bulk order form</a> and we'll reply with availability and a quote.`],
      ["How early should I place a bulk order?", `Please enquire at least ${cfg.bulk.leadDays} days before your event. For weddings and festival season, the earlier the better — our batches are made by hand.`],
      ["Can I customize quantities?", "Choose 250g, 500g or 1kg packs (where available) and add as many packs as you need. For other quantities or special requests — less sweet, less spicy, gift packing — add a note at checkout or use the bulk order form."],
      ["How can I place an order?", "Add items to your cart, check your pincode, enter your details and tap “Place Order on WhatsApp”. WhatsApp opens with your order typed out — just press send. Your order is confirmed once we reply."],
      ["How can I contact you?", `WhatsApp or call us on ${escapeHTML(cfg.business.phoneDisplay)}, or email ${escapeHTML(cfg.business.email)}. See the <a href="#contact">contact section</a> for our timings.`],
    ];
    $("#faqList").innerHTML = faqs
      .map(
        ([q, a], i) => `<div class="faq-item reveal" style="--d:${i * 40}ms">
          <h3><button type="button" class="faq-q" aria-expanded="false" aria-controls="faq-a-${i}" id="faq-q-${i}">
            <span>${q}</span><span class="faq-icon" aria-hidden="true">${icon("plus")}</span></button></h3>
          <div class="faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}" hidden><div><p>${a}</p></div></div>
        </div>`
      )
      .join("");
    $("#faqList").addEventListener("click", (e) => {
      const b = e.target.closest(".faq-q");
      if (!b) return;
      const open = b.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(b.getAttribute("aria-controls"));
      b.setAttribute("aria-expanded", String(!open));
      if (open) {
        panel.classList.remove("is-open");
        setTimeout(() => (panel.hidden = true), reduceMotion ? 0 : 260);
      } else {
        panel.hidden = false;
        requestAnimationFrame(() => panel.classList.add("is-open"));
      }
    });
  }

  /* ---------------- reviews — SAMPLE PLACEHOLDERS, NOT REAL CUSTOMERS ---------------- */
  // Replace with genuine reviews (with the customer's permission) before launch.
  const SAMPLE_REVIEWS = [
    { name: "Sample customer", place: "Sample Area 1", text: "Placeholder: a short line about the murukku being crisp and tasting just like home.", item: "Murukku" },
    { name: "Sample customer", place: "Sample Area 4", text: "Placeholder: a line about ordering laddus and adhirasam for a family function and how it went.", item: "Bulk order" },
    { name: "Sample customer", place: "Sample Area 2", text: "Placeholder: a line about the gulab jamuns arriving soft and well packed.", item: "Gulab Jamun" },
  ];
  function renderReviews() {
    $("#reviewGrid").innerHTML = SAMPLE_REVIEWS.map(
      (r, i) => `<figure class="review-card reveal" style="--d:${i * 80}ms" data-sample="true">
        <span class="sample-tag">Sample</span>
        <div class="stars" aria-hidden="true">${icon("star").repeat(5)}</div>
        <blockquote><p>${escapeHTML(r.text)}</p></blockquote>
        <figcaption><span class="avatar" aria-hidden="true">${escapeHTML(r.name[0])}</span><span><b>${escapeHTML(r.name)}</b><small>${escapeHTML(r.place)} · ${escapeHTML(r.item)}</small></span></figcaption>
      </figure>`
    ).join("");
  }

  /* ---------------- contact & footer ---------------- */
  function renderContact() {
    const b = cfg.business;
    const items = [
      ["phone", "Phone", `<a href="tel:${escapeHTML(b.phoneHref)}">${escapeHTML(b.phoneDisplay)}</a>`],
      ["chat", "WhatsApp", `<a href="${U.waUrl()}" target="_blank" rel="noopener">${escapeHTML(b.phoneDisplay)}</a>`],
      ["mail", "Email", `<a href="mailto:${escapeHTML(b.email)}">${escapeHTML(b.email)}</a>`],
      ["pin", "Kitchen location", `${escapeHTML(b.address)}<br>${escapeHTML(b.city)}`],
      ["clock", "Order timings", b.timings.map((t) => `${escapeHTML(t.days)}: ${escapeHTML(t.hours)}`).join("<br>")],
      b.social.instagram ? ["instagram", "Instagram", `<a href="${escapeHTML(b.social.instagram)}" target="_blank" rel="noopener">Follow our kitchen</a>`] : null,
    ].filter(Boolean);
    $("#contactList").innerHTML = items
      .map(([ic, label, val]) => `<li><span class="ci-icon">${icon(ic)}</span><div><span class="ci-label">${label}</span><span class="ci-val">${val}</span></div></li>`)
      .join("");
    $("#footerSocial").innerHTML = [
      b.social.instagram && `<li><a href="${escapeHTML(b.social.instagram)}" aria-label="Instagram" target="_blank" rel="noopener">${icon("instagram")}</a></li>`,
      `<li><a href="${U.waUrl()}" aria-label="WhatsApp" target="_blank" rel="noopener">${icon("chat")}</a></li>`,
      `<li><a href="mailto:${escapeHTML(b.email)}" aria-label="Email">${icon("mail")}</a></li>`,
    ]
      .filter(Boolean)
      .join("");
  }

  /* ---------------- scroll reveal ---------------- */
  function initReveal() {
    const els = $$(".reveal:not(.is-visible)");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            io.unobserve(en.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------------- hero 3D: pointer tilt + scroll drift ---------------- */
  function initHero3D() {
    const stage = $("#heroStage");
    const tilt = $("#stageTilt");
    if (!stage || reduceMotion) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true;

    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      tilt.style.setProperty("--rx", `${(-cy * 9).toFixed(2)}deg`);
      tilt.style.setProperty("--ry", `${(cx * 12).toFixed(2)}deg`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001 && visible ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    if (fine) {
      $(".hero").addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.2)));
        ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 1.2)));
        kick();
      });
      $(".hero").addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
    }
    // scroll drift (works on touch too)
    const onScroll = () => {
      const y = window.scrollY;
      if (y > window.innerHeight * 1.2) return;
      stage.style.setProperty("--scroll", (y / window.innerHeight).toFixed(3));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      stage.classList.toggle("is-paused", !visible); // pause float animations off-screen
    }).observe(stage);
  }

  /* ---------------- boot ---------------- */
  function init() {
    fillConfigText();
    initNav();
    renderCategories();
    initCatalog();
    SHF.delivery.renderSection();
    SHF.cart.init();
    SHF.checkout.init();
    SHF.bulk.init();
    U.wireDialog($("#productDialog"));
    initSearch();
    renderFAQ();
    renderReviews();
    renderContact();
    initReveal();
    initHero3D();
    document.documentElement.classList.add("js-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
