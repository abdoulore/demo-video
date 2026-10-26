// Tandem pitch video (Stocklana, 2026-09-25): 2:15, 11 scenes, ElevenLabs "Brian". The worked example.
// Shows every scene type: logo intro, title cards, the live app with zooms, spotlights and labels, a third-party
// page (Solscan) with its ads hidden and its targets tagged in setup(), and the end card.
// vars.X is OpenAI's premium to its mark in %, read from the live API just before shooting.

const BASE = "https://tandem.moonrider.online";

const tile = (name) => ({ sel: ".tile", text: name });
const pm = (name) => ({ sel: ".pm-card", text: name });
const switched = { sel: ".card.intent", text: "Switched" };

const scenes = (X) => [
  {
    id: "s00-intro",
    kind: "card",
    card: ["intro"],
    min: 4600,
    lines: [{ id: "L00", text: "This is Tandem." }],
  },
  {
    id: "s01-landing",
    kind: "page",
    url: `${BASE}/`,
    ready: ".tiles .tile:not(.skeleton)",
    lines: [
      {
        id: "L01",
        text: "Tokenized pre-IPO shares like OpenAI, Anthropic and SpaceX now trade on Solana, and their prices drift apart, both from each other and from their private-market marks.",
        async act(k) {
          await k.sleep(900);
          await k.cursorTo({ sel: ".hero h1" }, { ms: 900, dx: 220, dy: 40 });
          await k.scrollTo(".tiles", { ms: 2200, at: 0.34 });
          await k.cursorTo(tile("OpenAI"), { ms: 800 });
          await k.cursorTo(tile("Anthropic"), { ms: 800 });
          await k.cursorTo(tile("SpaceX"), { ms: 800 });
        },
      },
      {
        id: "L02",
        text: `Right now OpenAI trades about ${X}% above its mark.`,
        async act(k) {
          await k.cursorTo(tile("OpenAI"), { ms: 500 });
          await k.zoomTo(tile("OpenAI"), { scale: 2.1, ms: 1200 });
          await k.label({ sel: ".tile", text: "OpenAI" }, "Token price vs PreStocks mark", { side: "top" });
        },
      },
    ],
    async end(k) {
      k.labelsOff();
    },
  },
  {
    id: "s02-markets",
    kind: "page",
    url: `${BASE}/app/markets`,
    ready: ".pm-card .pm-facts",
    lines: [
      {
        id: "L03",
        text: "If you hold one of these and want to rotate into another when the relationship moves your way, you're stuck watching two prices all day.",
        async act(k) {
          await k.sleep(700);
          await k.cursorTo(pm("OpenAI"), { ms: 800 });
          await k.zoomTo(pm("OpenAI"), { scale: 1.7, ms: 1100 });
          await k.cursorTo({ sel: ".pm-card .pm-prem", text: "" }, { ms: 600 });
          await k.sleep(700);
          await k.zoomTo(pm("Anthropic"), { scale: 1.7, ms: 1100 });
          await k.cursorTo(pm("Anthropic"), { ms: 600, dy: -40 });
        },
      },
      {
        id: "L04",
        text: "Then you make two trades, with price risk in between, and pay a 1% transfer fee along the way.",
        async act(k) {
          await k.zoomOut(900);
          await k.spotlight({ sel: ".page-head" }, { pad: 16 });
          await k.cursorTo({ sel: ".page-head .muted" }, { ms: 700 });
        },
      },
      {
        id: "L05",
        text: "So most people don't.",
        async act(k) {
          k.spotOff();
        },
      },
    ],
  },
  {
    id: "s03-fix",
    kind: "card",
    card: ["title", { kicker: "The fix", title: "A *standing* order between two assets." }],
    min: 3600,
    lines: [{ id: "L06", text: "Tandem is a standing order between two assets." }],
  },
  {
    id: "s04-builder",
    kind: "page",
    url: `${BASE}/app`,
    ready: ".plan.four:not(.stale) .v",
    lines: [
      {
        id: "L07",
        text: "You pick the pair and the condition, and Tandem reads it back in plain words.",
        async act(k) {
          await k.sleep(800);
          await k.cursorTo("#from", { ms: 800 });
          await k.cursorTo("#to", { ms: 700 });
          await k.cursorTo("#amount", { ms: 700 });
          await k.cursorTo(".pct-input", { ms: 700 });
        },
      },
      {
        id: "L08",
        text: "Move $100 of OpenAI into Anthropic when Anthropic becomes 10% cheaper relative to OpenAI.",
        async act(k) {
          await k.zoomTo(".summary-line", { fit: 0.9, max: 1.7, ms: 1200 });
          await k.cursorTo(".summary-line p", { ms: 600, dx: 160 });
        },
      },
      {
        id: "L09",
        text: "It shows where it fires, what the route costs including PreStocks fees, and what you'd receive.",
        async act(k) {
          await k.zoomTo(".plan.four", { fit: 0.92, max: 1.6, ms: 1100 });
          await k.spotlight({ sel: ".plan.four > div", nth: 0 }, { pad: 0, radius: 6 });
          await k.cursorTo({ sel: ".plan.four > div", nth: 0 }, { ms: 500 });
          await k.sleep(700);
          await k.spotlight({ sel: ".plan.four > div", nth: 1 }, { pad: 0, radius: 6 });
          await k.cursorTo({ sel: ".plan.four > div", nth: 1 }, { ms: 500 });
          await k.sleep(1100);
          await k.spotlight({ sel: ".plan.four > div", nth: 3 }, { pad: 0, radius: 6 });
          await k.cursorTo({ sel: ".plan.four > div", nth: 3 }, { ms: 600 });
        },
      },
      {
        id: "L10",
        text: "Nothing moves until every check passes: fresh marks, premium to mark, token state, slippage after fees.",
        async act(k) {
          k.spotOff();
          await k.zoomOut(800);
          await k.zoomTo("aside.card", { fit: 0.86, max: 1.5, ms: 1100, dy: -80 });
          await k.click({ sel: ".check-group summary", nth: 0 }, { ms: 600 });
          await k.sleep(1400);
          await k.cursorTo({ sel: ".check-group summary", nth: 1 }, { ms: 600 });
          await k.cursorTo({ sel: ".check-group summary", nth: 2 }, { ms: 600 });
        },
      },
    ],
    async end(k) {
    },
  },
  {
    id: "s05-once",
    kind: "card",
    card: ["title", { kicker: "Hands-free", title: "Set it once. Tandem *watches.*" }],
    min: 3600,
    lines: [{ id: "L11", text: "Set it once, and Tandem watches around the clock." }],
  },
  {
    id: "s06-switches",
    kind: "page",
    url: `${BASE}/app/switches?tab=closed`,
    ready: ".card.intent",
    setup() {
      // Show only the real mainnet switch; the header line is about paper switches, which this view isn't.
      document.querySelectorAll(".card.intent").forEach((c) => {
        if (!c.innerText.includes("Switched")) c.style.display = "none";
      });
      const p = document.querySelector(".page-head p");
      if (p) p.style.visibility = "hidden";
    },
    lines: [
      { id: "L12", text: "Your tokens stay in your wallet.", async act(k) {
          await k.sleep(800);
          await k.cursorTo({ ...switched }, { ms: 900, dy: -60 });
        } },
      {
        id: "L13",
        text: "When the condition holds, Tandem messages you on Telegram, you confirm in one tap, and it switches in a single transaction routed by Jupiter.",
        async act(k) {
          await k.spotlight(".alerts-row", { pad: 8 });
          await k.cursorTo(".alerts-row", { ms: 700, dx: -300 });
          await k.sleep(2200);
          k.spotOff();
          await k.zoomTo(switched, { fit: 0.9, max: 1.6, ms: 1100 });
          await k.cursorTo({ sel: ".card.intent .badge", text: "Switched" }, { ms: 700 });
        },
      },
      {
        id: "L14",
        text: "Every switch ends with a receipt explaining why it executed.",
        async act(k) {
          await k.zoomOut(700);
          await k.click({ sel: ".card.intent button", text: "Receipt" }, { ms: 600 });
          await k.sleep(500);
          await k.zoomTo(".receipt", { fit: 0.9, max: 1.5, ms: 1100 });
        },
      },
    ],
    async end(k) {
    },
  },
  {
    id: "s07-proof",
    kind: "card",
    card: ["title", { kicker: "Proof", title: "Live on Solana *mainnet.*" }],
    min: 3400,
    lines: [{ id: "L15", text: "This is a real switch on Solana mainnet." }],
  },
  {
    id: "s08-solscan",
    kind: "page",
    url: "https://solscan.io/tx/2LxBEz5pmcL9BZkjmuYY3xVtZ5ZieLm9jNZUv4AEU3c4QPtbnwY65XbzRk6HdLLWoBConUiEmrEnZntfDraCEfvJ",
    external: true,
    setup() {
      const hide = (el) => el && (el.style.display = "none");
      const w = document.getElementById("c_widget_es");
      if (w) {
        let a = w;
        for (let i = 0; i < 4 && a.parentElement; i++) a = a.parentElement;
        if (a.getBoundingClientRect().height < 60) hide(a);
      }
      for (const e of document.querySelectorAll("#top-tx-overview *"))
        if (e.children.length < 3 && e.textContent.trim() === "Sponsored") hide(e.closest(".flex-wrap"));
      document.querySelectorAll("iframe, [id^=sevio]").forEach(hide);
      const leaf = (t) => [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && e.textContent.trim() === t && e.getBoundingClientRect().width > 0);
      let s = leaf("Summary");
      while (s && s.getBoundingClientRect().height < 40) s = s.parentElement;
      s?.setAttribute("data-kit", "summary");
      document.querySelector("button[id$=\"-trigger-summary\"]")?.closest(".rounded-lg")?.setAttribute("data-kit", "actions");
      leaf("Fee")?.closest(".flex-wrap")?.setAttribute("data-kit", "fee");
    },
    lines: [
      {
        id: "L16",
        text: "It belongs on Solana. This is where tokenized private and public stocks trade.",
        async act(k) {
          await k.sleep(800);
          await k.zoomTo("[data-kit=summary]", { fit: 0.96, max: 1.5, ms: 1200 });
          await k.cursorTo("[data-kit=summary]", { ms: 800, dx: -260 });
          await k.label("[data-kit=summary]", "Tandem's live switch, settled on mainnet", { side: "bottom" });
        },
      },
      {
        id: "L17",
        text: "Jupiter routed OpenAI into Anthropic through three pools, in one atomic transaction.",
        async act(k) {
          k.labelsOff();
          await k.zoomTo("[data-kit=actions]", { fit: 0.9, max: 1.7, ms: 1100 });
          await k.spotlight("[data-kit=actions]", { pad: 6 });
          await k.cursorTo("[data-kit=actions]", { ms: 600, dy: -10 });
          await k.cursorTo("[data-kit=actions]", { ms: 600, dy: 30 });
          await k.cursorTo("[data-kit=actions]", { ms: 600, dy: 65 });
        },
      },
      {
        id: "L18",
        text: "And fees are low enough that rotating a hundred dollars makes sense.",
        async act(k) {
          k.spotOff();
          await k.zoomTo("[data-kit=fee]", { scale: 1.8, dx: -260, ms: 1100 });
          await k.label("[data-kit=fee]", "About $0.001 in network fees", { side: "bottom" });
          await k.cursorTo("[data-kit=fee]", { ms: 600, dx: -330 });
        },
      },
    ],
    async end(k) {
      k.labelsOff();
    },
  },
  {
    id: "s09-coverage",
    kind: "page",
    url: `${BASE}/`,
    ready: ".coverage .pill",
    scroll: ".coverage",
    scrollAt: 0.3,
    lines: [
      {
        id: "L19",
        text: "Tandem covers all 8 PreStocks companies and 13 public stocks, including mixed pairs like Tesla into SpaceX.",
        async act(k) {
          await k.sleep(800);
          await k.zoomTo({ sel: ".coverage > div", nth: 0 }, { fit: 0.9, max: 1.7, ms: 1100 });
          await k.cursorTo({ sel: ".coverage .pill", text: "SpaceX" }, { ms: 700 });
          await k.zoomTo({ sel: ".coverage > div", nth: 1 }, { fit: 0.9, max: 1.7, ms: 1100 });
          await k.cursorTo({ sel: ".coverage .pill", text: "TSLA" }, { ms: 700 });
        },
      },
    ],
    async end(k) {
    },
  },
  {
    id: "s10-end",
    kind: "card",
    card: ["end"],
    min: 6500,
    lines: [{ id: "L20", text: "Try it in paper mode, no wallet needed, at tandem.moonrider.online.", say: "Try it in paper mode, no wallet needed, at tandem dot moonrider dot online." }],
  },
];

module.exports = {
  out: { dir: "C:/Users/DELL/Videos/Tandem", name: "Tandem-pitch" },
  env: "C:/Users/DELL/Documents/Solhack/.env",
  voice: { prefer: ["Brian"] },
  music: true,
  theme: { canvas: "#0b0d12", accent: "#2456e8", accent2: "#6a8cf7", font: "Geist" },
  stage: {
    name: "Tandem",
    tagline: "Switch when the relationship is right, not just the price.",
    logo: `<svg viewBox="0 0 64 64"><rect class="a" x="9" y="12" width="21" height="11" rx="5.5"/><rect class="b" x="34" y="12" width="21" height="11" rx="5.5" fill-opacity="0.45"/><rect class="c" x="26.5" y="27" width="11" height="26" rx="5.5"/></svg>`,
    end: { line: "Try it in paper mode. No wallet needed.", links: [["Live app", "tandem.moonrider.online"], ["Code", "github.com/abdoulore/Tandem"]] },
  },
  // Loads the real mainnet switch into My switches without a wallet (the app also lists switches for this id).
  browser: { localStorage: { "tandem.guest": "8wJa1MgQkSx7c7wvTGtw4aegvnn3aAcYtQukdmNNr6zo" } },
  vars: { X: 30 },
  scenes: (v) => scenes(v.X),
};
