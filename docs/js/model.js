import { S, api, post, el, n0, n1, n2, kwh, tableEl, tile, badge, months, isStatic } from "./core.js";

const FIELDS = [
  ["Battery", [
    ["nominal_kwh", "Nominal capacity (kWh)", "num", 0.5, "2 × 16 kWh Seplos"],
    ["soh", "State of health (%)", "pct", 1, "VRM diagnostics said 94 %"],
    ["soc_min", "Reserve floor (%)", "pct", 1, "kept back for power cuts; the GX uses 2 % today"],
    ["soc_max", "Maximum charge (%)", "pct", 1, "lower it (e.g. 95) to be kinder to the cells"],
    ["start_soc", "Starting charge (%)", "pct", 5, "battery level at midnight on day one"],
    ["eta_bat", "Cell round trip (%)", "pct", 0.5, "measured ≈ 96 %"],
    ["wear_p", "Wear cost (p per kWh discharged)", "num", 0.1, "£2,800 ÷ (6,000 cycles × 30 kWh)"],
    ["idle_kw", "Standby draw (kW)", "num", 0.005, "MultiPlus + GX + MPPTs + BMS"],
  ]],
  ["Inverter / charger and grid", [
    ["inv_kw", "Inverter continuous (kW)", "num", 0.1, "MultiPlus-II 48/8000 @ 25 °C"],
    ["bch_kw", "Max battery charge (kW DC)", "num", 0.1, "DVCC 100 A limit across all sources"],
    ["bdis_kw", "Max battery discharge (kW)", "num", 0.5, "the inverter is the real limit"],
    ["exp_kw", "Export limit (kW)", "num", 0.1, "DNO / G99 registered limit"],
    ["imp_kw", "Import limit (kW)", "num", 1, "100 A supply"],
  ]],
  ["Optimiser behaviour", [
    ["brown_export", "Export energy bought from the grid", "bool", 0, "what you do today: charge cheap, sell dear"],
    ["vat_pct", "VAT on imports (%)", "vat", 0, "0 % until at least April 2027"],
    ["hurdle_p", "Reluctance to grid-charge (p/kWh)", "num", 0.1, "raise to stop it cycling for crumbs"],
    ["curt_pen_p", "Curtailment penalty (p/kWh)", "num", 10, "the 'never waste solar' rule"],
    ["horizon_days", "Look-ahead (days)", "num", 1, "2 = plan today and tomorrow together"],
    ["analysis_days", "History to analyse (days)", "num", 10, "up to a year"],
    ["realistic", "Also run the forecast-driven controller", "bool", 0, "takes ~2 minutes instead of ~15 s; turn off for quick what-ifs"],
    ["import_scale", "What-if: scale every import rate and standing charge", "num", 0.01, "1.10 = a 10 % price rise"],
    ["export_scale", "What-if: scale every export rate", "num", 0.01, "0.90 = a 10 % cut"],
  ]],
];
const SEGS = [["inv_seg", "Inverter efficiency (DC → AC)"], ["chg_seg", "Charger efficiency (AC → DC)"]];

export async function renderModel(root) {
  const st = S.status, P = st.settings, d = st.data || {};
  const real = st.source === "vrm";

  // ------------------------------------------------------------ data summary
  const kv = (pairs) => el("dl", { class: "kv" }, pairs.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]));
  const summary = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Your energy data" }), el("div", { class: "sub", text: real ? "Loaded from the Victron VRM and Octopus smart-meter export." : "No export found - demo data in use." }))),
    kv([["Source", real ? `Victron VRM (${d.interval})` : "DEMO: Open-Meteo sunshine + synthetic house load"], ["Analysed", `${d.analysis_from} → ${d.analysis_to} (${d.analysis_days} days)`],
      ["Solar generated", kwh(d.pv_kwh)], ["House consumption", kwh(d.load_kwh)], ...(real ? [["Grid import (VRM)", kwh(d.import_kwh)], ["Grid export (VRM)", kwh(d.export_kwh)], ["Data coverage", n1(d.coverage_pct) + "%"], ["Gap-filled slots", `${d.missing_slots} missing · ${d.partial_slots} partial`], ["Battery SOC history", d.has_soc ? "yes" : "no"], ["Octopus meter data", d.has_octopus ? "yes" : "no"]] : [])]));

  // ------------------------------------------------------------ warnings
  const notes = [];
  if (!real) notes.push(el("div", { class: "note warn" }, el("b", { text: "Load your real data: " }), "double-click ", el("b", { text: "the data export" }), " (it saves ", el("b", { text: "a local data file" }), "), then press Re-run. API keys never leave your machine."));
  const cc = st.agile && st.agile.csv_check;
  if (cc && cc.best_region && !cc.matches_account_region) notes.push(el("div", { class: "note warn" }, el("b", { text: "Your Agile CSV isn't for your region. " }),
    `${cc.file} matches region ${cc.best_region} (East Midlands) ${cc.best_basis} to within ${cc.best_mean_abs_p}p, but your account is region ${cc.expected_region} (West Midlands). The app prices Agile from the Octopus API for region ${cc.expected_region}, ex-VAT, instead - using the CSV would misprice Agile by ~0.2p everywhere and ~2.7p in the 16:00-19:00 peak.`));
  if (st.catalogue_error) notes.push(el("div", { class: "note warn" }, "Couldn't refresh tariff rates from Octopus (", st.catalogue_error, ") - using the last saved rates."));
  (d.vrm_errors || []).slice(0, 3).forEach((e) => notes.push(el("div", { class: "note warn" }, "VRM export warning: " + e)));
  (d.octopus_errors || []).slice(0, 3).forEach((e) => notes.push(el("div", { class: "note warn" }, "Octopus export warning: " + e)));

  // ------------------------------------------------------------ settings form
  const inputs = {};
  const form = el("div");
  FIELDS.forEach(([group, fs]) => {
    form.append(el("h3", { style: { margin: "14px 0 8px", fontSize: "13px", color: "var(--muted)", fontWeight: 600 }, text: group.toUpperCase() }));
    form.append(el("div", { class: "form" }, fs.map(([key, lab, type, step, help]) => {
      let input;
      if (type === "bool") input = el("input", { type: "checkbox", style: { alignSelf: "flex-start", width: "18px", height: "18px" } }), input.checked = !!P[key];
      else if (type === "vat") { input = el("select", null, el("option", { value: "0", text: "0 % (current)" }), el("option", { value: "5", text: "5 %" })); input.value = String(P[key]); }
      else { input = el("input", { type: "number", step }); input.value = type === "pct" ? +(P[key] * 100).toFixed(2) : P[key]; }
      inputs[key] = { input, type };
      return el("label", null, lab, input, el("span", { class: "help", text: help }));
    })));
  });
  const segInputs = {};
  form.append(el("h3", { style: { margin: "14px 0 8px", fontSize: "13px", color: "var(--muted)", fontWeight: 600 }, text: "CONVERTER EFFICIENCY (TWO SEGMENTS: [kW, EFFICIENCY])" }));
  form.append(el("div", { class: "form" }, SEGS.map(([key, lab]) => {
    const row = el("div", { style: { display: "flex", gap: "6px" } }, P[key].flat().map((v, i) => { const inp = el("input", { type: "number", step: i % 2 ? 0.005 : 0.1, value: v, style: { width: "100%" } }); (segInputs[key] = segInputs[key] || []).push(inp); return inp; }));
    return el("label", null, lab, row, el("span", { class: "help", text: "kW in segment 1, its efficiency, then kW and efficiency for segment 2 (measured over 48 h)" }));
  })));
  const collect = () => {
    const out = {};
    for (const [key, { input, type }] of Object.entries(inputs)) {
      if (type === "bool") out[key] = input.checked; else if (type === "vat") out[key] = Number(input.value);
      else { const v = parseFloat(input.value); if (!Number.isNaN(v)) out[key] = type === "pct" ? v / 100 : v; }
    }
    for (const [key, arr] of Object.entries(segInputs)) { const v = arr.map((i) => parseFloat(i.value)); out[key] = [[v[0], v[1]], [v[2], v[3]]]; }
    out.horizon_days = Math.max(1, Math.min(3, Math.round(out.horizon_days || 2)));
    out.analysis_days = Math.max(30, Math.min(420, Math.round(out.analysis_days || 365)));
    return out;
  };
  const snapshot = isStatic();
  if (snapshot) form.querySelectorAll("input, select").forEach((x) => { x.disabled = true; });     // read-only in the web snapshot
  const settings = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "System settings" }),
    el("div", { class: "sub", text: snapshot ? "The assumptions this snapshot was calculated with (read-only here; the downloadable app lets you change them and re-run)." : "Change anything and re-run. Results are cached per setting, so going back is instant." })),
    snapshot ? null : el("div", { style: { display: "flex", gap: "8px" } },
      el("button", { class: "btn ghost small", type: "button", text: "Reset to measured defaults", onclick: () => S.rerun({ settings: st.defaults, force: true }) }),
      el("button", { class: "btn small", type: "button", text: "Apply & re-run", onclick: () => S.rerun({ settings: collect(), force: true }) }))), form);

  // ------------------------------------------------------------ method
  const method = el("section", { class: "card" }, el("div", { class: "ch" }, el("h3", { text: "How the numbers are made" })),
    el("ul", { style: { margin: 0, paddingLeft: "18px", color: "var(--ink2)" } }, [
      "Every day of the last 12 months is replayed with your real solar generation and house consumption (VRM, 15-minute data).",
      "For each tariff pairing a linear programme decides, half-hour by half-hour, when to charge from the grid, hold, discharge, or export - looking 2 days ahead, committing to day one. It is the same physical model as a typical home-battery planner: two-segment inverter and charger efficiency, one converter shared between charging and inverting, battery round trip, standby draw, 6.4 kW export cap, no curtailed solar.",
      "The inverter can only draw DC from solar or the battery, so buying and instantly re-selling grid energy is not allowed - any grid-to-export arbitrage has to pay the real charger, cell and inverter losses plus wear.",
      "Prices are today's published rates on last year's usage (so the price rise on 5 Nov is included), with VAT at 0 %. Agile and Agile Outgoing use the real half-hourly history for your region.",
      "The optimiser knows the day's solar and usage in advance, so absolute savings are an upper bound. The ranking of tariffs is the reliable part.",
      "Tariffs that need an EV, heat pump or an Octopus-controllable battery are excluded.",
    ].map((x) => el("li", { text: x, style: { margin: "5px 0" } }))));

  root.append(el("div", { class: "grid g2" }, summary, el("div", { class: "grid" }, ...notes.length ? notes : [el("div", { class: "note" }, "Nothing needs attention.")])), el("div", { style: { height: "16px" } }), settings, el("div", { style: { height: "16px" } }), method);

  // ------------------------------------------------------------ reality check (real data only)
  if (real) {
    try {
      const a = await api("/api/actual");
      if (a.available && a.table.oi) {
        const rows = a.months.map((m, i) => [months(m), n0(a.table.gi[i]), n0(a.table.oi[i] || 0), n0(a.table.ge[i]), n0(a.table.oe[i] || 0)]);
        root.append(el("div", { style: { height: "16px" } }), el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Reality check: Victron vs your Octopus meter" }), el("div", { class: "sub", text: "Monthly kWh. If these disagree the VRM numbers (and so the savings) are off." }))),
          tableEl(["Month", "Import · VRM", "Import · meter", "Export · VRM", "Export · meter"], rows)));
      }
    } catch (e) { /* optional */ }
  }
}
