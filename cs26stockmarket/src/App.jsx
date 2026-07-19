import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { storage } from "./storage";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell, ResponsiveContainer, YAxis, Tooltip,
} from "recharts";
import {
  TrendingUp, TrendingDown, LogOut, Lock, User, Plus, Newspaper,
  ArrowUpRight, ArrowDownRight, ArrowLeft, Wallet, LayoutGrid, History, ShieldCheck,
  Trophy, Rocket, Zap, X, Users, KeyRound, Trash2, RefreshCw, Layers, ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Palette / tokens — dark, greyish-blue, minimal
// ---------------------------------------------------------------------------
const C = {
  bg: "#0A0D13",
  bgAlt: "#0D1119",
  panel: "#121722",
  panel2: "#1A2130",
  panelHover: "#161C29",
  border: "#212936",
  borderSoft: "#1A212C",
  text: "#EEF1F6",
  textDim: "#8D96A8",
  textFaint: "#54607A",
  blue: "#5B8CFF",
  blueBright: "#7BA1FF",
  blueDim: "#1B2740",
  green: "#22C55E",
  greenBright: "#34D976",
  greenDim: "#122A1B",
  red: "#EF4444",
  redBright: "#FF5D5D",
  redDim: "#2C1517",
};

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); body{margin:0;} ::-webkit-scrollbar{width:8px;height:8px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#232C3B;border-radius:8px;} ::-webkit-scrollbar-thumb:hover{background:#2D3849;}";

const CURRENCY = "\u20B9";
const APP_NAME = "The Stock Market";

// ---------------------------------------------------------------------------
// Owner credential (fixed) — trader credentials are owner-managed & dynamic
// ---------------------------------------------------------------------------
const OWNER_CREDENTIAL = { password: "owner123", role: "owner", label: "Owner" };
const DEFAULT_TRADERS = [
  { id: "trader1", username: "trader1", password: "trader123", label: "Trader 1" },
];

// ---------------------------------------------------------------------------
// Simulation constants
// ---------------------------------------------------------------------------
const DEFAULT_TOTAL_SHARES = 1000;

// Trader buy/sell orders nudge the price a little, like real order flow.
const TRADE_IMPACT_MULTIPLIER = 1.5; // % move per 1% of float traded
const TRADE_IMPACT_MAX = 6; // cap per single order, in %

// Automatic market drift — runs on its own, independent of trades/owner.
const AUTO_FLUCT_CHECK_MS = 5000; // how often clients check if a drift is due
const AUTO_FLUCT_INTERVAL_MS = 20000; // how often a drift actually happens
const DEFAULT_META = { autoFluctuate: true, volatility: 1.5, lastFluctuation: 0 };
const VOLATILITY_OPTIONS = [
  { label: "Low", value: 0.75 },
  { label: "Medium", value: 1.5 },
  { label: "High", value: 3 },
];

const MARKET_EVENTS = [
  { label: "Government subsidy", pct: 8 },
  { label: "Successful product launch", pct: 6 },
  { label: "Positive media coverage", pct: 5 },
  { label: "Strategic partnership", pct: 7 },
  { label: "Factory accident", pct: -10 },
  { label: "Product recall", pct: -8 },
  { label: "Data breach", pct: -12 },
  { label: "New competitor enters market", pct: -5 },
];

// Sectors + companies listed before the market opens.
const SECTORS = ["Sports", "Food", "Cosmetics", "Pharmaceuticals", "Electronics", "Fashion Apparel"];
const SEED_COMPANIES = [
  { name: "Nike", sector: "Sports", price: 180 },
  { name: "Adidas", sector: "Sports", price: 165 },
  { name: "Nestle", sector: "Food", price: 120 },
  { name: "Cadbury", sector: "Food", price: 95 },
  { name: "L'Oreal", sector: "Cosmetics", price: 210 },
  { name: "Estee Lauder", sector: "Cosmetics", price: 240 },
  { name: "Johnson & Johnson", sector: "Pharmaceuticals", price: 300 },
  { name: "Pfizer", sector: "Pharmaceuticals", price: 175 },
  { name: "Apple", sector: "Electronics", price: 410 },
  { name: "Samsung", sector: "Electronics", price: 260 },
  { name: "Gucci", sector: "Fashion Apparel", price: 395 },
  { name: "Louis Vuitton", sector: "Fashion Apparel", price: 450 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function fmt(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n) {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}
function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function applyPriceChange(companies, targetId, changePct, note, kind = "event") {
  const now = Date.now();
  return companies.map((c) => {
    if (targetId !== "ALL" && c.id !== targetId) return c;
    const newPrice = Math.max(1, c.price * (1 + changePct / 100));
    const history = [...c.history, { t: now, price: newPrice, note, pct: changePct, kind }].slice(-50);
    return { ...c, price: newPrice, history };
  });
}
function randomDrift(companies, range) {
  const now = Date.now();
  return companies.map((c) => {
    const change = (Math.random() * 2 - 1) * range;
    const newPrice = Math.max(1, c.price * (1 + change / 100));
    const history = [...c.history, { t: now, price: newPrice, note: "Market drift", pct: change, kind: "drift" }].slice(-50);
    return { ...c, price: newPrice, history };
  });
}
function seedCompanies() {
  const now = Date.now();
  return SEED_COMPANIES.map((s) => ({
    id: uid(),
    name: s.name,
    sector: s.sector,
    price: s.price,
    ipoPrice: s.price,
    volume: 0,
    totalShares: DEFAULT_TOTAL_SHARES,
    availableShares: DEFAULT_TOTAL_SHARES,
    history: [{ t: now, price: s.price, note: "IPO listed", pct: 0, kind: "ipo" }],
  }));
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
async function loadCompanies() {
  try {
    const res = await storage.get("market:companies");
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {}
  return [];
}
async function saveCompanies(companies) {
  try {
    await storage.set("market:companies", JSON.stringify(companies));
  } catch (e) {}
}
async function loadMeta() {
  try {
    const res = await storage.get("market:meta");
    if (res && res.value) return { ...DEFAULT_META, ...JSON.parse(res.value) };
  } catch (e) {}
  return { ...DEFAULT_META };
}
async function saveMeta(meta) {
  try {
    await storage.set("market:meta", JSON.stringify(meta));
  } catch (e) {}
}
async function loadTraders() {
  try {
    const res = await storage.get("market:traders");
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {}
  return null;
}
async function saveTraders(traders) {
  try {
    await storage.set("market:traders", JSON.stringify(traders));
  } catch (e) {}
}
const STARTING_CASH = 10000;
async function loadPortfolio(id) {
  try {
    const res = await storage.get("portfolio:" + id);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {}
  return { cash: STARTING_CASH, holdings: {}, tx: [] };
}
async function savePortfolio(id, data) {
  try {
    await storage.set("portfolio:" + id, JSON.stringify(data));
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Shared button styles
// ---------------------------------------------------------------------------
function btnPrimary(extra) {
  return {
    background: `linear-gradient(180deg, ${C.blueBright}, ${C.blue})`,
    color: "#06090F",
    boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 4px 14px -6px rgba(91,140,255,0.55)",
    ...extra,
  };
}
function btnGhost(extra) {
  return {
    background: C.panel2,
    color: C.textDim,
    border: `1px solid ${C.border}`,
    ...extra,
  };
}
const BTN_BASE = "rounded-lg font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";

// ---------------------------------------------------------------------------
// News ticker (signature element)
// ---------------------------------------------------------------------------
function NewsTicker({ companies }) {
  const items = useMemo(() => {
    const all = [];
    companies.forEach((c) => {
      c.history.forEach((h) => all.push({ name: c.name, ...h }));
    });
    all.sort((a, b) => b.t - a.t);
    return all.slice(0, 20);
  }, [companies]);

  if (items.length === 0) {
    return (
      <div style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}`, color: C.textFaint }} className="w-full py-2.5 text-center text-xs tracking-wide">
        Market opens soon — no companies listed yet.
      </div>
    );
  }

  const doubled = [...items, ...items];
  return (
    <div style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }} className="w-full overflow-hidden select-none">
      <div className="ticker-track flex items-center py-2">
        {doubled.map((it, i) => {
          const up = it.pct > 0;
          const flat = !it.pct;
          const color = flat ? C.blue : up ? C.green : C.red;
          return (
            <div key={i} className="flex items-center gap-1.5 px-4 shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {flat ? <Rocket size={12} color={color} /> : up ? <ArrowUpRight size={12} color={color} /> : <ArrowDownRight size={12} color={color} />}
              <span style={{ color: C.text }} className="text-xs font-medium">{it.name}</span>
              <span style={{ color: C.textDim }} className="text-xs">{it.note}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        .ticker-track { width: max-content; animation: ticker-scroll 60s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function LoginScreen({ onLogin, companies, traders }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const idClean = id.trim().toLowerCase();
    if (idClean === "owner") {
      if (OWNER_CREDENTIAL.password !== pw) { setError("ID or password not recognized."); return; }
      setError("");
      onLogin({ id: "owner", role: "owner", label: "Owner" });
      return;
    }
    const trader = traders.find((t) => t.username.toLowerCase() === idClean);
    if (!trader || trader.password !== pw) {
      setError("ID or password not recognized.");
      return;
    }
    setError("");
    onLogin({ id: trader.id, role: "trader", label: trader.label || trader.username });
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="flex flex-col">
      <NewsTicker companies={companies} />
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text, letterSpacing: "-0.01em" }} className="text-2xl font-bold flex items-center justify-center gap-2">
              <span style={{ color: C.blue }}>The</span> Stock Market
            </div>
            <div style={{ color: C.textFaint }} className="text-xs mt-1.5 tracking-wide">
              EVENT STOCK EXCHANGE · MEMBERS ONLY
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-6 shadow-2xl shadow-black/30">
            <label style={{ color: C.textDim }} className="text-xs block mb-1.5">Account ID</label>
            <div style={{ background: C.bgAlt, border: `1px solid ${C.border}` }} className="flex items-center rounded-lg px-3 mb-4 focus-within:ring-1" >
              <User size={15} color={C.textFaint} />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="owner or trader username"
                style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}
                className="bg-transparent flex-1 py-2.5 px-2 text-sm outline-none"
                autoCapitalize="none"
              />
            </div>

            <label style={{ color: C.textDim }} className="text-xs block mb-1.5">Password</label>
            <div style={{ background: C.bgAlt, border: `1px solid ${C.border}` }} className="flex items-center rounded-lg px-3 mb-2">
              <Lock size={15} color={C.textFaint} />
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="********"
                style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}
                className="bg-transparent flex-1 py-2.5 px-2 text-sm outline-none"
              />
            </div>

            {error && <div style={{ color: C.red }} className="text-xs mb-3 mt-2">{error}</div>}

            <button
              onClick={submit}
              style={btnPrimary()}
              className={`w-full mt-3 py-2.5 text-sm ${BTN_BASE} hover:brightness-110`}
            >
              Sign in
            </button>
          </div>

          <div style={{ color: C.textFaint }} className="text-xs text-center mt-5 leading-relaxed">
            Access is by invitation only.<br />Ask the exchange owner for credentials.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini sparkline used on cards
// ---------------------------------------------------------------------------
function MiniChart({ history, price, up }) {
  const chartData = history.length > 1 ? history.map((h) => ({ v: h.price })) : [{ v: price }, { v: price }];
  return (
    <div style={{ height: 44 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="v" stroke={up ? C.green : C.red} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company card
// ---------------------------------------------------------------------------
function CompanyCard({ company, holding, onTrade, onOpen }) {
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState(null);

  const changePct = ((company.price - company.ipoPrice) / company.ipoPrice) * 100;
  const up = changePct >= 0;
  const last = company.history[company.history.length - 1];
  const available = company.availableShares ?? company.totalShares ?? DEFAULT_TOTAL_SHARES;
  const total = company.totalShares ?? DEFAULT_TOTAL_SHARES;

  const doTrade = (e, type) => {
    e.stopPropagation();
    const q = Math.max(1, Math.floor(Number(qty) || 0));
    const ok = onTrade(company.id, type, q, company.price);
    if (ok) {
      setFlash(type);
      setTimeout(() => setFlash(null), 600);
    }
  };

  return (
    <div
      onClick={() => onOpen(company.id)}
      style={{ background: C.panel, border: `1px solid ${flash ? (flash === "BUY" ? C.green : C.red) : C.border}`, transition: "border-color 0.4s ease, transform 0.15s ease" }}
      className="rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between">
        <div>
          <div style={{ color: C.text }} className="text-sm font-semibold flex items-center gap-1">
            {company.name} <ChevronRight size={13} color={C.textFaint} />
          </div>
          <div style={{ color: C.textFaint }} className="text-xs mt-0.5 flex items-center gap-1.5">
            <span style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.textDim }} className="rounded-full px-1.5 py-0.5">{company.sector}</span>
            <span>IPO {CURRENCY}{fmt(company.ipoPrice)}</span>
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.text }} className="text-base font-semibold">
            {CURRENCY}{fmt(company.price)}
          </div>
          <div style={{ color: up ? C.green : C.red }} className="text-xs flex items-center gap-0.5 justify-end mt-0.5">
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {pct(changePct)}
          </div>
        </div>
      </div>

      <MiniChart history={company.history} price={company.price} up={up} />

      {last && (
        <div style={{ color: C.textFaint }} className="text-xs -mt-1 truncate">
          Last: {last.note} · {timeAgo(last.t)}
        </div>
      )}

      <div style={{ color: C.textFaint }} className="flex justify-between text-xs">
        <span>Mkt Cap {CURRENCY}{fmt(company.price * total)}</span>
        <span>{available}/{total} shares left</span>
      </div>

      {holding > 0 && (
        <div style={{ color: C.textDim }} className="text-xs -mt-1">
          You hold <span style={{ color: C.text }}>{holding}</span> shares
        </div>
      )}

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ background: C.bgAlt, border: `1px solid ${C.border}`, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}
          className="w-16 rounded-lg px-2 py-1.5 text-xs outline-none"
        />
        <button
          onClick={(e) => doTrade(e, "BUY")}
          disabled={available <= 0}
          style={{ background: C.greenDim, color: C.greenBright, border: `1px solid ${C.green}66` }}
          className={`flex-1 py-1.5 text-xs ${BTN_BASE} hover:brightness-125`}
        >
          {available <= 0 ? "Sold out" : "Buy"}
        </button>
        <button
          onClick={(e) => doTrade(e, "SELL")}
          style={{ background: C.redDim, color: C.redBright, border: `1px solid ${C.red}66` }}
          className={`flex-1 py-1.5 text-xs ${BTN_BASE} hover:brightness-125`}
        >
          Sell
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock detail — a real stock-market-style chart (green above IPO, red below)
// ---------------------------------------------------------------------------
function StockChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.text }} className="rounded-md px-2.5 py-1.5 text-xs shadow-lg">
      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold">{CURRENCY}{fmt(p.price)}</div>
      {p.note && <div style={{ color: C.textFaint }} className="mt-0.5">{p.note}</div>}
    </div>
  );
}

function StockDetailModal({ company, holding, onTrade, onClose }) {
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState(null);
  if (!company) return null;

  const changePct = ((company.price - company.ipoPrice) / company.ipoPrice) * 100;
  const up = changePct >= 0;
  const lineColor = up ? C.green : C.red;
  const available = company.availableShares ?? company.totalShares ?? DEFAULT_TOTAL_SHARES;
  const total = company.totalShares ?? DEFAULT_TOTAL_SHARES;

  const chartData = (company.history.length > 1 ? company.history : [{ t: Date.now(), price: company.price, note: "IPO listed" }, { t: Date.now(), price: company.price }])
    .map((h) => ({ price: h.price, note: h.note, t: h.t }));

  const prices = company.history.map((h) => h.price);
  const high = Math.max(...prices, company.price);
  const low = Math.min(...prices, company.price);

  const moveBars = company.history.slice(-16).map((h, i) => ({ i, pct: h.pct || 0 }));

  const doTrade = (type) => {
    const q = Math.max(1, Math.floor(Number(qty) || 0));
    const ok = onTrade(company.id, type, q, company.price);
    if (ok) { setFlash(type); setTimeout(() => setFlash(null), 600); }
  };

  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(6,8,12,0.72)", backdropFilter: "blur(2px)" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50"
      >
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.borderSoft}` }} className="sticky top-0 z-10">
          <div className="px-5 pt-4">
            <button
              onClick={onClose}
              style={{ color: C.textDim, background: C.panel2, border: `1px solid ${C.border}` }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${BTN_BASE} hover:text-white hover:brightness-125`}
            >
              <ArrowLeft size={13} /> Back to market
            </button>
          </div>
          <div className="flex items-start justify-between p-5 pt-3 pb-4">
            <div>
              <div style={{ color: C.text }} className="text-lg font-bold" >{company.name}</div>
              <span style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.textDim }} className="inline-block rounded-full px-2 py-0.5 text-xs mt-1">{company.sector}</span>
            </div>
            <button onClick={onClose} style={{ color: C.textFaint }} className="hover:text-white transition p-1"><X size={20} /></button>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.text }} className="text-3xl font-bold">
            {CURRENCY}{fmt(company.price)}
          </div>
          <div style={{ color: up ? C.green : C.red }} className="text-sm font-semibold flex items-center gap-1 mt-1">
            {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {pct(changePct)} since IPO
          </div>
        </div>

        <div className="px-2 pt-3" style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip content={<StockChartTooltip />} cursor={{ stroke: C.textFaint, strokeDasharray: "3 3" }} />
              <Area type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} fill="url(#stockFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {moveBars.length > 1 && (
          <div className="px-4" style={{ height: 44 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moveBars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
                <Bar dataKey="pct" isAnimationActive={false} radius={[2, 2, 2, 2]}>
                  {moveBars.map((b, i) => (
                    <Cell key={i} fill={b.pct >= 0 ? C.green : C.red} fillOpacity={b.pct === 0 ? 0.25 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="px-5 pt-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <div style={{ color: C.textFaint }} className="text-[10px] uppercase tracking-wide">Open</div>
            <div style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs font-semibold mt-0.5">{CURRENCY}{fmt(company.ipoPrice)}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-[10px] uppercase tracking-wide">High</div>
            <div style={{ color: C.green, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs font-semibold mt-0.5">{CURRENCY}{fmt(high)}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-[10px] uppercase tracking-wide">Low</div>
            <div style={{ color: C.red, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs font-semibold mt-0.5">{CURRENCY}{fmt(low)}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-[10px] uppercase tracking-wide">Mkt Cap</div>
            <div style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs font-semibold mt-0.5">{CURRENCY}{fmt(company.price * total)}</div>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div style={{ background: C.bgAlt, border: `1px solid ${C.border}` }} className="rounded-lg px-3 py-2.5 flex items-center justify-between text-xs">
            <span style={{ color: C.textDim }}>Shares available</span>
            <span style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{available} / {total}</span>
          </div>
          {holding > 0 && (
            <div style={{ color: C.textDim }} className="text-xs mt-2">You hold <span style={{ color: C.text }}>{holding}</span> shares worth <span style={{ color: C.text }}>{CURRENCY}{fmt(holding * company.price)}</span></div>
          )}
        </div>

        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{ background: C.bgAlt, border: `1px solid ${flash ? (flash === "BUY" ? C.green : C.red) : C.border}`, color: C.text, fontFamily: "'IBM Plex Mono', monospace", transition: "border-color 0.4s ease" }}
            className="w-20 rounded-lg px-2 py-2.5 text-sm outline-none text-center"
          />
          <button
            onClick={() => doTrade("BUY")}
            disabled={available <= 0}
            style={{ background: C.greenDim, color: C.greenBright, border: `1px solid ${C.green}77` }}
            className={`flex-1 py-2.5 text-sm ${BTN_BASE} hover:brightness-125`}
          >
            {available <= 0 ? "Sold out" : "Buy"}
          </button>
          <button
            onClick={() => doTrade("SELL")}
            style={{ background: C.redDim, color: C.redBright, border: `1px solid ${C.red}77` }}
            className={`flex-1 py-2.5 text-sm ${BTN_BASE} hover:brightness-125`}
          >
            Sell
          </button>
        </div>

        <div className="px-5 pt-3 pb-5">
          <div style={{ color: C.text }} className="text-sm font-semibold mb-2 flex items-center gap-1.5"><History size={13} /> History</div>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {[...company.history].reverse().map((h, i) => {
              const hUp = (h.pct || 0) >= 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span style={{ color: hUp ? C.green : (h.pct ? C.red : C.textFaint) }} className="flex items-center gap-1">
                    {h.pct ? (hUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />) : <Rocket size={11} />}
                    {h.note}
                  </span>
                  <span style={{ color: C.textFaint }}>{timeAgo(h.t)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner panel
// ---------------------------------------------------------------------------
function OwnerPanel({
  companies, onAddCompany, onApplyChange, meta, onToggleAuto, onSetVolatility,
  onUpdateShares, traders, onAddTrader, onDeleteTrader, onUpdateTraderPassword, onBulkGenerateTraders,
}) {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("150");
  const [newSector, setNewSector] = useState(SECTORS[0]);
  const [newShares, setNewShares] = useState(String(DEFAULT_TOTAL_SHARES));

  const [evTarget, setEvTarget] = useState("ALL");
  const [evPreset, setEvPreset] = useState(MARKET_EVENTS[0].label);
  const [evCustomName, setEvCustomName] = useState("");
  const [evCustomPct, setEvCustomPct] = useState("");
  const [useCustomEvent, setUseCustomEvent] = useState(false);

  const [sharesDraft, setSharesDraft] = useState({});
  const [newTraderName, setNewTraderName] = useState("");
  const [newTraderPw, setNewTraderPw] = useState("");
  const [bulkCount, setBulkCount] = useState("5");

  const inputStyle = { background: C.bgAlt, border: `1px solid ${C.border}`, color: C.text, fontFamily: "'IBM Plex Mono', monospace" };
  const selectStyle = { ...inputStyle, appearance: "auto" };

  const addCompany = () => {
    if (!newName.trim()) return;
    const price = Math.max(1, Number(newPrice) || 100);
    const shares = Math.max(1, Math.floor(Number(newShares)) || DEFAULT_TOTAL_SHARES);
    onAddCompany(newName.trim(), price, newSector, shares);
    setNewName("");
    setNewPrice("150");
    setNewShares(String(DEFAULT_TOTAL_SHARES));
  };

  const publishEvent = () => {
    if (useCustomEvent) {
      const p = Number(evCustomPct);
      if (!evCustomName.trim() || isNaN(p)) return;
      onApplyChange(evTarget, p, `${evCustomName.trim()} (${p >= 0 ? "+" : ""}${p}%)`);
      setEvCustomName("");
      setEvCustomPct("");
    } else {
      const ev = MARKET_EVENTS.find((e) => e.label === evPreset);
      onApplyChange(evTarget, ev.pct, `${ev.label} (${ev.pct >= 0 ? "+" : ""}${ev.pct}%)`);
    }
  };

  const eventLog = useMemo(() => {
    const all = [];
    companies.forEach((c) => c.history.forEach((h) => {
      if (h.kind === "event" || h.kind === "ipo") all.push({ name: c.name, ...h });
    }));
    all.sort((a, b) => b.t - a.t);
    return all.slice(0, 25);
  }, [companies]);

  const addTrader = () => {
    if (!newTraderName.trim() || !newTraderPw.trim()) return;
    onAddTrader(newTraderName.trim(), newTraderPw.trim());
    setNewTraderName("");
    setNewTraderPw("");
  };

  return (
    <div className="px-5 py-4 flex flex-col gap-5">
      {/* Add company */}
      <section style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
        <div style={{ color: C.text }} className="text-sm font-semibold flex items-center gap-1.5 mb-3"><Plus size={14} /> List a new company</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Company name" style={inputStyle} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" />
          <select value={newSector} onChange={(e) => setNewSector(e.target.value)} style={selectStyle} className="rounded-lg px-3 py-2 text-sm outline-none">
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" placeholder="Start price" style={inputStyle} className="w-full sm:w-28 rounded-lg px-3 py-2 text-sm outline-none" />
          <input value={newShares} onChange={(e) => setNewShares(e.target.value)} type="number" placeholder="Total shares" style={inputStyle} className="w-full sm:w-32 rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={addCompany} style={btnPrimary()} className={`px-4 py-2 text-sm ${BTN_BASE} hover:brightness-110 shrink-0`}>Launch IPO</button>
        </div>
      </section>

      {/* Share supply per company */}
      {companies.length > 0 && (
        <section style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
          <div style={{ color: C.text }} className="text-sm font-semibold flex items-center gap-1.5 mb-1"><Layers size={14} /> Share supply</div>
          <div style={{ color: C.textDim }} className="text-xs mb-3">Set how many shares of each company exist. The cap can't drop below shares traders already hold.</div>
          <div className="flex flex-col gap-2">
            {companies.map((c) => {
              const held = (c.totalShares ?? DEFAULT_TOTAL_SHARES) - (c.availableShares ?? c.totalShares ?? DEFAULT_TOTAL_SHARES);
              const draft = sharesDraft[c.id] ?? c.totalShares ?? DEFAULT_TOTAL_SHARES;
              return (
                <div key={c.id} style={{ background: C.bgAlt, border: `1px solid ${C.border}` }} className="rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div style={{ color: C.text }} className="text-xs font-semibold">{c.name}</div>
                    <div style={{ color: C.textFaint }} className="text-[11px]">{held} held by traders · {(c.availableShares ?? 0)} available</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={held}
                      value={draft}
                      onChange={(e) => setSharesDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                      style={inputStyle}
                      className="w-24 rounded-md px-2 py-1.5 text-xs outline-none"
                    />
                    <button
                      onClick={() => onUpdateShares(c.id, Number(draft))}
                      style={btnGhost({ color: C.blueBright, borderColor: C.blue + "55" })}
                      className={`px-3 py-1.5 text-xs ${BTN_BASE} hover:brightness-125`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trader accounts */}
      <section style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
        <div style={{ color: C.text }} className="text-sm font-semibold flex items-center gap-1.5 mb-1"><Users size={14} /> Trader accounts</div>
        <div style={{ color: C.textDim }} className="text-xs mb-3">Decide how many traders can access the exchange, and their usernames &amp; passwords.</div>

        <div className="flex flex-col gap-2 mb-3">
          {traders.length === 0 && <div style={{ color: C.textFaint }} className="text-xs">No trader accounts yet.</div>}
          {traders.map((t) => (
            <div key={t.id} style={{ background: C.bgAlt, border: `1px solid ${C.border}` }} className="rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs font-semibold flex items-center gap-1.5">
                <User size={12} color={C.textFaint} /> {t.username}
              </div>
              <div className="flex items-center gap-1.5">
                <KeyRound size={12} color={C.textFaint} />
                <input
                  defaultValue={t.password}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== t.password) onUpdateTraderPassword(t.id, e.target.value.trim()); }}
                  style={inputStyle}
                  className="w-28 rounded-md px-2 py-1.5 text-xs outline-none"
                />
                <button onClick={() => onDeleteTrader(t.id)} style={{ color: C.redBright }} className="p-1.5 hover:opacity-75 transition"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input value={newTraderName} onChange={(e) => setNewTraderName(e.target.value)} placeholder="New username" style={inputStyle} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" />
          <input value={newTraderPw} onChange={(e) => setNewTraderPw(e.target.value)} placeholder="Password" style={inputStyle} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={addTrader} style={btnPrimary()} className={`px-4 py-2 text-sm ${BTN_BASE} hover:brightness-110 shrink-0`}>Add trader</button>
        </div>

        <div style={{ borderTop: `1px solid ${C.borderSoft}` }} className="pt-3 mt-1 flex items-center gap-2">
          <span style={{ color: C.textFaint }} className="text-xs shrink-0">Quick-create</span>
          <input value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} type="number" min="1" style={inputStyle} className="w-16 rounded-md px-2 py-1.5 text-xs outline-none" />
          <span style={{ color: C.textFaint }} className="text-xs shrink-0">traders</span>
          <button
            onClick={() => onBulkGenerateTraders(Math.max(1, Math.floor(Number(bulkCount)) || 1))}
            style={btnGhost({ color: C.blueBright, borderColor: C.blue + "55" })}
            className={`ml-auto flex items-center gap-1 px-3 py-1.5 text-xs ${BTN_BASE} hover:brightness-125`}
          >
            <RefreshCw size={12} /> Generate
          </button>
        </div>
      </section>

      {/* Auto-fluctuation */}
      <section style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
        <div style={{ color: C.text }} className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Zap size={14} /> Automatic market drift</div>
        <div className="flex items-center justify-between mb-3">
          <div style={{ color: C.textDim }} className="text-xs pr-3">Prices nudge themselves at random every ~20s, on top of trades and your news.</div>
          <button
            onClick={onToggleAuto}
            style={{ background: meta.autoFluctuate ? C.greenDim : C.panel2, color: meta.autoFluctuate ? C.greenBright : C.textFaint, border: `1px solid ${C.border}` }}
            className={`rounded-full px-3 py-1 text-xs ${BTN_BASE} shrink-0`}
          >
            {meta.autoFluctuate ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex gap-2">
          {VOLATILITY_OPTIONS.map((v) => (
            <button
              key={v.label}
              onClick={() => onSetVolatility(v.value)}
              style={{
                background: meta.volatility === v.value ? C.blueDim : "transparent",
                color: meta.volatility === v.value ? C.blueBright : C.textFaint,
                border: `1px solid ${meta.volatility === v.value ? C.blue + "66" : C.border}`,
              }}
              className={`flex-1 py-1.5 text-xs ${BTN_BASE}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </section>

      {companies.length === 0 ? (
        <div style={{ color: C.textFaint }} className="text-sm text-center py-6">Add at least one company above to start publishing price moves.</div>
      ) : (
        <>
          {/* Market event / price nudge */}
          <section style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
            <div style={{ color: C.text }} className="text-sm font-semibold mb-3">Move a price</div>
            <select value={evTarget} onChange={(e) => setEvTarget(e.target.value)} style={selectStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-2">
              <option value="ALL">All companies</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="flex gap-2 mb-2">
              <button onClick={() => setUseCustomEvent(false)} style={{ background: !useCustomEvent ? C.blueDim : "transparent", color: !useCustomEvent ? C.blueBright : C.textFaint, border: `1px solid ${C.border}` }} className={`flex-1 py-1.5 text-xs ${BTN_BASE}`}>Preset</button>
              <button onClick={() => setUseCustomEvent(true)} style={{ background: useCustomEvent ? C.blueDim : "transparent", color: useCustomEvent ? C.blueBright : C.textFaint, border: `1px solid ${C.border}` }} className={`flex-1 py-1.5 text-xs ${BTN_BASE}`}>Custom nudge</button>
            </div>

            {!useCustomEvent ? (
              <select value={evPreset} onChange={(e) => setEvPreset(e.target.value)} style={selectStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-2">
                {MARKET_EVENTS.map((ev) => <option key={ev.label} value={ev.label}>{ev.label} ({ev.pct >= 0 ? "+" : ""}{ev.pct}%)</option>)}
              </select>
            ) : (
              <div className="flex gap-2 mb-2">
                <input value={evCustomName} onChange={(e) => setEvCustomName(e.target.value)} placeholder="Reason (e.g. Judges' bonus)" style={inputStyle} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" />
                <input value={evCustomPct} onChange={(e) => setEvCustomPct(e.target.value)} type="number" placeholder="%" style={inputStyle} className="w-20 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
            )}

            <button onClick={publishEvent} style={btnPrimary()} className={`w-full py-2 text-sm ${BTN_BASE} hover:brightness-110 flex items-center justify-center gap-1.5`}>
              <Newspaper size={14} /> Publish
            </button>
          </section>

          {/* Event log */}
          <section style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
            <div style={{ color: C.text }} className="text-sm font-semibold mb-3">Event log</div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {eventLog.length === 0 && <div style={{ color: C.textFaint }} className="text-xs">No events yet.</div>}
              {eventLog.map((n, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span style={{ color: C.text }}>{n.name}</span>
                  <span style={{ color: C.textDim }} className="truncate mx-2 flex-1 text-right">{n.note}</span>
                  <span style={{ color: C.textFaint }} className="w-14 text-right shrink-0">{timeAgo(n.t)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------
function Rankings({ companies, embedded }) {
  const sorted = [...companies].sort((a, b) => b.price * (b.totalShares || DEFAULT_TOTAL_SHARES) - a.price * (a.totalShares || DEFAULT_TOTAL_SHARES));
  if (sorted.length === 0) {
    return <div style={{ color: C.textFaint }} className="text-sm text-center py-8">No companies listed yet.</div>;
  }
  return (
    <div className={embedded ? "flex flex-col gap-2" : "px-5 py-4 flex flex-col gap-2"}>
      {sorted.map((c, i) => {
        const changePct = ((c.price - c.ipoPrice) / c.ipoPrice) * 100;
        const up = changePct >= 0;
        const total = c.totalShares || DEFAULT_TOTAL_SHARES;
        return (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ color: i === 0 ? C.green : C.textFaint, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-bold w-5">{i === 0 ? <Trophy size={16} color={C.green} /> : `#${i + 1}`}</div>
              <div>
                <div style={{ color: C.text }} className="text-sm font-semibold">{c.name}</div>
                <div style={{ color: C.textFaint }} className="text-xs">{c.sector} · Mkt cap {CURRENCY}{fmt(c.price * total)}</div>
              </div>
            </div>
            <div className="text-right">
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.text }} className="text-sm font-semibold">{CURRENCY}{fmt(c.price)}</div>
              <div style={{ color: up ? C.green : C.red }} className="text-xs">{pct(changePct)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exchange page — everything a trader needs, on one page
// ---------------------------------------------------------------------------
function ExchangePage({ companies, portfolio, onTrade, companyName, onOpenStock }) {
  const [sector, setSector] = useState("All");

  const sectors = useMemo(
    () => ["All", ...SECTORS.filter((s) => companies.some((c) => c.sector === s))],
    [companies]
  );
  const filtered = sector === "All" ? companies : companies.filter((c) => c.sector === sector);

  const heldCompanies = useMemo(() => {
    if (!portfolio) return [];
    return Object.entries(portfolio.holdings)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ company: companies.find((c) => c.id === id), qty }))
      .filter((h) => h.company);
  }, [portfolio, companies]);

  if (companies.length === 0) {
    return <div style={{ color: C.textFaint }} className="text-sm text-center py-10 px-5">No companies listed yet. Ask the exchange owner to open the market.</div>;
  }

  return (
    <div className="px-5 py-4 flex flex-col gap-6">
      {/* Sector filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sectors.map((s) => (
          <button
            key={s}
            onClick={() => setSector(s)}
            style={{
              background: sector === s ? C.blueDim : C.panel,
              color: sector === s ? C.blueBright : C.textFaint,
              border: `1px solid ${sector === s ? C.blue + "66" : C.border}`,
            }}
            className={`rounded-full px-3 py-1.5 text-xs ${BTN_BASE} shrink-0`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Market grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <CompanyCard key={c.id} company={c} holding={portfolio ? portfolio.holdings[c.id] || 0 : 0} onTrade={onTrade} onOpen={onOpenStock} />
        ))}
      </div>

      {/* Your holdings */}
      {heldCompanies.length > 0 && (
        <section>
          <div style={{ color: C.text }} className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Wallet size={14} /> Your holdings</div>
          <div className="flex flex-col gap-2">
            {heldCompanies.map(({ company, qty }) => (
              <div key={company.id} style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg px-3 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span style={{ color: C.text }} className="font-semibold">{company.name}</span>
                  <span style={{ color: C.textFaint }}>{company.sector}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: C.textDim }}>{qty} shares</span>
                  <span style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{CURRENCY}{fmt(qty * company.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <div style={{ color: C.text }} className="text-sm font-semibold mb-2 flex items-center gap-1.5"><History size={14} /> Recent activity</div>
        {(!portfolio || portfolio.tx.length === 0) ? (
          <div style={{ color: C.textFaint }} className="text-xs py-3">No trades yet — buy or sell above to get started.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {portfolio.tx.slice(0, 12).map((t, i) => (
              <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg px-3 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span style={{ color: t.type === "BUY" ? C.green : C.red, fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold w-9">{t.type}</span>
                  <span style={{ color: C.text }}>{companyName(t.companyId)}</span>
                  <span style={{ color: C.textDim }}>x {t.qty}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>@ {CURRENCY}{fmt(t.price)}</span>
                  <span style={{ color: C.textFaint }}>{new Date(t.time).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rankings */}
      <section>
        <div style={{ color: C.text }} className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Trophy size={14} /> Rankings</div>
        <Rankings companies={companies} embedded />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [traders, setTraders] = useState(DEFAULT_TRADERS);
  const [portfolio, setPortfolio] = useState(null);
  const [tab, setTab] = useState("exchange");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [openStockId, setOpenStockId] = useState(null);
  const [, forceTick] = useState(0);
  const skipPollUntilRef = useRef(0);

  useEffect(() => {
    (async () => {
      let c = await loadCompanies();
      if (!c || c.length === 0) {
        c = seedCompanies();
        await saveCompanies(c);
      }
      // migrate older records that predate per-company share limits
      c = c.map((co) => ({
        totalShares: DEFAULT_TOTAL_SHARES,
        availableShares: DEFAULT_TOTAL_SHARES,
        ...co,
      }));
      setCompanies(c);
      setMeta(await loadMeta());
      let t = await loadTraders();
      if (!t) {
        t = DEFAULT_TRADERS;
        await saveTraders(t);
      }
      setTraders(t);
      setLoading(false);
    })();
  }, []);

  // refresh from shared storage periodically (multi-device sync) — but skip
  // the poll for a short window right after a local write so it can't clobber
  // an edit that hasn't finished propagating to storage yet.
  useEffect(() => {
    const iv = setInterval(async () => {
      if (Date.now() < skipPollUntilRef.current) return;
      const c = await loadCompanies();
      setCompanies(c);
      const m = await loadMeta();
      setMeta(m);
      const t = await loadTraders();
      if (t) setTraders(t);
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  // automatic market drift — checked frequently, applied every ~20s, with a
  // shared "lastFluctuation" timestamp acting as a soft lock so multiple open
  // tabs don't all apply their own drift on the same tick.
  useEffect(() => {
    const iv = setInterval(async () => {
      const current = await loadCompanies();
      if (!current || current.length === 0) return;
      const m = await loadMeta();
      if (!m.autoFluctuate) return;
      const now = Date.now();
      if (now - (m.lastFluctuation || 0) < AUTO_FLUCT_INTERVAL_MS) return;
      await saveMeta({ ...m, lastFluctuation: now });
      skipPollUntilRef.current = Date.now() + 9000;
      const next = randomDrift(current, m.volatility || DEFAULT_META.volatility);
      await saveCompanies(next);
      setCompanies(next);
    }, AUTO_FLUCT_CHECK_MS);
    return () => clearInterval(iv);
  }, []);

  // tick for relative "time ago" labels
  useEffect(() => {
    const iv = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => setPortfolio(await loadPortfolio(user.id)))();
  }, [user]);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => { setUser(null); setPortfolio(null); setOpenStockId(null); };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };

  const markLocalWrite = () => { skipPollUntilRef.current = Date.now() + 9000; };

  const handleAddCompany = useCallback((name, price, sector, totalShares) => {
    markLocalWrite();
    setCompanies((prev) => {
      const now = Date.now();
      const shares = Math.max(1, Math.floor(totalShares) || DEFAULT_TOTAL_SHARES);
      const company = {
        id: uid(),
        name,
        sector,
        price,
        ipoPrice: price,
        volume: 0,
        totalShares: shares,
        availableShares: shares,
        history: [{ t: now, price, note: "IPO listed", pct: 0, kind: "ipo" }],
      };
      const next = [...prev, company];
      saveCompanies(next);
      return next;
    });
    showToast(`${name} listed at ${CURRENCY}${fmt(price)}`);
  }, []);

  const handleApplyChange = useCallback((targetId, changePct, note) => {
    markLocalWrite();
    setCompanies((prev) => {
      const next = applyPriceChange(prev, targetId, changePct, note, "event");
      saveCompanies(next);
      return next;
    });
    showToast(targetId === "ALL" ? `Published to all companies: ${note}` : `Published: ${note}`);
  }, []);

  const handleUpdateShares = useCallback((companyId, newTotalShares) => {
    markLocalWrite();
    setCompanies((prev) => {
      const next = prev.map((c) => {
        if (c.id !== companyId) return c;
        const total0 = c.totalShares ?? DEFAULT_TOTAL_SHARES;
        const avail0 = c.availableShares ?? total0;
        const held = total0 - avail0;
        const total = Math.max(held, Math.floor(newTotalShares) || held);
        const available = total - held;
        return { ...c, totalShares: total, availableShares: available };
      });
      saveCompanies(next);
      return next;
    });
    showToast("Share supply updated.");
  }, []);

  const handleToggleAuto = useCallback(() => {
    markLocalWrite();
    setMeta((prev) => {
      const next = { ...prev, autoFluctuate: !prev.autoFluctuate };
      saveMeta(next);
      return next;
    });
  }, []);

  const handleSetVolatility = useCallback((v) => {
    markLocalWrite();
    setMeta((prev) => {
      const next = { ...prev, volatility: v };
      saveMeta(next);
      return next;
    });
  }, []);

  const handleAddTrader = useCallback((username, password) => {
    markLocalWrite();
    setTraders((prev) => {
      const clean = username.trim();
      if (clean.toLowerCase() === "owner" || prev.some((t) => t.username.toLowerCase() === clean.toLowerCase())) {
        showToast("That username is already taken.");
        return prev;
      }
      const next = [...prev, { id: uid(), username: clean, password: password.trim(), label: clean }];
      saveTraders(next);
      return next;
    });
    showToast(`Trader "${username}" created.`);
  }, []);

  const handleDeleteTrader = useCallback((id) => {
    markLocalWrite();
    setTraders((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTraders(next);
      return next;
    });
  }, []);

  const handleUpdateTraderPassword = useCallback((id, password) => {
    markLocalWrite();
    setTraders((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, password } : t));
      saveTraders(next);
      return next;
    });
    showToast("Password updated.");
  }, []);

  const handleBulkGenerateTraders = useCallback((count) => {
    markLocalWrite();
    setTraders((prev) => {
      const existingNums = prev
        .map((t) => (/^trader(\d+)$/i.exec(t.username) || [])[1])
        .filter(Boolean)
        .map(Number);
      let next = Math.max(0, ...existingNums) + 1;
      const created = [];
      const additions = [];
      for (let i = 0; i < count; i++) {
        const username = `trader${next}`;
        const password = randomPassword();
        additions.push({ id: uid(), username, password, label: username });
        created.push(username);
        next++;
      }
      const result = [...prev, ...additions];
      saveTraders(result);
      return result;
    });
    showToast(`Generated ${count} trader account${count > 1 ? "s" : ""}.`);
  }, []);

  const handleTrade = useCallback((companyId, type, qty, price) => {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return false;
    const available = company.availableShares ?? company.totalShares ?? DEFAULT_TOTAL_SHARES;
    if (type === "BUY" && qty > available) {
      showToast(`Only ${available} shares of ${company.name} left.`);
      return false;
    }
    let success = false;
    setPortfolio((prev) => {
      if (!prev) return prev;
      const cost = qty * price;
      const holding = prev.holdings[companyId] || 0;
      let next;
      if (type === "BUY") {
        if (cost > prev.cash) { showToast("Not enough cash for that order."); return prev; }
        next = { ...prev, cash: prev.cash - cost, holdings: { ...prev.holdings, [companyId]: holding + qty }, tx: [{ type, companyId, qty, price, time: Date.now() }, ...prev.tx].slice(0, 25) };
        success = true;
      } else {
        if (qty > holding) { showToast("You don't own that many shares."); return prev; }
        next = { ...prev, cash: prev.cash + cost, holdings: { ...prev.holdings, [companyId]: holding - qty }, tx: [{ type, companyId, qty, price, time: Date.now() }, ...prev.tx].slice(0, 25) };
        success = true;
      }
      savePortfolio(user.id, next);
      return next;
    });
    if (success) {
      markLocalWrite();
      setCompanies((prev) => {
        const withVolume = prev.map((c) => {
          if (c.id !== companyId) return c;
          const total = c.totalShares ?? DEFAULT_TOTAL_SHARES;
          const avail0 = c.availableShares ?? total;
          const avail = type === "BUY" ? Math.max(0, avail0 - qty) : Math.min(total, avail0 + qty);
          return { ...c, volume: (c.volume || 0) + qty, availableShares: avail };
        });
        const impactRaw = (qty / (company.totalShares || DEFAULT_TOTAL_SHARES)) * 100 * TRADE_IMPACT_MULTIPLIER;
        const impact = Math.min(TRADE_IMPACT_MAX, impactRaw);
        const signedImpact = type === "BUY" ? impact : -impact;
        const next = applyPriceChange(withVolume, companyId, signedImpact, `${type === "BUY" ? "Buy" : "Sell"} order — ${qty} sh`, "trade");
        saveCompanies(next);
        return next;
      });
    }
    return success;
  }, [user, companies]);

  const holdingsValue = useMemo(() => {
    if (!portfolio) return 0;
    return Object.entries(portfolio.holdings).reduce((sum, [id, qty]) => {
      if (!qty) return sum;
      const c = companies.find((x) => x.id === id);
      return c ? sum + qty * c.price : sum;
    }, 0);
  }, [portfolio, companies]);

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "Unknown";
  const openStock = companies.find((c) => c.id === openStockId) || null;

  if (loading) {
    return (
      <div style={{ background: C.bg, color: C.textDim, minHeight: "100vh" }} className="flex items-center justify-center text-sm">
        <style>{`body{margin:0}`}</style>
        Loading market…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <style>{FONT_IMPORT}</style>
        <LoginScreen onLogin={handleLogin} companies={companies} traders={traders} />
      </>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <NewsTicker companies={companies} />

      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bgAlt }} className="px-5 py-3 flex items-center justify-between">
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text, letterSpacing: "-0.01em" }} className="text-base font-bold">
          <span style={{ color: C.blue }}>The</span> Stock Market
        </div>
        <div className="flex items-center gap-3">
          {user.role === "owner" && (
            <span style={{ color: C.blueBright, borderColor: `${C.blue}55` }} className="text-xs flex items-center gap-1 border rounded-full px-2 py-0.5">
              <ShieldCheck size={12} /> Owner
            </span>
          )}
          <span style={{ color: C.textDim }} className="text-xs hidden sm:inline">{user.label}</span>
          <button onClick={handleLogout} style={{ color: C.textFaint }} className="hover:text-red-400 transition p-1"><LogOut size={16} /></button>
        </div>
      </div>

      {toast && (
        <div style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}` }} className="mx-5 mt-3 rounded-lg px-3 py-2 text-xs">{toast}</div>
      )}

      {portfolio && (
        <div className="px-5 pt-4 grid grid-cols-3 gap-3">
          <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-3">
            <div style={{ color: C.textFaint }} className="text-xs flex items-center gap-1"><Wallet size={11} /> Cash</div>
            <div style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm sm:text-base font-semibold mt-1">{CURRENCY}{fmt(portfolio.cash)}</div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-3">
            <div style={{ color: C.textFaint }} className="text-xs flex items-center gap-1"><LayoutGrid size={11} /> Holdings</div>
            <div style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm sm:text-base font-semibold mt-1">{CURRENCY}{fmt(holdingsValue)}</div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-3">
            <div style={{ color: C.textFaint }} className="text-xs">Total value</div>
            <div style={{ color: C.green, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm sm:text-base font-semibold mt-1">{CURRENCY}{fmt(portfolio.cash + holdingsValue)}</div>
          </div>
        </div>
      )}

      <div className="px-5 pt-4 flex gap-4 overflow-x-auto" style={{ borderBottom: `1px solid ${C.border}` }}>
        {[
          { id: "exchange", label: "Exchange", icon: LayoutGrid },
          ...(user.role === "owner" ? [{ id: "owner", label: "Owner panel", icon: ShieldCheck }] : []),
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ color: tab === t.id ? C.text : C.textFaint, borderBottom: tab === t.id ? `2px solid ${C.blue}` : "2px solid transparent" }}
            className="pb-2 text-sm flex items-center gap-1.5 -mb-px shrink-0 transition-colors"
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "exchange" && (
        <ExchangePage companies={companies} portfolio={portfolio} onTrade={handleTrade} companyName={companyName} onOpenStock={setOpenStockId} />
      )}

      {tab === "owner" && user.role === "owner" && (
        <OwnerPanel
          companies={companies}
          onAddCompany={handleAddCompany}
          onApplyChange={handleApplyChange}
          meta={meta}
          onToggleAuto={handleToggleAuto}
          onSetVolatility={handleSetVolatility}
          onUpdateShares={handleUpdateShares}
          traders={traders}
          onAddTrader={handleAddTrader}
          onDeleteTrader={handleDeleteTrader}
          onUpdateTraderPassword={handleUpdateTraderPassword}
          onBulkGenerateTraders={handleBulkGenerateTraders}
        />
      )}

      {openStock && (
        <StockDetailModal
          company={openStock}
          holding={portfolio ? portfolio.holdings[openStock.id] || 0 : 0}
          onTrade={handleTrade}
          onClose={() => setOpenStockId(null)}
        />
      )}

      <div style={{ color: C.textFaint }} className="text-center text-xs py-6">
        Simulated prices for event use only — driven by trades, owner news, and automatic drift, not live markets.
      </div>
    </div>
  );
}
