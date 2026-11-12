/* =====================================================================
   SUMATHI HOME FOODS — BUSINESS CONFIGURATION
   ---------------------------------------------------------------------
   This is the ONE place to edit business details. Everything marked
   PLACEHOLDER / SAMPLE must be replaced with real information before
   the site goes live. No other file needs to change for these values.

   Next.js migration: this object maps 1:1 to `lib/config.js`
   (or a CMS / database "settings" record).
   ===================================================================== */

window.SHF = window.SHF || {};

window.SHF.config = {
  business: {
    name: "Sumathi Home Foods",
    tagline: "Homemade with Love, Delivered with Care.",
    // PLACEHOLDER — replace every value below with the real details.
    phoneDisplay: "+91 00000 00000",
    phoneHref: "+910000000000",
    // WhatsApp number in international format, digits only (country code + number).
    whatsappNumber: "910000000000",
    whatsappIsPlaceholder: true, // set to false once the real number is in place
    email: "hello@example.com",
    // Where food is prepared / pickup point. Shown in the footer and contact section.
    address: "Home kitchen address — to be confirmed",
    city: "Your City, Tamil Nadu",
    timings: [
      { days: "Monday – Saturday", hours: "9:00 AM – 7:00 PM" },
      { days: "Sunday", hours: "Pre-booked orders only" },
    ],
    social: {
      instagram: "https://instagram.com/", // PLACEHOLDER
      facebook: "",                         // leave empty to hide
    },
    siteUrl: "https://example.com", // used for Open Graph tags after launch
  },

  currency: { symbol: "₹", locale: "en-IN" },

  /* ------------------------------------------------------------------
     DELIVERY — every number here is a SAMPLE until the business confirms.
     Charge rules (applied in js/delivery.js):
       1. Subtotal below `minOrder`                → checkout blocked.
       2. Pincode not in any zone                  → outside delivery area.
       3. Subtotal ≥ zone.freeAbove                → free delivery.
       4. Otherwise                                → zone.charge.
     ------------------------------------------------------------------ */
  delivery: {
    minOrder: 250,
    // Charge used in the cart before the customer has entered a pincode.
    defaultCharge: 40,
    defaultFreeAbove: 999,
    zones: [
      {
        id: "nearby",
        name: "Nearby areas",
        description: "Within about 3 km of our kitchen",
        // SAMPLE PINCODES — replace with the real ones.
        pincodes: ["600001", "600002", "600003"],
        areas: ["Sample Area 1", "Sample Area 2", "Sample Area 3"],
        charge: 30,
        freeAbove: 599,
        eta: "Same day for orders placed before 12 noon",
      },
      {
        id: "town",
        name: "Across town",
        description: "About 3 – 8 km from our kitchen",
        pincodes: ["600004", "600005", "600006", "600007"],
        areas: ["Sample Area 4", "Sample Area 5", "Sample Area 6", "Sample Area 7"],
        charge: 50,
        freeAbove: 999,
        eta: "Next day",
      },
      {
        id: "extended",
        name: "Extended area",
        description: "8 – 15 km, delivered on fixed days",
        pincodes: ["600008", "600009"],
        areas: ["Sample Area 8", "Sample Area 9"],
        charge: 80,
        freeAbove: 1499,
        eta: "1 – 2 days",
      },
    ],
    // Earliest delivery date offered in checkout = today + this many days.
    prepDays: 1,
    timeSlots: ["Morning (9 AM – 12 PM)", "Afternoon (12 – 4 PM)", "Evening (4 – 7 PM)"],
  },

  bulk: {
    // How many days ahead a bulk order should be placed (used for the date picker + FAQ).
    leadDays: 5,
    eventTypes: [
      "Wedding",
      "Birthday celebration",
      "Family function",
      "Festival",
      "Corporate event",
      "Religious function",
      "Return gifts",
      "Other",
    ],
  },

  /* DEMO discount codes. Clearly not real offers — remove or replace
     before launch. Set `enabled: false` to hide the discount field. */
  discounts: {
    enabled: true,
    codes: {
      WELCOME10: { type: "percent", value: 10, minSubtotal: 500, label: "10% off (demo code)" },
      FESTIVE50: { type: "flat", value: 50, minSubtotal: 800, label: "₹50 off (demo code)" },
    },
  },

  storageKeys: {
    cart: "shf_cart_v1",
    discount: "shf_discount_v1",
    customer: "shf_customer_v1",
  },
};
