import { S, api, post, el, n0, label, ranked, REF, renewKey, theme, setTheme, initTheme, disposeCharts, setBusy, months, applyView, isStatic } from "./core.js";
import { renderVerdict } from "./verdict.js";

// Views register here; later modules are loaded lazily so a bug in one tab never blanks the others.
const VIEWS = [
  { id: "verdict", title: "Verdict", mod: null, render: renderVerdict },
  { id: "matrix", title: "Tariff matrix", mod: "./matrix.js", fn: "renderMatrix" },
  { id: "timeline", title: "Month by month", mod: "./timeline.js", fn: "renderTimeline" },
  { id: "arbitrage", title: "Arbitrage", mod: "./arbitrage.js", fn: "renderArbitrage" },
  { id: "day", title: "Day explorer", mod: "./day.js", fn: "renderDay" },
  { id: "dispatch", title: "Battery strategy", mod: "./dispatch.js", fn: "renderDispatch" },
  { id: "battery", title: "Losses & health", mod: "./battery.js", fn: "renderBattery" },
  { id: "tariffs", title: "Tariffs", mod: "./tariffs.js", fn: "renderTariffs" },
  { id: "model", title: "Data & model", mod: "./model.js", fn: "renderModel" },
];

const $ = (id) => document.getElementById(id);
let pollTimer = null;

function buildTabs() {
  const tabs = $("tabs");
  tabs.replaceChildren(...VIEWS.map((v) => el("button", {
    role: "tab", id: "tab-" + v.id, "aria-selected": String(S.view === v.id), text: v.title, type: "button",
    onclick: () => { location.hash = "#/" + v.id; },
  })));
}

function currentViewId() {
  const h = (location.hash || "").replace(/^#\//, "");
  return VIEWS.some((v) => v.id === h) ? h : "verdict";
}

async function renderView() {
  S.view = currentViewId();
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.id === "tab-" + S.view)));
  const root = $("view");
  disposeCharts();
  root.replaceChildren();
  S.afterSelect = null;
  const v = VIEWS.find((x) => x.id === S.view);
  const job = S.status && S.status.job;
  if (!S.results) {
    if (S.view === "model" && S.status) { /* settings are usable while waiting */ } else { renderProgress(root); return; }
  }
  try {
    if (v.render) v.render(root);
    else { const m = await import(v.mod + "?v=1"); await m[v.fn](root); }
  } catch (e) {
    console.error(e);
    root.replaceChildren(el("div", { class: "empty" }, el("b", { text: "This view failed to render" }), String(e && e.message || e)));
  }
}

function renderProgress(root) {
  const j = (S.status && S.status.job) || { done: 0, total: 1, msg: "starting", status: "running" };
  if (j.status === "error") { root.append(el("div", { class: "empty" }, el("b", { text: "The optimiser stopped" }), j.error || "unknown error")); return; }
  root.append(el("div", { class: "empty" }, el("b", { text: "Optimising 12 months of battery dispatch…" }),
    el("div", { style: { maxWidth: "420px", margin: "10px auto" } }, el("div", { class: "progress" }, el("i", { style: { width: Math.round(100 * j.done / Math.max(1, j.total)) + "%" } }))),
    j.msg || ""));
}

function updateHeader() {
  const st = S.status;
  if (!st || !st.data) return;
  const d = st.data;
  const pill = $("datapill");
  pill.hidden = false;
  pill.className = "pill " + (st.source === "vrm" ? "real" : "demo");
  pill.replaceChildren(el("i"), st.source === "vrm" ? (isStatic() ? `One household's real data · ${d.analysis_days} days` : `Your data · ${d.analysis_days} days`) : "DEMO data");
  $("sub").textContent = `${d.analysis_from} → ${d.analysis_to}`;
  const b = $("banner");
  const msgs = [];
  if (st.source !== "vrm") {
    b.className = "banner demo";
    b.replaceChildren(el("b", { text: "Demo data. " }), "These numbers use real Octopus rates and real sunshine on your roofs, but a made-up house-load. Run ", el("b", { text: "the data export" }), " to load measured household data, then Re-run.");
    b.hidden = false;
  } else { b.hidden = true; }
  $("sel-vat").value = String(st.settings.vat_pct);
  $("chk-brown").checked = !!st.settings.brown_export;
  if (isStatic()) {                                    // read-only snapshot: the optimiser can't be re-run here
    const snap = st.snapshot || {};
    $("btn-rerun").hidden = true;
    $("sel-vat").disabled = true;
    $("chk-brown").disabled = true;
    $("runmsg").textContent = "snapshot · assumptions fixed";
    b.className = "banner demo";
    b.replaceChildren(el("b", { text: "Pre-computed snapshot. " }), `Generated ${snap.generated || ""} from one household's real year of solar, battery and smart-meter data; read-only, so VAT, battery settings and the optimiser can't be changed here.`,
      snap.level === "full" ? el("b", { text: " Private build: contains personal identifiers - not for public release." }) : "");
    b.hidden = false;
  }
}

function fillScenarioSelect() {
  const sel = $("sel-scn");
  if (!S.results) return;
  const rows = ranked();
  sel.replaceChildren(...rows.map((r) => el("option", { value: r.key, text: `${label(r)}  ·  ${r.totals.net >= 0 ? "£" + n0(r.totals.net) : "−£" + n0(-r.totals.net)}` + (r.current ? "  (current)" : "") })));
  if (!S.sel || !S.results.scenarios[S.sel]) S.sel = (rows.find((r) => !r.current) || rows[0]).key;
  sel.value = S.sel;
}

S.setSel = (key) => {
  S.sel = key;
  $("sel-scn").value = key;
  if (S.afterSelect) S.afterSelect(); else renderView();
};

async function loadResults() {
  S.raw = { perfect: await api("/api/results?mode=perfect") };
  if (S.status.has_rt) S.raw.rt = await api("/api/results?mode=rt");
  let saved = null, sc = null, flat = null;
  try { saved = localStorage.getItem("otl-mode"); sc = localStorage.getItem("otl-nosc"); flat = localStorage.getItem("otl-flat"); } catch (e) { /* ignore */ }
  S.mode = S.raw[saved] ? saved : (S.raw.rt ? "rt" : "perfect");
  S.noSC = sc === "1";
  if (flat) S.flat = flat;
  $("chk-sc").checked = !S.noSC;
  applyView();
  const sm = $("sel-mode");
  sm.value = S.mode;
  sm.querySelector('option[value="rt"]').disabled = !S.raw.rt;
  try { S.tariffs = await api("/api/tariffs"); } catch (e) { S.tariffs = null; }
  S.details = {};
  fillScenarioSelect();
  const f = $("foot");
  const m = S.results.meta;
  f.textContent = `Optimiser: linear programme per day (2-day look-ahead), same kind of physical model used by home-battery planners · ${m.pairs} pairings × ${S.status.has_rt ? "2 controllers" : "1 controller"} in ${m.seconds}s · rates fetched ${new Date((S.status.catalogue_fetched || 0) * 1000).toLocaleString("en-GB")} · prices ex-VAT with VAT ${m.params.vat_pct}% applied to imports.`;
}

async function poll() {
  clearTimeout(pollTimer);
  try {
    S.status = await api("/api/status");
  } catch (e) { pollTimer = setTimeout(poll, 1500); return; }
  const j = S.status.job;
  updateHeader();
  const running = j.status === "running";
  $("btn-rerun").disabled = running;
  $("runmsg").textContent = running ? `Optimising… ${j.done}/${j.total}` : "";
  if (running) {
    setBusy(!!S.results);
    if (!S.results) renderView();
    pollTimer = setTimeout(poll, 700);
    return;
  }
  setBusy(false);
  if (j.status === "done" && (S.status.has_run)) {
    const sig = S.status.settings && JSON.stringify([S.status.settings, S.status.data && S.status.data.analysis_to]);
    await loadResults();
    await renderView();
  } else if (j.status === "error") {
    renderView();
  }
}

async function rerun(extra) {
  await post("/api/run", extra || {});
  poll();
}

function wire() {
  $("btn-rerun").addEventListener("click", () => rerun({ force: true }));
  $("btn-theme").addEventListener("click", () => setTheme(theme() === "dark" ? "light" : "dark"));
  $("sel-scn").addEventListener("change", (e) => S.setSel(e.target.value));
  $("sel-mode").addEventListener("change", (e) => {
    S.mode = e.target.value;
    try { localStorage.setItem("otl-mode", S.mode); } catch (err) { /* ignore */ }
    S.results = S.resultsBy[S.mode]; S.details = {};
    fillScenarioSelect(); renderView();
  });
  $("chk-sc").addEventListener("change", (e) => {
    S.noSC = !e.target.checked;
    try { localStorage.setItem("otl-nosc", S.noSC ? "1" : "0"); } catch (err) { /* ignore */ }
    applyView(); fillScenarioSelect(); renderView();
  });
  $("sel-vat").addEventListener("change", (e) => rerun({ settings: { vat_pct: Number(e.target.value) } }));
  $("chk-brown").addEventListener("change", (e) => rerun({ settings: { brown_export: e.target.checked } }));
  addEventListener("hashchange", renderView);
}
S.rerun = rerun;
S.reload = async () => { await poll(); };

initTheme();
buildTabs();
wire();
poll();
