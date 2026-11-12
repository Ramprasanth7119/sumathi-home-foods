/* =====================================================================
   PRODUCT CATALOGUE
   ---------------------------------------------------------------------
   ⚠ ALL PRICES ARE SAMPLE VALUES — replace with the real price list.

   Fields
     id           unique, URL-safe (also used as the cart key prefix)
     name         display name
     nameTa       Tamil name (optional, shown as a small label)
     category     "snacks" | "sweets"
     festival     true → also listed under "Festival Specials"
     short        one-line description (product card)
     description  longer text for the details popup
     image        base path WITHOUT size/extension; the site loads
                  `${image}-480.webp`, `${image}-960.webp` and `${image}-960.jpg`
     alt          meaningful alt text for the photo
     packs        [{ size, grams, price }] — price in INR, per pack
     available    false → card shows "Currently unavailable", no add-to-cart
     popularity   higher = shown first when sorting by "Popularity" (sample ranking)

   Next.js migration: move this array to `data/products.js` or a database
   table; the shape is already JSON-friendly.
   ===================================================================== */

window.SHF = window.SHF || {};

window.SHF.categories = [
  {
    id: "snacks",
    title: "Traditional Snacks",
    text: "Crisp, savoury favourites for tea time, travel and every evening craving.",
    image: "assets/images/cat-snacks",
    alt: "Golden spirals of homemade murukku piled together",
    filter: "snacks",
  },
  {
    id: "sweets",
    title: "Homemade Sweets",
    text: "Laddus, jamuns and adhirasam made in small batches, the traditional way.",
    image: "assets/images/cat-sweets",
    alt: "Gulab jamun served in a bowl",
    filter: "sweets",
  },
  {
    id: "festival",
    title: "Festival Specials",
    text: "Deepavali, Pongal and every celebration — the sweets and snacks families wait for.",
    image: "assets/images/cat-festival",
    alt: "A festive plate of assorted Indian sweets and snacks",
    filter: "festival",
  },
  {
    id: "bulk",
    title: "Bulk & Function Orders",
    text: "Weddings, functions and return gifts, prepared to your quantity and date.",
    image: "assets/images/cat-bulk",
    alt: "Steel vessels filled with homemade laddus and snacks for a function",
    href: "#bulk",
  },
];

window.SHF.products = [
  {
    id: "murukku",
    name: "Murukku",
    nameTa: "முறுக்கு",
    category: "snacks",
    festival: true,
    short: "Traditional crispy homemade murukku",
    description:
      "Hand-pressed spirals fried until golden and crisp. A tea-time essential and a must on every festival plate — made in small batches so every piece stays crunchy.",
    image: "assets/images/murukku",
    alt: "Close-up of golden, crispy homemade murukku spirals",
    packs: [
      { size: "250g", grams: 250, price: 90 },
      { size: "500g", grams: 500, price: 170 },
      { size: "1kg", grams: 1000, price: 330 },
    ],
    available: true,
    popularity: 98,
  },
  {
    id: "boondhi",
    name: "Boondhi",
    nameTa: "பூந்தி",
    category: "sweets",
    festival: false,
    short: "Fresh traditional sweet boondhi",
    description:
      "Tiny golden pearls of sweet boondhi, soft and fragrant. Lovely on its own, as a prasadam offering, or alongside a spicy snack.",
    image: "assets/images/boondhi",
    alt: "A bowl of bright golden sweet boondhi",
    packs: [
      { size: "250g", grams: 250, price: 80 },
      { size: "500g", grams: 500, price: 150 },
      { size: "1kg", grams: 1000, price: 290 },
    ],
    available: true,
    popularity: 72,
  },
  {
    id: "laddu",
    name: "Laddu",
    nameTa: "லட்டு",
    category: "sweets",
    festival: true,
    short: "Homemade traditional laddu",
    description:
      "Hand-rolled laddus that hold together perfectly and melt as you bite. The sweet that says celebration — for festivals, functions and good news.",
    image: "assets/images/laddu",
    alt: "Close-up of freshly made laddus piled on a tray",
    packs: [
      { size: "250g", grams: 250, price: 110 },
      { size: "500g", grams: 500, price: 210 },
      { size: "1kg", grams: 1000, price: 400 },
    ],
    available: true,
    popularity: 95,
  },
  {
    id: "mixture",
    name: "Mixture",
    nameTa: "மிக்சர்",
    category: "snacks",
    festival: false,
    short: "Crunchy spicy homemade mixture",
    description:
      "A crunchy, well-spiced mix of savoury bits — the snack you keep reaching for. Perfect with evening tea or packed for a journey.",
    image: "assets/images/mixture",
    alt: "A bowl of crunchy spicy mixture snack",
    packs: [
      { size: "250g", grams: 250, price: 80 },
      { size: "500g", grams: 500, price: 150 },
      { size: "1kg", grams: 1000, price: 290 },
    ],
    available: true,
    popularity: 90,
  },
  {
    id: "adhirasam",
    name: "Adhirasam",
    nameTa: "அதிரசம்",
    category: "sweets",
    festival: true,
    short: "Traditional jaggery-based sweet",
    description:
      "The festival classic: a jaggery-based sweet with crisp edges and a soft, chewy centre. Patiently made the traditional way, the way it has always been made at home.",
    image: "assets/images/adhirasam",
    alt: "Homemade adhirasam arranged on a festive plate",
    packs: [
      { size: "250g", grams: 250, price: 120 },
      { size: "500g", grams: 500, price: 230 },
      { size: "1kg", grams: 1000, price: 440 },
    ],
    available: true,
    popularity: 80,
  },
  {
    id: "rava-laddu",
    name: "Rava Laddu",
    nameTa: "ரவா லட்டு",
    category: "sweets",
    festival: true,
    short: "Delicious homemade rava laddu",
    description:
      "Fragrant rava laddus, freshly rolled by hand. Light, aromatic and easy to love — a favourite with children and grandparents alike.",
    image: "assets/images/rava-laddu",
    alt: "Homemade rava laddus on a plate",
    packs: [
      { size: "250g", grams: 250, price: 100 },
      { size: "500g", grams: 500, price: 190 },
      { size: "1kg", grams: 1000, price: 370 },
    ],
    available: true,
    popularity: 76,
  },
  {
    id: "gulab-jamun",
    name: "Gulab Jamun",
    nameTa: "குலாப் ஜாமூன்",
    category: "sweets",
    festival: false,
    short: "Soft, syrup-filled sweet",
    description:
      "Soft, melt-in-the-mouth jamuns soaked in warm syrup. Packed with syrup in a sealed container so they reach you just as soft as they left our kitchen.",
    image: "assets/images/gulab-jamun",
    alt: "Two soft gulab jamuns in syrup on a plate",
    packs: [
      { size: "500g", grams: 500, price: 200 },
      { size: "1kg", grams: 1000, price: 380 },
    ],
    available: true,
    popularity: 88,
  },
];
