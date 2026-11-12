# Sumathi Home Foods

**Homemade with Love, Delivered with Care.**

A website for a home kitchen that makes traditional Indian snacks and sweets (murukku, laddu, mixture, adhirasam, gulab jamun and more) and delivers to nearby areas. It is built with plain HTML, CSS and JavaScript: no framework and no build step. Customers place orders on WhatsApp.

> ⚠️ **Prototype with sample data.** Prices, delivery areas, pincodes, phone/WhatsApp number, address, reviews and photos are placeholders. See [Before launch](#before-launch).

## Run locally

Any static file server works. Pick one:

```bash
cd sumathi-home-foods
python -m http.server 5173        # then open http://localhost:5173
# or
npx serve .                         # or VS Code "Live Server"
```

Opening `index.html` directly from disk also mostly works. Use a server anyway, because some browsers restrict `localStorage` on `file://` pages.

## Project structure

```
index.html            all page sections + dialogs (product, cart drawer, checkout, search)
css/style.css         design tokens, components, layout (mobile-first)
css/responsive.css    breakpoints 380 / 600 / 760 / 900 / 981 / 1200
css/animations.css    reveal, hero float, dialogs; all off under prefers-reduced-motion
js/config.js          ← ALL business settings (edit this)
js/products.js        ← product catalogue + categories (edit this)
js/utils.js           money format, safe storage, dialogs, toasts, WhatsApp link, validation
js/delivery.js        delivery pricing rules + pincode checker
js/cart.js            cart state, localStorage persistence, totals, cart drawer
js/checkout.js        details → review → WhatsApp order message
js/bulk-orders.js     bulk enquiry form → WhatsApp message
js/main.js            catalogue, filters/sort/search, product modal, FAQ, nav, hero 3D
assets/images/        product photos (480/960 px, WebP + JPG fallback)
tests/e2e.js          end-to-end test of the full customer journey (54 checks)
CREDITS.md            photo attributions (required by the CC licences)
```

## Configurable business details

Everything lives in **`js/config.js`**, so no other file needs editing:

| Setting | Key |
|---|---|
| Business name, tagline | `business.name`, `business.tagline` |
| Phone (display + dial) | `business.phoneDisplay`, `business.phoneHref` |
| WhatsApp number (digits, with 91) | `business.whatsappNumber` → then set `whatsappIsPlaceholder: false` |
| Email, address, city | `business.email`, `business.address`, `business.city` |
| Business timings | `business.timings` |
| Instagram / Facebook | `business.social` |
| Minimum order value | `delivery.minOrder` |
| Delivery zones: pincodes, area names, charge, free-delivery threshold, ETA | `delivery.zones[]` |
| Charge shown before a pincode is entered | `delivery.defaultCharge`, `delivery.defaultFreeAbove` |
| Earliest delivery date (days from today) | `delivery.prepDays` |
| Delivery time slots | `delivery.timeSlots` |
| Bulk-order notice period, event types | `bulk.leadDays`, `bulk.eventTypes` |
| Discount codes (demo: `WELCOME10`, `FESTIVE50`) | `discounts` (set `enabled: false` to hide) |

Products, prices and pack sizes are in **`js/products.js`**. Set `available: false` to mark an item out of stock.

**Delivery rules** (in `js/delivery.js → quote()`):
1. Subtotal below `minOrder` → checkout blocked.
2. Pincode not in any zone → "Currently Outside Our Delivery Area", checkout blocked.
3. Subtotal (after discount) ≥ zone `freeAbove` → free delivery.
4. Otherwise → the zone's `charge`.

## External dependencies (CDN)

| Dependency | Use |
|---|---|
| Google Fonts: **Fraunces** (display), **Manrope** (body) | Typography |

That is the only one. Icons are an inline SVG sprite built from Lucide's paths (ISC licence), so there is no icon CDN. The 3D hero is pure CSS 3D (`perspective`, `preserve-3d`, `translateZ`) with a small pointer-tilt script. **Three.js was not used on purpose:** a ~600 KB WebGL library would slow down mid-range phones without making the food look better. Real photos on a CSS-3D brass thali give depth with almost no runtime cost. `assets/models/` is kept for the future if a real 3D asset is ever wanted.

## Ordering flow

Browse → choose pack size + quantity → add to cart → enter pincode (live delivery charge and free-delivery progress) → checkout details (validated) → review → **Place Order on WhatsApp**. WhatsApp opens with a formatted message:

```
SUMATHI HOME FOODS - ORDER

Customer: Test Customer
Phone: 9876543210
Delivery Address: 12, Temple Street, Sample Area 1, 600001

ORDER DETAILS:
- Murukku - 500g x 2 = ₹340
- Laddu - 1kg x 1 = ₹400

Subtotal: ₹740
Discount (WELCOME10): -₹74
Delivery: Free
Total: ₹666

Preferred Delivery Date: Fri, 13 Nov, 2026
Preferred Time: Morning (9 AM – 12 PM)
Notes: Less spicy please

Please confirm my order.
```

The site **never claims an order is confirmed.** The review and "sent" screens say the order is confirmed only after the business replies. The cart is cleared only when the customer says they have sent the message.

## Testing

`tests/e2e.js` drives a real Chromium through the whole journey using the sample data:

```bash
python -m http.server 5173 &
npm i -D playwright-core && npx playwright install chromium
node tests/e2e.js
```

**Last run: 54 passed, 0 failed.** It covers:

- Every in-page nav link has a target; all images load; every `<img>` has `alt`
- Filters (All / Snacks / Sweets / Festival), search, empty state, all three sorts
- Pack-size pricing on cards, in the cart and in the product popup
- Cart add / step up / step down / change size; badge count
- Minimum order block; default estimate; nearby, across-town and outside-area pincodes; free-delivery threshold
- Discount codes: invalid rejected, valid applied, recomputed against delivery
- Cart, discount code and pincode persist after refresh
- Checkout validation (name, phone, past date); review screen; exact WhatsApp message contents; no false confirmation; cart cleared on finish
- Delivery checker: available / free / outside / malformed
- Global search → product popup
- Bulk form validation + exact WhatsApp enquiry message
- FAQ accordion; answers pull live values from config
- Mobile (375 px): hamburger opens/closes, bottom cart bar, no horizontal overflow
- No JavaScript errors and no failed network requests

Also checked manually from screenshots at 1440 px and 390 px.

## Before launch

1. Real **WhatsApp number** and phone; set `whatsappIsPlaceholder: false`.
2. Real **kitchen / pickup address** and **timings**.
3. Real **delivery pincodes and area names**, charges, free-delivery thresholds and ETAs.
4. Real **prices and pack sizes**; remove the "Sample prices" note in `index.html`.
5. **Own product photos.** The current ones are Wikimedia Commons stand-ins (see `CREDITS.md`). Export 480 px and 960 px versions as WebP + JPG with the same names.
6. Replace or remove the **demo discount codes**.
7. Replace the **sample reviews** in `js/main.js → SAMPLE_REVIEWS` with genuine ones (and remove the sample banner), or remove the section.
8. Replace the **About story** and the placeholder quote with Sumathi's own words.
9. Confirm **shelf life / storage** text in the product popup.
10. Update `canonical`, `og:image` (absolute URL) and `business.siteUrl` once the domain is known.

## Known limitations

- No backend. Orders exist only as WhatsApp messages, so there is no order history, stock tracking or payment.
- Pincode matching is exact, with no geolocation or distance calculation.
- Prices in the WhatsApp message are computed in the browser. The business should check totals when confirming (a backend would re-price on the server).
- Contact details and FAQ are rendered by JavaScript, so search engines that don't run JS see less text. This goes away with server rendering in Next.js.
- The floating labels and some styling use modern CSS (`:has()`, individual `translate`/`scale`, `popover`). Older browsers degrade gracefully but lose a few touches.

## Migrating to Next.js later

The code is organised so the UI does not need to be redesigned:

| Now | Next.js App Router |
|---|---|
| `js/config.js`, `js/products.js` | `lib/config.js`, `data/products.js` → later a database / CMS |
| `delivery.quote()`, `cart.totals()`, `buildOrderMessage()`, `buildBulkMessage()` | Pure functions; move them to `lib/` unchanged and reuse them on the server to re-price orders |
| `render*` / `productCard()` in `main.js` | `<CategoryGrid>`, `<ProductCard>`, `<ProductModal>`, `<FAQ>` components |
| Cart module + `localStorage` | React context or Zustand store with the same persistence |
| `css/*.css` + `:root` tokens | Global CSS / CSS Modules; tokens carry over as-is |
| `<dialog>` modals | Keep native `<dialog>` inside client components |

Suggested next steps: an orders table plus an API route that saves each order before opening WhatsApp, a small admin dashboard (orders, stock, prices, zones), UPI payment links, and real photos served through `next/image`.
