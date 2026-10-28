// Run: node scripts/generate-data.js
// Generates public/transactions.json with ~900 transactions including an embedded fraud pattern

const fs = require("fs");
const path = require("path");

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedChoice(options) {
  // options: [{ value, weight }]
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function uuid() {
  return "txn_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
}

// Regional payment methods
const paymentsByCountry = {
  Brazil: [
    { value: "Visa", weight: 30 },
    { value: "Mastercard", weight: 25 },
    { value: "PIX", weight: 30 },
    { value: "Boleto", weight: 15 },
  ],
  Mexico: [
    { value: "Visa", weight: 30 },
    { value: "Mastercard", weight: 25 },
    { value: "OXXO", weight: 25 },
    { value: "SPEI", weight: 20 },
  ],
  Colombia: [
    { value: "Visa", weight: 40 },
    { value: "Mastercard", weight: 35 },
    { value: "PIX", weight: 5 },
    { value: "Boleto", weight: 20 },
  ],
};

// Status distribution: ~70% Approved, ~15% Declined, ~10% Pending, ~5% Chargeback
const statusWeights = [
  { value: "approved", weight: 70 },
  { value: "declined", weight: 15 },
  { value: "pending", weight: 10 },
  { value: "chargeback", weight: 5 },
];

// Country distribution: Brazil most volume
const countryWeights = [
  { value: "Brazil", weight: 50 },
  { value: "Mexico", weight: 30 },
  { value: "Colombia", weight: 20 },
];

const categories = ["Electronics", "Clothing", "Accessories", "Home & Garden", "Beauty", "Sports"];
const bins = {
  Visa: ["411111", "431940", "400011", "426684"],
  Mastercard: ["510510", "542418", "555555", "520082"],
  PIX: ["000000"],
  Boleto: ["000000"],
  OXXO: ["000000"],
  SPEI: ["000000"],
};
const domains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "proton.me", "uol.com.br"];
const merchants = ["SHOP_BR_SP", "SHOP_BR_RJ", "SHOP_MX_CDMX", "SHOP_MX_GDL", "SHOP_CO_BOG"];

const now = new Date("2026-02-26T12:00:00Z");
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate realistic emails with some repeating (for velocity patterns)
const emailPool = [];
const firstNames = ["maria", "carlos", "ana", "jose", "pedro", "lucia", "juan", "sofia", "diego", "camila",
  "gabriel", "isabella", "mateo", "valentina", "santiago", "mariana", "daniel", "fernanda", "andres", "paula"];
for (let i = 0; i < 200; i++) {
  const name = randomChoice(firstNames);
  const num = randomInt(1, 999);
  emailPool.push(`${name}${num}@${randomChoice(domains)}`);
}

// Normal transactions: 850
const transactions = [];

for (let i = 0; i < 850; i++) {
  const country = weightedChoice(countryWeights);
  const paymentMethod = weightedChoice(paymentsByCountry[country]);
  const ts = randomDate(sevenDaysAgo, now);
  const status = weightedChoice(statusWeights);

  // Amount: $10-$800, most between $30-$200
  let amount;
  const r = Math.random();
  if (r < 0.7) {
    amount = randomFloat(30, 200); // 70% in $30-$200
  } else if (r < 0.9) {
    amount = randomFloat(200, 500); // 20% in $200-$500
  } else {
    amount = randomFloat(10, 800); // 10% full range
  }

  const bin = randomChoice(bins[paymentMethod] || ["000000"]);
  const cardLast4 = (paymentMethod === "Visa" || paymentMethod === "Mastercard")
    ? String(randomInt(1000, 9999))
    : "N/A";

  transactions.push({
    id: uuid(),
    timestamp: ts.toISOString(),
    amount,
    currency: "USD",
    country,
    paymentMethod,
    status,
    customerEmail: randomChoice(emailPool),
    cardLast4,
    cardBIN: bin,
    productCategory: randomChoice(categories),
    ipCountry: country, // normal: IP matches billing country
    merchantId: randomChoice(merchants),
  });
}

// === EMBEDDED FRAUD PATTERN ===
// 50 chargebacks from Brazil, Visa, Electronics, in a 2-hour window on Feb 24,
// high amounts ($400–$780), IP country mismatch (Nigeria, Russia, China)
// Same few emails repeating (velocity pattern)
const fraudStart = new Date("2026-02-24T02:00:00Z");
const fraudEnd = new Date("2026-02-24T04:00:00Z");
const fraudIPs = ["Nigeria", "Russia", "China"];
const fraudEmails = [
  "xbuyer_alpha@proton.me",
  "xbuyer_beta@proton.me",
  "xbuyer_gamma@proton.me",
  "fast.shopper88@gmail.com",
  "deal.hunter99@gmail.com",
];

for (let i = 0; i < 50; i++) {
  const ts = randomDate(fraudStart, fraudEnd);
  transactions.push({
    id: uuid(),
    timestamp: ts.toISOString(),
    amount: randomFloat(400, 780),
    currency: "USD",
    country: "Brazil",
    paymentMethod: "Visa",
    status: "chargeback",
    customerEmail: randomChoice(fraudEmails),
    cardLast4: String(randomInt(7000, 7099)), // clustered card range
    cardBIN: "411111",
    productCategory: "Electronics",
    ipCountry: randomChoice(fraudIPs), // MISMATCH — key fraud indicator
    merchantId: "SHOP_BR_SP",
  });
}

// Shuffle
transactions.sort(() => Math.random() - 0.5);

const outPath = path.join(__dirname, "..", "public", "transactions.json");
fs.writeFileSync(outPath, JSON.stringify(transactions, null, 2));
console.log(`Generated ${transactions.length} transactions → ${outPath}`);

// Print stats
const statuses = {};
const countries = {};
transactions.forEach((t) => {
  statuses[t.status] = (statuses[t.status] || 0) + 1;
  countries[t.country] = (countries[t.country] || 0) + 1;
});
console.log("Status distribution:", statuses);
console.log("Country distribution:", countries);
