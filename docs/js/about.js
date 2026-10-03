// About: what this project is, why it exists and how the numbers are made. Plain prose, with the few figures that
// depend on the data (days analysed, coverage, calibration checks, system settings) read from the app's own state.
import { S, api, el, n0, n1, n2, gbp, netPhrase, tile, isStatic } from "./core.js";

/** "plain **bold** plain" -> text and <b> nodes (no innerHTML). */
const rich = (s) => s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((x) => (x.startsWith("**") ? el("b", { text: x.slice(2, -2) }) : x));
const p = (s, cls) => el("p", { class: "ab-p" + (cls ? " " + cls : "") }, rich(s));
const ul = (items) => el("ul", { class: "ab-ul" }, items.map((x) => el("li", null, rich(x))));
const sum = (a) => (a || []).reduce((t, v) => t + (Number.isFinite(v) ? v : 0), 0);

function section(id, title, sub, kids, { open = true, collapsible = true } = {}) {
  const head = el("div", { class: "ch" }, el("div", null, el("h3", { text: title }), sub ? el("div", { class: "sub", text: sub }) : null));
  if (!collapsible) return el("section", { class: "card ab", id }, head, kids);
  return el("details", { class: "card ab", id, open: open ? "" : null }, el("summary", null, el("h3", { text: title }), sub ? el("span", { class: "sub", text: sub }) : null), el("div", { class: "ab-body" }, kids));
}

function jump(id) {
  const t = document.getElementById(id);
  if (!t) return;
  if (t.tagName === "DETAILS") t.open = true;
  t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// ------------------------------------------------------------------------------------------------ system diagram
function systemSvg(P, cap) {
  const effs = [...(P.inv_seg || []), ...(P.chg_seg || [])].map((s) => s[1]);
  const eff = effs.length ? `${Math.round(Math.min(...effs) * 100)}–${Math.round(Math.max(...effs) * 100)}%` : "";
  const box = (x, y, w, c, t, a, b) => `<rect x="${x}" y="${y}" width="${w}" height="70" rx="9" fill="var(--page)" stroke="${c}" stroke-width="2"/>`
    + `<text x="${x + 14}" y="${y + 25}" font-size="13.5" font-weight="600" fill="var(--ink)">${t}</text>`
    + `<text x="${x + 14}" y="${y + 44}" font-size="11.5" fill="var(--ink2)">${a}</text>` + (b ? `<text x="${x + 14}" y="${y + 59}" font-size="11.5" fill="var(--ink2)">${b}</text>` : "");
  const arrow = (x1, y, x2, both) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--ink2)" stroke-width="2" marker-end="url(#ab-ar)"${both ? ' marker-start="url(#ab-ar)"' : ""}/>`;
  const bus = (x, label) => `<line x1="${x}" y1="52" x2="${x}" y2="197" stroke="var(--axis)" stroke-width="7" stroke-linecap="round"/><text x="${x}" y="240" text-anchor="middle" font-size="11.5" fill="var(--muted)">${label}</text>`;
  return `<svg viewBox="0 0 760 250" role="img" aria-label="Energy flows: solar and battery share a DC bus; one inverter/charger joins it to the AC bus, which feeds the house and trades with the grid.">`
    + `<defs><marker id="ab-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink2)"/></marker></defs>`
    + box(20, 22, 170, "var(--s2)", "Solar", "12.6 kWp, two roofs", "DC-coupled")
    + box(20, 157, 170, "var(--s5)", "Battery", `${n0(P.nominal_kwh)} kWh nominal`, `${n1(cap)} kWh usable`)
    + box(285, 89, 170, "var(--ink2)", "Inverter / charger", `${n1(P.inv_kw)} kW continuous`, eff ? `${eff} efficient each way` : "")
    + box(555, 22, 185, "var(--ink2)", "House", "all the household's loads", "")
    + box(555, 157, 185, "var(--s1)", "Grid", `import up to ${n0(P.imp_kw)} kW`, `export up to ${n1(P.exp_kw)} kW`)
    + bus(235, "DC bus") + bus(505, "AC bus")
    + arrow(190, 57, 233) + arrow(190, 192, 233, true) + arrow(237, 124, 283, true) + arrow(455, 124, 503, true) + arrow(505, 57, 553) + arrow(505, 192, 553, true)
    + `</svg>`;
}

// ------------------------------------------------------------------------------------------------ the page
export async function renderAbout(root) {
  const st = S.status || {}, P = st.settings || {}, d = st.data || {};
  const real = st.source === "vrm";
  const meta = S.results && S.results.meta;
  const snap = isStatic();
  const days = d.analysis_days || 365;
  const pairs = meta ? meta.pairs : 26;
  const cap = st.cap_kwh || (P.nominal_kwh * P.soh);

  // ---- intro
  const intro = el("section", { class: "card hero" },
    el("div", { class: "eyebrow", text: "About this project" }),
    el("h2", { class: "ab-title", text: "A year of one home's solar and battery, replayed through every Octopus tariff pairing" }),
    el("p", { class: "lead" }, rich("**The question:** when the current Go fixed contract ends on 5 November 2026, which import + export tariff pairing is cheapest for a home with solar panels and a large battery? Rather than guess from averages, this replays every half-hour of the last 12 months of real data under each tariff, with a battery controller that plays each one as well as it realistically can.")),
    el("div", { class: "chips", style: { marginTop: "14px" } }, [
      ["ab-why", "Why"], ["ab-how", "How it works"], ["ab-model", "Battery model"], ["ab-ctrl", "Two controllers"], ["ab-read", "Reading the numbers"], ["ab-checks", "Checks"], ["ab-limits", "Limits"], ["ab-tabs", "The tabs"],
    ].map(([id, t]) => el("button", { type: "button", class: "chip", text: t, onclick: () => jump(id) }))));

  const facts = el("div", { class: "grid g4" },
    tile("Measured data", `${days} days`, d.analysis_from ? `${d.analysis_from} → ${d.analysis_to}` : "one full year"),
    tile("Tariff pairings", String(pairs), "every compatible import × export combination"),
    tile("Controllers", "2", "realistic (forecast-driven) and perfect foresight"),
    tile("Resolution", "30 min", "every half-hour of every day is simulated"));

  // ---- why
  const why = section("ab-why", "Why do this?", null, [
    ul([
      "**Comparison tools assume a typical usage shape.** A home with 12.6 kWp of solar and a 32 kWh battery is nothing like it: it exports a large share of what it generates, and the battery can move energy from cheap hours to expensive ones. The best tariff depends on what the battery does.",
      "**Import and export tariffs are chosen as a pair,** and some only work together (Flux import with Flux export). That is " + pairs + " compatible pairings, too many to compare by hand.",
      "**Cheap overnight rates only pay if the losses leave a margin.** Charging from the grid and selling later pays inverter, charger and cell losses plus standby. The model charges for every one, so the arbitrage answer is earned, not assumed.",
      "**The current contract's rates end on 5 Nov 2026,** and the renewal rates are materially higher, so staying put is not a free default.",
      "**Show the working.** Every figure can be traced from the year, to a month, to a day, to individual half-hours, and the model is checked against what the system and the smart meter actually recorded.",
    ])]);

  // ---- how it works: the five steps
  const steps = [
    ["Measured data in", `Solar generation, house consumption, battery charge and grid flows from Victron's monitoring portal (15-minute), cross-checked against the Octopus smart meter (half-hourly). Everything is put on a 30-minute grid that handles the clocks changing (46- and 50-slot days).${real && d.coverage_pct != null ? ` Here: ${days} days, ${n1(d.coverage_pct)}% of half-hours present.` : ""}`],
    ["Tariff prices in", "Rates come from Octopus's public product API for the household's region. Time-of-use tariffs (Go, Flux, Prime, Outgoing) become a 48-slot daily price profile; Agile and Agile Outgoing use their real half-hourly price history. Today's published rates are applied to last year's usage, so the November rise is already in. Standing charges are included (and can be switched off); VAT is " + (P.vat_pct != null ? n0(P.vat_pct) : "0") + "%."],
    ["A battery controller per pairing", "A linear programme decides, half-hour by half-hour, whether to charge from solar or the grid, hold, run the house, or export, inside the system's real limits and with a two-day look-ahead. It is run twice: with perfect foresight (an upper bound) and as a realistic forecast-driven planner."],
    ["Bills and accounting", "For each pairing, net annual bill = import cost + standing charges − export income, taken from the metered import and export the battery's behaviour produces. On top of that: a savings ladder against a flat-rate home with no solar or battery, and arbitrage accounting that tags every battery kWh by where it came from."],
    ["Rank, then drill down", `${pairs} pairings × 2 controllers are ranked. The tabs then take you from the year to a month, a day and the half-hours inside it, with the working shown.`],
  ];
  const how = section("ab-how", "How it works", "From raw meter data to a ranked answer, in five steps.", [
    el("div", { class: "steps" }, steps.map(([t, x], i) => el("div", { class: "step" }, el("span", { class: "n", text: String(i + 1) }), el("div", null, el("b", { text: t }), el("p", { class: "ab-p", text: x }))))),
    el("div", { class: "ab-fig" }, el("div", { class: "ab-svg" }), p("**The system being modelled.** Solar feeds the DC bus directly; one inverter/charger joins it to the AC bus, so charging and inverting share a single converter. Every route through it pays an efficiency loss.", "muted")),
  ], { collapsible: false });
  how.querySelector(".ab-svg").innerHTML = systemSvg(P, cap);          // static string built above from numbers only

  // ---- battery model
  const kv = (rows) => el("dl", { class: "kv" }, rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]));
  const model = section("ab-model", "The battery model", "The physics the optimiser has to respect, half-hour by half-hour.", [
    el("div", { class: "grid g2" }, el("div", null,
      p("Every half-hour must balance on both electrical buses:"),
      ul([
        "**AC side:** grid import + inverter output = house load + grid export + charger input.",
        "**DC side:** solar used + battery discharge + charger output = inverter input + battery charge + standby draw.",
        "**Solar** the system cannot use is curtailed, and the optimiser is penalised heavily (" + n0(P.curt_pen_p || 200) + " p/kWh) for wasting any.",
        "**Efficiencies** are measured, in two segments each for inverter and charger (better at gentle power than at full power). Charging and inverting share one converter, so it cannot do both flat out at once.",
        "**No wash trading.** The inverter can only draw DC from solar or the battery, which closes the loophole of buying grid energy, pushing it through the charger and inverter and selling it straight back. Any grid-to-export arbitrage has to pay the full round-trip losses plus wear.",
        "**Wear** is costed at " + n1(P.wear_p || 1.5) + " p per kWh discharged (pack price ÷ rated lifetime throughput), so it will not cycle for pennies.",
      ])),
      el("div", null, kv([
        ["Battery, nominal", `${n0(P.nominal_kwh)} kWh`], ["Usable (state of health " + n0((P.soh || 0) * 100) + "%)", `${n1(cap)} kWh`], ["Reserve floor", `${n0((P.soc_min || 0) * 100)}% (kept for power cuts)`],
        ["Cell round trip", `${n0((P.eta_bat || 0) * 100)}%`], ["Inverter, continuous", `${n1(P.inv_kw)} kW`], ["Max battery charge", `${n1(P.bch_kw)} kW (DC)`],
        ["Export limit", `${n1(P.exp_kw)} kW`], ["Import limit", `${n0(P.imp_kw)} kW`], ["Standby draw", `${n0((P.idle_kw || 0) * 1000)} W`], ["Look-ahead", `${n0(P.horizon_days || 2)} days, day one committed`],
      ]), p(snap ? "These are the settings this snapshot was calculated with (see Data & model)." : "These are the current settings (change them in Data & model).", "muted")))]);

  // ---- two controllers
  const rows = [
    ["What it knows", "The whole day, and tomorrow, in advance", "Only what was knowable at the time"],
    ["Solar", "The actual generation", "Day-ahead Open-Meteo forecast for both roofs, scaled by a bias learned over the previous 10 days and nudged by how today has gone so far"],
    ["House load", "The actual consumption", "The average of the previous 14 days at each half-hour"],
    ["Prices", "Known", "Fixed tariffs are known. Agile's next-day prices exist only after 16:00; before that tomorrow is guessed from the previous 7 days"],
    ["Planning", "Once per day, with a two-day look-ahead", "Re-plans every 2 hours from the battery's real level"],
    ["Execution", "Exactly as planned", "Each half-hour is executed against what really happened, so forecast mistakes cost real money"],
    ["Role", "An upper bound; the gap to realistic is the foresight penalty", "The default view: what a real planner could achieve"],
  ];
  const ctrl = section("ab-ctrl", "Two controllers", "Perfect foresight shows the ceiling; realistic shows what you would actually get.", [
    el("div", { class: "tbl" }, el("table", { class: "ab-tbl" }, el("thead", null, el("tr", null, ["", "Perfect foresight", "Realistic (forecast-driven)"].map((h) => el("th", { text: h })))),
      el("tbody", null, rows.map(([a, b, c]) => el("tr", null, el("td", null, el("b", { text: a })), el("td", { text: b }), el("td", { text: c })))))),
    p("The realistic controller also applies a safety margin to its load forecast (between 1.0× and 1.5×), chosen per pairing from four sampled weeks. That is mildly in-sample, in the same way that tuning your own controller to your own tariff would be.", "muted"),
  ]);

  // ---- reading the numbers
  const qa = (q, a) => el("div", { class: "ab-qa" }, el("h4", { text: q }), p(a));
  const read = section("ab-read", "Reading the numbers", "What the figures mean, and what they do not.", [
    el("div", { class: "grid g2" },
      qa("What is the net annual bill?", "Import cost + standing charges − export income over the year. **Negative means the household is paid more than it spends.** The “Include standing charges” box at the top recalculates every figure, chart and ranking instantly for a pure-energy view."),
      qa("What is the savings ladder?", "It starts from a **flat 24/7 tariff with no solar and no battery** (Flexible, 12M or 18M Fixed, your choice). Three steps then lead to the real bill: the **tariff effect** (the same usage on this pairing's time-of-use rates), **solar** alone (a plain grid-tie inverter), and the **battery** on top. They add up exactly to the total saving."),
      qa("What does arbitrage mean here?", "Buying grid energy cheaply to use or sell later. The Arbitrage tab tags each battery kWh as grid-charged or solar-charged (a well-mixed tank, so totals are unchanged) and values it two ways: **accounting** (income + bills avoided − purchase cost − wear) and a **counterfactual** against the same year with a solar-only battery. The counterfactual is the honest one: it also captures solar that no longer fits in a battery already full of cheap night energy."),
      qa("Does each tariff really buy only what pays?", "Yes. How much is bought is an outcome of each pairing's own prices, not a rule. A kWh is bought only if it can later be sold, or save a purchase, for more than its delivered cost (buy price ÷ round-trip efficiency + wear). Nothing is bought just because a slot is cheap."),
      qa("Is exported energy double counted?", "No. Every headline £ figure comes from the scenario's total metered import and export, and exports already include battery energy that was bought off-peak. The arbitrage tags only label that energy; they do not change any total."),
      qa("Absolute £ or ranking?", "Absolute £ are model estimates, and perfect foresight is an upper bound. **The ranking and the gaps between tariffs are the more trustworthy part.**")),
  ]);

  // ---- tabs guide
  const TABS = [
    ["verdict", "Verdict", "The best pairing from 5 Nov, the saving against renewing, and what solar and battery save versus a flat tariff."],
    ["matrix", "Tariff matrix", "Import × export grid, coloured by £ per year."],
    ["timeline", "Month by month", "Running total, monthly bills, and the cheapest pairing each month."],
    ["arbitrage", "Arbitrage", "What buying off-peak is worth after round-trip losses: flows, money, prices, and every pairing."],
    ["day", "Day explorer", "Any day: prices, solar, house, grid and battery on linked panels, with what the controller did."],
    ["dispatch", "Battery strategy", "When it charges and exports, an average day per season, how much it charges against how sunny it is."],
    ["battery", "Losses & health", "Where 100 kWh bought from the grid ends up, cycles, a break-even calculator."],
    ["tariffs", "Tariffs", "Rates through the day, standing charges, Agile history, and every tariff left out and why."],
    ["model", "Data & model", "Data quality, every setting, and the monthly meter cross-check."],
  ];
  const tabs = section("ab-tabs", "The tabs", "Each one answers a different question. Click to go there.", [
    el("div", { class: "grid g3" }, TABS.map(([id, t, x]) => el("button", { type: "button", class: "ab-tab", onclick: () => { location.hash = "#/" + id; } }, el("b", { text: t }), el("span", { text: x }))))]);

  // ---- limits
  const limits = section("ab-limits", "Limits and caveats", "Read these before trusting any single number.", [
    ul([
      "**One household, one year.** The weather, the usage and the system are specific to this home. A different home, region or battery will give different answers; the method transfers, the numbers do not.",
      "**Today's rates on last year's usage.** Tariffs change, and Agile prices move with the market. Past weather is not a forecast.",
      P.brown_export === false
        ? "**Exporting grid-charged energy is switched off in these results.** If Octopus allows it, the ranking can change a lot (Go's cheap night rate is worth far more with it)."
        : "**Exporting grid-charged energy is allowed** (the household does this today). If Octopus ever restricts it, the ranking can change a lot, because Go's cheap night rate is worth far less without it.",
      "**Only tariffs this household could use.** Those needing an EV, a heat pump or an Octopus-controllable battery (Intelligent, Cosy, Snug) are excluded, as are products Octopus did not offer through its API when the rates were fetched. The Tariffs tab lists every exclusion and the reason.",
      "**Estimates, not advice.** The model is checked against measured data (below) but is still a model. Check a tariff's current terms before switching.",
    ])]);

  root.append(intro, el("div", { style: { height: "16px" } }), facts, el("div", { style: { height: "16px" } }), why, el("div", { style: { height: "16px" } }), how,
    el("div", { style: { height: "16px" } }), model, el("div", { style: { height: "16px" } }), ctrl, el("div", { style: { height: "16px" } }), read);

  // ---- checks (filled in from the measured data once it has loaded)
  const checksBody = el("div", { class: "ab-body-inner" }, el("p", { class: "ab-p muted", text: "Loading the cross-checks…" }));
  const checks = section("ab-checks", "Checks against measured data", "Does the model agree with what the system and the meter actually recorded?", [checksBody]);
  root.append(el("div", { style: { height: "16px" } }), checks, el("div", { style: { height: "16px" } }), limits, el("div", { style: { height: "16px" } }), tabs);

  // ---- credits
  root.append(el("div", { style: { height: "16px" } }), section("ab-credits", "Credits and privacy", null, [
    ul([
      "**Tariff rates:** Octopus Energy's public API. **Weather:** Open-Meteo.com (CC BY 4.0). **Charts:** Apache ECharts.",
      "**Unofficial and independent:** not affiliated with or endorsed by Octopus Energy. Not financial advice.",
      ...(snap ? ["**This site is a pre-computed snapshot.** It has no server, no sign-in, no cookies or tracking, and makes no requests except to its own files. Identifying details (address, account, meter and device identifiers, API keys) have been removed; the half-hourly solar, usage and battery figures are one household's real data."] : []),
    ])], { collapsible: false }));

  const checkItems = [];
  try {
    const a = await api("/api/actual");
    const t = a && a.available ? a.table : null;
    if (t && t.oi) {
      const idx = t.oi.map((v, i) => (Number.isFinite(v) && v > 0 ? i : -1)).filter((i) => i >= 0);
      const pick = (arr) => sum(idx.map((i) => arr[i]));
      const vi = pick(t.gi), mi = pick(t.oi), ve = pick(t.ge), me = pick(t.oe);
      const dev = (v, m) => Math.abs((100 * (v - m)) / m);
      const pc = (v, m) => `${v >= m ? "+" : "−"}${n1(dev(v, m))}%`;
      const worst = Math.max(dev(vi, mi), dev(ve, me));
      checkItems.push(`**Victron data vs Octopus smart meter.** Across the whole period: import ${n0(vi)} kWh against ${n0(mi)} kWh on the meter (${pc(vi, mi)}), export ${n0(ve)} kWh against ${n0(me)} kWh (${pc(ve, me)}). Two independent measurements of the same grid connection ${worst < 1 ? "agree to within 1%." : `differ by up to ${n1(worst)}%, so treat the absolute figures with care.`}`);
      const pf = S.raw && S.raw.perfect && S.raw.perfect.scenarios && S.raw.perfect.scenarios["go_cur|outgoing"];
      const out = sum(t.Bg) + sum(t.Bc);
      if (pf && pf.replay && out > 0 && pf.totals.batt_out_kwh > 0) {
        const mod = pf.totals.loss_kwh / pf.totals.batt_out_kwh, mea = pf.replay.loss_kwh / out;
        checkItems.push(`**Losses.** Measured over the year, about ${mea.toFixed(3)} kWh was lost for every kWh the battery delivered; the model (current Go tariff, perfect foresight) gives ${mod.toFixed(3)}. The efficiencies it uses come from separate measurements of the inverter and the battery (listed in Data & model).`);
      }
    }
    const rt = S.raw && S.raw.rt && S.raw.rt.scenarios && S.raw.rt.scenarios["go_cur|outgoing"];
    if (rt && rt.replay) {
      const m = rt.replay.net, r = rt.totals.net, g = m - r;
      checkItems.push(`**Realistic controller vs what really happened.** On the current tariff, the household's measured year repriced on it comes to a net ${netPhrase(m)}; the realistic controller replaying the same year gets ${netPhrase(r)}, ${gbp(Math.abs(g))} (${n0((100 * Math.abs(g)) / Math.max(1, Math.abs(m)))}%) ${g >= 0 ? "better. Expect real savings to land a little below modelled ones." : "worse."}`);
    }
  } catch (e) { /* the cross-checks are optional */ }
  if (d.coverage_pct != null) checkItems.unshift(`**Data completeness.** ${n1(d.coverage_pct)}% of half-hours have data (${n0(d.missing_slots || 0)} missing, ${n0(d.partial_slots || 0)} partial and gap-filled).`);
  checkItems.push("**Automated tests in the project** cover energy conservation in every half-hour, the hard limits, the no-wash-trading rule, clock-change days, tariff windows in local time, and that the arbitrage accounting balances.");
  checksBody.replaceChildren(ul(checkItems));
}
