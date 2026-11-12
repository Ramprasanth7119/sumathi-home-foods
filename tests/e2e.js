/* End-to-end check of the full customer journey.
   Usage:  1) serve the site:  python -m http.server 5173
           2) node tests/e2e.js   (needs playwright-core + a Chromium build)
   Set PW_CORE / CHROME env vars if they live elsewhere. Numbers below assume
   the SAMPLE prices/zones shipped in js/config.js + js/products.js. */
const { chromium } = require(process.env.PW_CORE || "playwright-core");
const SITE = process.env.SITE_URL || "http://127.0.0.1:5173/";
const SHOTS = process.env.SHOTS || null;

let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  → " + extra : ""}`);
};

(async () => {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => {
    window.__wa = [];
    window.open = (u) => { window.__wa.push(u); return {}; };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

  await page.goto(SITE, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });

  /* ---------- navigation ---------- */
  const missing = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.querySelector(h)));
  ok(missing.length === 0, "every in-page link has a target", missing.join(","));

  /* ---------- images ---------- */
  // bring each lazy image into view and let it finish loading
  await page.evaluate(async () => {
    for (const img of document.images) {
      img.scrollIntoView({ block: "center" });
      const t0 = Date.now();
      while (!img.complete && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
  ok(broken.length === 0, "all images loaded", broken.join(", "));
  const noAlt = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.hasAttribute("alt")).length);
  ok(noAlt === 0, "every <img> has an alt attribute");

  /* ---------- catalogue: filters, search, sort ---------- */
  const cards = () => page.$$eval("#productGrid .product-card", (c) => c.map((x) => x.dataset.id));
  ok((await cards()).length === 7, "all 7 products render");
  await page.click('[data-filter="sweets"]');
  ok((await cards()).length === 5, "filter: sweets = 5");
  await page.click('[data-filter="snacks"]');
  ok((await cards()).length === 2, "filter: snacks = 2");
  await page.click('[data-filter="festival"]');
  ok((await cards()).length === 4, "filter: festival = 4");
  await page.click('[data-filter="all"]');
  await page.fill("#catalogSearch", "jamun");
  await page.waitForTimeout(250);
  ok(JSON.stringify(await cards()) === '["gulab-jamun"]', "search 'jamun' → Gulab Jamun");
  await page.fill("#catalogSearch", "pizza");
  await page.waitForTimeout(250);
  ok((await cards()).length === 0 && (await page.isVisible("#emptyResults")), "search with no match shows empty state");
  await page.click("#clearFilters");
  ok((await cards()).length === 7 && !(await page.isVisible("#emptyResults")), "clear filters restores list and hides empty state");
  await page.selectOption("#sortSelect", "price-desc");
  ok((await cards())[0] === "gulab-jamun", "sort price high→low puts Gulab Jamun (from ₹200) first");
  await page.selectOption("#sortSelect", "price-asc");
  const first = (await cards())[0];
  ok(first === "boondhi" || first === "mixture", "sort price low→high puts an ₹80 item first", first);
  await page.selectOption("#sortSelect", "popularity");
  ok((await cards())[0] === "murukku", "sort popularity puts Murukku first");

  /* ---------- pack size + add to cart ---------- */
  const card = '.product-card[data-id="murukku"]';
  await page.click(`${card} .pack:has(input[value="500g"])`);
  ok((await page.textContent(`${card} [data-price]`)).includes("170"), "pack size updates price (500g = ₹170)");
  await page.click(`${card} .pack:has(input[value="250g"])`);
  await page.click(`${card} [data-qty="1"]`);
  await page.click(`${card} [data-add]`);
  ok((await page.textContent("#cartCount")).trim() === "2", "cart badge shows 2 after adding 2 packs");

  const cart = async () => page.evaluate(() => ({ ...SHF.cart.totals(), count: SHF.cart.count() }));
  let t = await cart();
  ok(t.subtotal === 180 && t.delivery.belowMin, "₹180 subtotal is below the ₹250 minimum");
  await page.click("#cartOpen");
  await page.waitForSelector("#cartDrawer[open]");
  ok(await page.isDisabled("#checkoutBtn"), "checkout disabled below minimum order");

  // change size inside the cart
  await page.selectOption("#cartDrawer [data-size]", "500g");
  t = await cart();
  ok(t.subtotal === 340, "changing pack size in cart reprices (2 × ₹170 = ₹340)", t.subtotal);
  ok(t.charge === 40 && t.delivery.status === "unknown", "no pincode → default ₹40 estimate");

  // nearby pincode
  await page.fill("#cartPin", "600001");
  await page.click("#cartPinForm button");
  t = await cart();
  ok(t.charge === 30 && t.total === 370, "nearby zone: ₹30 delivery, total ₹370", JSON.stringify([t.charge, t.total]));
  ok(await page.isEnabled("#checkoutBtn"), "checkout enabled once minimum met");

  // free delivery threshold
  await page.evaluate(() => SHF.cart.add("laddu", "1kg", 1));
  t = await cart();
  ok(t.subtotal === 740 && t.charge === 0 && t.delivery.status === "free", "₹740 ≥ ₹599 → free delivery in nearby zone");

  // discount codes (demo)
  await page.click(".promo summary");
  await page.fill("#promoInput", "nope");
  await page.click("#promoForm button");
  ok((await cart()).discount === 0, "invalid discount code rejected");
  await page.fill("#promoInput", "welcome10");
  await page.click("#promoForm button");
  t = await cart();
  ok(t.discount === 74 && t.total === 666, "WELCOME10 → ₹74 off, total ₹666", JSON.stringify([t.discount, t.total]));

  // farther zone → charge returns
  await page.fill("#cartPin", "600004");
  await page.click("#cartPinForm button");
  t = await cart();
  ok(t.charge === 50 && t.total === 716, "across-town zone: ₹666 < ₹999 → ₹50 delivery, total ₹716");

  // outside area
  await page.fill("#cartPin", "123456");
  await page.click("#cartPinForm button");
  t = await cart();
  ok(t.delivery.status === "outside" && (await page.isDisabled("#checkoutBtn")), "outside pincode blocks checkout");
  await page.fill("#cartPin", "600001");
  await page.click("#cartPinForm button");

  // qty stepper in cart
  await page.click('#cartDrawer .cart-line[data-key="laddu__1kg"] [data-step="1"]');
  ok((await cart()).count === 4, "cart stepper increments quantity");
  await page.click('#cartDrawer .cart-line[data-key="laddu__1kg"] [data-step="-1"]');
  ok((await cart()).count === 3, "cart stepper decrements quantity");

  /* ---------- persistence ---------- */
  await page.reload({ waitUntil: "load" });
  t = await cart();
  ok(t.count === 3 && t.discountCode === "WELCOME10" && t.total === 666, "cart, code and pincode persist after refresh", JSON.stringify([t.count, t.discountCode, t.total]));

  /* ---------- checkout ---------- */
  await page.click("#cartOpen");
  await page.waitForSelector("#cartDrawer[open]");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/cart-desktop.png" });
  await page.click("#checkoutBtn");
  await page.waitForSelector("#checkoutDialog[open] #coForm");
  await page.fill("#coName", "");
  await page.click('#coForm button[type="submit"]');
  ok((await page.getAttribute("#coName", "aria-invalid")) === "true", "checkout: empty name flagged");
  await page.fill("#coName", "Test Customer");
  await page.fill("#coPhone", "12345");
  await page.fill("#coAddress", "12, Temple Street, Sample Area 1");
  await page.click('#coForm button[type="submit"]');
  ok((await page.getAttribute("#coPhone", "aria-invalid")) === "true", "checkout: invalid phone flagged");
  await page.fill("#coPhone", "+91 98765 43210");
  const minDate = await page.getAttribute("#coDate", "min");
  await page.fill("#coDate", "2020-01-01");
  await page.click('#coForm button[type="submit"]');
  ok((await page.getAttribute("#coDate", "aria-invalid")) === "true", "checkout: past date flagged");
  await page.fill("#coDate", minDate);
  await page.fill("#coNotes", "Less spicy please");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/checkout-details.png" });
  await page.click('#coForm button[type="submit"]');
  await page.waitForSelector("#coSend");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/checkout-review.png" });
  ok((await page.textContent("#checkoutBody")).includes("confirmed only after"), "review step says order is confirmed only after reply");
  await page.click("#coSend");
  const waUrl = (await page.evaluate(() => window.__wa)).pop();
  const msg = decodeURIComponent(new URL(waUrl).searchParams.get("text"));
  const expect = [
    "SUMATHI HOME FOODS - ORDER", "Customer: Test Customer", "Phone: 9876543210",
    "Delivery Address: 12, Temple Street, Sample Area 1, 600001", "ORDER DETAILS:",
    "- Murukku - 500g x 2 = ₹340", "- Laddu - 1kg x 1 = ₹400", "Subtotal: ₹740",
    "Discount (WELCOME10): -₹74", "Delivery: Free", "Total: ₹666", "Preferred Delivery Date:",
    "Notes: Less spicy please", "Please confirm my order.",
  ];
  const missingLines = expect.filter((l) => !msg.includes(l));
  ok(waUrl.startsWith("https://wa.me/") && missingLines.length === 0, "WhatsApp order message is complete and accurate", missingLines.join(" | "));
  console.log("\n----- order message -----\n" + msg + "\n-------------------------\n");
  ok((await page.textContent("#checkoutBody")).includes("not confirmed yet"), "sent screen does not claim confirmation");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/checkout-sent.png" });
  await page.click("#coDone");
  await page.waitForTimeout(400);
  ok((await cart()).count === 0, "finishing clears the cart");

  /* ---------- delivery checker section ---------- */
  const check = async (pin) => {
    await page.fill("#pincodeInput", pin);
    await page.click("#pincodeForm button");
    return page.textContent("#pincodeResult");
  };
  ok((await check("600002")).includes("Delivery Available"), "checker: served pincode → Delivery Available");
  await page.evaluate(() => SHF.cart.add("laddu", "1kg", 2));
  ok((await check("600002")).includes("Free Delivery Available"), "checker: big cart → Free Delivery Available");
  ok((await check("560001")).includes("Currently Outside Our Delivery Area"), "checker: unknown pincode → outside");
  ok((await check("12")).includes("valid 6-digit"), "checker: malformed pincode → validation message");
  await page.evaluate(() => SHF.cart.clear());

  /* ---------- product details modal ---------- */
  await page.click('.product-card[data-id="murukku"] .pc-title');
  await page.waitForSelector("#productDialog[open]");
  await page.click('#productDialog .pd-pack:has(input[value="1kg"])');
  await page.click('#productDialog [data-qty="1"]');
  ok((await page.textContent("#pdTotal")).includes("660"), "details modal: 1kg × 2 = ₹660");
  await page.click("#pdAdd");
  await page.waitForTimeout(300);
  ok((await cart()).subtotal === 660, "details modal adds to cart");
  await page.keyboard.press("Escape");

  /* ---------- global search ---------- */
  await page.click("#searchOpen");
  await page.fill("#globalSearch", "adhi");
  ok((await page.$$eval(".sr-item", (x) => x.length)) === 1, "global search finds Adhirasam");
  await page.click(".sr-item");
  await page.waitForSelector("#productDialog[open]");
  ok((await page.textContent("#pdTitle")) === "Adhirasam", "search result opens product details");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* ---------- bulk enquiry ---------- */
  await page.click('#bulkForm button[type="submit"]');
  ok((await page.$$eval('#bulkForm [aria-invalid="true"]', (x) => x.length)) >= 5, "bulk form: required fields flagged");
  ok((await page.textContent("#bProducts-err")).length > 0, "bulk form: product selection required");
  await page.fill("#bName", "Event Host");
  await page.fill("#bPhone", "9876500000");
  await page.selectOption("#bEvent", "Wedding");
  await page.fill("#bDate", await page.getAttribute("#bDate", "min"));
  await page.check('#bProducts input[value="Laddu"]');
  await page.check('#bProducts input[value="Murukku"]');
  await page.fill("#bQty", "10 kg laddu, 5 kg murukku");
  await page.fill("#bLocation", "Sample Hall, 600003");
  await page.fill("#bNotes", "Return-gift boxes of 250g");
  await page.click('#bulkForm button[type="submit"]');
  const bulk = decodeURIComponent(new URL((await page.evaluate(() => window.__wa)).pop()).searchParams.get("text"));
  const bulkExpect = ["BULK ORDER ENQUIRY", "Name: Event Host", "Event: Wedding", "- Murukku", "- Laddu", "Estimated Quantity: 10 kg laddu, 5 kg murukku", "Delivery Location: Sample Hall, 600003", "Additional Requirements: Return-gift boxes of 250g"];
  const bm = bulkExpect.filter((l) => !bulk.includes(l));
  ok(bm.length === 0, "bulk WhatsApp enquiry message is complete", bm.join(" | "));

  /* ---------- FAQ ---------- */
  await page.click("#faq-q-2");
  await page.waitForTimeout(350);
  ok((await page.getAttribute("#faq-q-2", "aria-expanded")) === "true" && (await page.isVisible("#faq-a-2")), "FAQ accordion expands");
  ok((await page.textContent("#faq-a-2")).includes("₹599"), "FAQ free-delivery answer uses config values");

  ok(errors.length === 0, "no JavaScript or network errors", errors.join(" | "));

  /* ---------- mobile ---------- */
  const m = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  await m.addInitScript(() => { window.open = () => ({}); });
  const mp = await m.newPage();
  await mp.goto(SITE, { waitUntil: "load" });
  await mp.click("#menuToggle");
  await mp.waitForTimeout(400);
  ok(await mp.isVisible('#primaryNav a[href="#bulk"]'), "mobile: hamburger opens menu");
  await mp.click('#primaryNav a[href="#bulk"]');
  await mp.waitForTimeout(600);
  ok((await mp.getAttribute("#menuToggle", "aria-expanded")) === "false", "mobile: tapping a link closes menu");
  await mp.evaluate(() => { SHF.cart.add("murukku", "500g", 2); SHF.cart.add("gulab-jamun", "500g", 1); });
  ok(await mp.isVisible("#mobileCartBar"), "mobile: bottom cart bar appears with items");
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 375, "mobile: no horizontal overflow", sw);
  if (SHOTS) {
    await mp.evaluate(() => document.getElementById("foods").scrollIntoView());
    await mp.waitForTimeout(900);
    await mp.screenshot({ path: SHOTS + "/mob-catalog.png" });
    await mp.click("#mobileCartBar");
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: SHOTS + "/mob-cart.png" });
    await mp.fill("#cartPin", "600001");
    await mp.click("#cartPinForm button");
    await mp.click("#checkoutBtn");
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: SHOTS + "/mob-checkout.png" });
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
