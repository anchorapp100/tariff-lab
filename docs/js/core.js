// Shared state, helpers, theme tokens and the chart/card machinery.

export const S = {
  status: null, results: null, resultsBy: {}, raw: {}, noSC: false, flat: "flex", mode: "rt", tariffs: null, sel: null, details: {}, view: "verdict", slotMap: {}, busy: false,
};

// ----------------------------------------------------------------------------- api
/** True in the pre-computed web snapshot (webapp/): no server, everything is read from baked JSON files. */
export const isStatic = () => !!(window.OTL && window.OTL.static);

export async function api(path, opts) {
  if (window.OTL && window.OTL.api) return window.OTL.api(path, opts);      // static snapshot: route to baked data
  const r = await fetch(path, opts);
  if (!r.ok) {
    const e = new Error(`${r.status} ${path}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
/** Per-scenario detail (daily series, heatmaps, season profiles) for the current controller mode. */
export async function getDetail(key) {
  const k = S.mode + "|" + key + "|" + (S.noSC ? "e" : "s");
  if (!S.details[k]) {
    const d = await api(`/api/scenario?key=${encodeURIComponent(key)}&mode=${S.mode}`);
    if (S.noSC) {                                       // pure-energy view: take the standing charge out of every day / month
      const r = S.raw[S.mode] && S.raw[S.mode].scenarios[key];
      const pd = r ? r.standing_p_day : 0;
      d.daily.net = d.daily.net.map((v) => +(v - pd / 100).toFixed(3));
      d.monthly = d.monthly.map((m) => ({ ...m, net: +(m.net - m.standing).toFixed(2), standing: 0 }));
    }
    S.details[k] = d;
  }
  return S.details[k];
}

/** Copy of a results payload with every standing charge removed (energy-only view). */
export function adjustForStanding(raw) {
  if (!raw) return raw;
  const out = JSON.parse(JSON.stringify(raw));
  const strip = (t) => { if (t && typeof t.net === "number") { t.net = +(t.net - (t.standing || 0)).toFixed(2); if ("net_per_day_p" in t && t.days) t.net_per_day_p = +(t.net * 100 / t.days).toFixed(2); t.standing = 0; } };
  for (const s of Object.values(out.scenarios)) {
    const sc = s.totals.standing || 0;
    s.sc_full = sc;
    strip(s.totals); strip(s.ess); strip(s.replay); strip(s.solar_only); strip(s.nosys);
    s.monthly.forEach((m) => { m.net = +(m.net - m.standing).toFixed(2); m.standing = 0; });
    if (s.split) for (const k of ["ess", "house_only", "perfect", "net"]) s.split[k] = +(s.split[k] - sc).toFixed(2);
    s.standing_p_day = 0;
  }
  out.meta.no_standing = true;
  return out;
}
/** Recompute the active results from the raw payloads and the standing-charge switch. */
export function applyView() {
  S.resultsBy = {};
  for (const [m, r] of Object.entries(S.raw)) S.resultsBy[m] = S.noSC ? adjustForStanding(r) : r;
  S.results = S.resultsBy[S.mode] || null;
  S.details = {};
}
export const modeName = () => (S.mode === "rt" ? "forecast-driven" : "perfect-foresight");
export const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

// ----------------------------------------------------------------------------- dom
export function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ----------------------------------------------------------------------------- formatting
const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const n0 = (v) => nf0.format(v), n1 = (v) => nf1.format(v), n2 = (v) => nf2.format(v);
export function gbp(v, dp = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const s = (dp === 0 ? nf0 : dp === 1 ? nf1 : nf2).format(Math.abs(v));
  return (v < -0.0049 * (dp === 0 ? 100 : 1) ? "−£" : "£") + s;
}
export const gbpSigned = (v, dp = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + "£" + (dp === 0 ? nf0 : nf2).format(Math.abs(v));
export const kwh = (v, d = 0) => (d ? nf1 : nf0).format(v) + " kWh";
export const pct = (v, d = 0) => (d ? nf1 : nf0).format(v) + "%";
export const pence = (v) => nf2.format(v) + "p";
/** Net bill phrased for people: positive = you pay, negative = you earn. */
export function netPhrase(v) { return v >= 0 ? `${gbp(v)} bill` : `${gbp(-v)} income`; }

// ----------------------------------------------------------------------------- theme
export function theme() { return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("otl-theme", t); } catch (e) { /* private mode */ }
  rebuildCharts();
}
export function initTheme() {
  try { const t = localStorage.getItem("otl-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
}
export function tok() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return {
    page: g("--page"), surface: g("--surface"), ink: g("--ink"), ink2: g("--ink2"), muted: g("--muted"), grid: g("--grid"), axis: g("--axis"),
    border: g("--border"), raised: g("--raised"),
    s: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => g(`--s${i}`)),
    good: g("--good"), warn: g("--warn"), crit: g("--crit"), dark: theme() === "dark",
  };
}
export const SERIES_NAMES = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"];

// ----------------------------------------------------------------------------- colour helpers
const hex2rgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgb2hex = (c) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((x, i) => x + (B[i] - x) * t)); }
export function lum(h) { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export const onColor = (bg) => (lum(bg) > 0.34 ? "#0b0b0b" : "#ffffff");

// Sequential: the reference blue ramp (steps 100 -> 700); in dark mode the anchor flips (near-zero = dark).
const BLUE = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
export function seqColor(t, dark = tok().dark) {
  t = Math.max(0, Math.min(1, t));
  const ramp = dark ? [...BLUE].reverse() : BLUE;
  const x = t * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(x));
  return mix(ramp[i], ramp[i + 1], x - i);
}
// Diverging: blue (cheaper / better) <-> neutral gray <-> red (dearer / worse); equal arms.
export function divColor(v, max, t = tok()) {
  const mid = t.dark ? "#383835" : "#f0efec";
  const lo = t.s[0], hi = t.s[7];
  const k = Math.max(-1, Math.min(1, v / max));
  return k < 0 ? mix(mid, lo, -k) : mix(mid, hi, k);
}

// ----------------------------------------------------------------------------- scenarios
export const REF = () => (S.status && S.status.reference) || "go_cur|outgoing";
export function scn(key) { return S.results && S.results.scenarios[key]; }
export function label(s) {
  if (!s) return "";
  if (s.imp === "flux_imp") return "Flux (import + export)";
  return `${s.imp_name} + ${s.exp_name}`;
}
export function ranked() {
  return Object.values(S.results.scenarios).sort((a, b) => a.totals.net - b.totals.net);
}
export function renewKey() { return "go_fix|outgoing"; }
/** stable colour slot per scenario (first free slot when first used; survives filtering) */
export function slotFor(key) {
  if (S.slotMap[key] === undefined) {
    const used = new Set(Object.values(S.slotMap));
    let i = 0; while (used.has(i) && i < 8) i++;
    S.slotMap[key] = i % 8;
  }
  return S.slotMap[key];
}
export function releaseSlot(key) { delete S.slotMap[key]; }

// ----------------------------------------------------------------------------- charts
const charts = new Map();   // container element -> {chart, build}
export function baseOption(t = tok()) {
  return {
    animationDuration: 250, animationDurationUpdate: 250,
    textStyle: { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: t.ink2 },
    tooltip: { backgroundColor: t.raised, borderColor: t.border, borderWidth: 1, textStyle: { color: t.ink, fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,.25);border-radius:8px;", confine: true },
    legend: { show: false },
  };
}
export function axisStyle(t = tok()) {
  return {
    axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" } },
  };
}
export function mountChart(div, build) {
  let rec = charts.get(div);
  if (!rec) {
    // ECharts measures its container on init, so wait until it is attached to the page.
    rec = { chart: null, build, ro: null, tries: 0, narrow: false };
    charts.set(div, rec);
  }
  rec.build = build;
  const paint = () => { const t = tok(); t.w = div.clientWidth; t.narrow = t.w < 560; rec.narrow = t.narrow; rec.chart.setOption(rec.build(t), true); };
  const start = () => {
    if (!document.body.contains(div)) {
      if (rec.tries++ < 180) requestAnimationFrame(start);
      return;
    }
    if (!rec.chart) {
      rec.chart = echarts.init(div, null, { renderer: "canvas" });
      rec.ro = new ResizeObserver(() => {
        if (!rec.chart) return;
        rec.chart.resize();
        if ((div.clientWidth < 560) !== rec.narrow) paint();          // layout depends on width: rebuild when it flips
      });
      rec.ro.observe(div);
    }
    paint();
  };
  start();
  return rec.chart;
}
/** The chart instance for a container (after it has been painted). */
export function chartOf(div) { const r = charts.get(div); return r && r.chart; }
/** Run fn(chart) once the chart exists (it may be waiting for its container to be attached). */
export function withChart(div, fn) {
  const go = (n) => { const c = chartOf(div); if (c) fn(c); else if (n < 180) requestAnimationFrame(() => go(n + 1)); };
  go(0);
}
export function rebuildCharts() { for (const [div, rec] of charts) { if (!document.body.contains(div)) { if (rec.chart) rec.chart.dispose(); if (rec.ro) rec.ro.disconnect(); charts.delete(div); continue; } if (rec.chart) { const t = tok(); t.w = div.clientWidth; t.narrow = t.w < 560; rec.chart.setOption(rec.build(t), true); } } }
export function disposeCharts() { for (const [, rec] of charts) { if (rec.chart) rec.chart.dispose(); if (rec.ro) rec.ro.disconnect(); rec.tries = 1e9; } charts.clear(); }

// ----------------------------------------------------------------------------- tables
export function tableEl(cols, rows, opts = {}) {
  const t = el("table");
  t.append(el("thead", null, el("tr", null, cols.map((c) => el("th", { text: c })))));
  const tb = el("tbody");
  rows.forEach((r, ri) => {
    const tr = el("tr", { class: [opts.rowClass && opts.rowClass(ri), opts.onRow ? "click" : ""].filter(Boolean).join(" ") });
    if (opts.onRow) tr.addEventListener("click", () => opts.onRow(ri));
    r.forEach((c, i) => tr.append(el("td", { class: i ? "num" : "", text: c })));
    tb.append(tr);
  });
  t.append(tb);
  return el("div", { class: "tbl" }, t);
}

/** A card with an optional chart + table twin. cfg: {title, sub, height, build(t), table():{cols,rows}, controls:Node, legend:Node} */
export function chartCard(cfg) {
  const body = el("div");
  const chartDiv = el("div", { class: "chart", style: { height: (cfg.height || 320) + "px" } });
  const tblDiv = el("div", { hidden: true });
  let mode = "chart";
  const toggle = cfg.table ? el("div", { class: "seg", role: "group", "aria-label": "View as" },
    ["Chart", "Table"].map((m) => el("button", {
      "aria-pressed": m === "Chart" ? "true" : "false", text: m, type: "button",
      onclick: (e) => {
        mode = m.toLowerCase();
        for (const b of e.currentTarget.parentNode.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false");
        chartDiv.hidden = mode !== "chart"; tblDiv.hidden = mode !== "table";
        if (mode === "table") { const d = cfg.table(); tblDiv.replaceChildren(tableEl(d.cols, d.rows)); }
        else { chartOf(chartDiv)?.resize(); }
      },
    }))) : null;
  const card = el("section", { class: "card" },
    el("div", { class: "ch" }, el("div", null, el("h3", { text: cfg.title }), cfg.sub ? el("div", { class: "sub", text: cfg.sub }) : null),
      el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, cfg.controls || null, toggle)),
    cfg.legend || null, chartDiv, tblDiv);
  card.chartDiv = chartDiv;
  card.render = () => { if (cfg.build) mountChart(chartDiv, cfg.build); if (mode === "table" && cfg.table) { const d = cfg.table(); tblDiv.replaceChildren(tableEl(d.cols, d.rows)); } };
  return card;
}
export function legendEl(items) {
  return el("div", { class: "legend" }, items.map((it) => el("span", null, el("i", { class: it.line ? "ln" : "", style: { background: it.color } }), it.text)));
}
export function tile(label, value, detail, opts = {}) {
  return el("div", { class: "card tile" + (opts.ref ? " ref" : "") },
    el("div", { class: "l", text: label }), el("div", { class: "v " + (opts.cls || ""), text: value }), el("div", { class: "d" }, detail || ""));
}
export function badge(text, kind) { return el("span", { class: "badge " + kind, text }); }

// ----------------------------------------------------------------------------- misc
export function months(label) { const [y, m] = label.split("-"); return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1] + " " + y.slice(2); }
export function setBusy(b) { S.busy = b; document.getElementById("view")?.classList.toggle("loading", b); }
export function downloadCSV(name, cols, rows) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob([[cols, ...rows].map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" });
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
}
