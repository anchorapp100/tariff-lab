import { S, withChart, modeName, el, esc, gbp, gbpSigned, n0, n1, kwh, netPhrase, tok, baseOption, axisStyle, chartCard, legendEl, tile, badge, label, ranked, scn, REF, renewKey } from "./core.js";
import { savingsSection } from "./savings.js";

/** "A forecast-driven controller captures X of the perfect-foresight saving" for the headline pairing. */
function foresightNote(best) {
  const P = S.resultsBy.perfect, R = S.resultsBy.rt;
  if (!P || !R) return "";
  const rn = renewKey();
  const sp = P.scenarios[rn].totals.net - P.scenarios[best.key].totals.net;
  const sr = R.scenarios[rn].totals.net - R.scenarios[best.key].totals.net;
  if (sp <= 1) return "";
  return `For this pairing a perfect-foresight optimiser would save ${gbp(sp)} a year against renewing; a realistic forecast-driven controller keeps ${gbp(sr)} of that (${n0(100 * sr / sp)}%).`;
}

export function figures() {
  const R = S.results, ref = scn(REF()), renew = scn(renewKey());
  const rows = ranked();
  const options = rows.filter((r) => !r.current);
  const best = options[0];
  const real = R.meta.has_actual;
  return { R, ref, renew, rows, options, best, real, asOperated: real && ref.replay ? ref.replay : null };
}

function tag(r, F) {
  if (r.current) return "● " + label(r) + " (your contract)";
  if (r.key === F.best.key) return "★ " + label(r);
  if (r.key === renewKey()) return label(r) + " (renewal)";
  return label(r);
}

function rankingBuild(rows, F, selKey) {
  return (t) => {
    const idx = rows.findIndex((r) => r.key === selKey);
    const ys = rows.map((r) => tag(r, F));
    return {
      ...baseOption(t),
      grid: { left: 4, right: t.narrow ? 66 : 130, top: 8, bottom: 34, containLabel: true },
      tooltip: {
        ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => {
          const r = rows[ps[0].dataIndex], T = r.totals;
          const line = (c, a, b) => `<div style="display:flex;justify-content:space-between;gap:18px"><span><i style="display:inline-block;width:10px;height:2px;background:${c};margin-right:6px;vertical-align:middle"></i>${a}</span><b>${b}</b></div>`;
          return `<div style="font-weight:600;margin-bottom:4px">${esc(label(r))}</div>` +
            line(t.s[0], "Import cost", gbp(T.import_cost)) + line(t.s[1], "Standing charge", gbp(T.standing)) + line(t.s[2], "Export income", "−" + gbp(T.export_credit)) +
            `<div style="border-top:1px solid ${t.border};margin:4px 0;padding-top:4px;display:flex;justify-content:space-between"><span>Net</span><b>${netPhrase(T.net)}</b></div>` +
            `<div style="color:${t.muted}">${kwh(T.import_kwh)} in · ${kwh(T.export_kwh)} out · ${n0(T.cycles)} cycles</div>`;
        },
      },
      xAxis: { type: "value", splitNumber: t.narrow ? 3 : 5, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: t.narrow ? 9 : 11, formatter: (v) => (v < 0 ? "−£" : "£") + (t.narrow && Math.abs(v) >= 1000 ? n1(Math.abs(v) / 1000) + "k" : n0(Math.abs(v))) } },
      yAxis: [
        { type: "category", data: ys, inverse: true, ...axisStyle(t), axisLine: { lineStyle: { color: t.axis } }, splitLine: { show: false },
          axisLabel: { color: t.ink2, fontSize: t.narrow ? 10 : 12, width: t.narrow ? 112 : 230, overflow: "truncate", formatter: (v, i) => (i === idx ? `{b|${v}}` : v), rich: { b: { fontWeight: 700, color: t.ink, fontSize: 12 } } } },
        { type: "category", data: rows.map((r) => (r.totals.net >= 0 ? gbp(r.totals.net) : gbp(r.totals.net))), inverse: true, position: "right", axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
          axisLabel: { color: t.ink, fontWeight: 600, fontSize: t.narrow ? 10 : 12, align: "right", margin: -4 } },
      ],
      series: [
        { name: "Import cost", type: "bar", stack: "s", barWidth: 14, data: rows.map((r) => r.totals.import_cost), itemStyle: { color: t.s[0], borderColor: t.surface, borderWidth: 1 } },
        { name: "Standing charge", type: "bar", stack: "s", barWidth: 14, data: rows.map((r) => r.totals.standing), itemStyle: { color: t.s[1], borderColor: t.surface, borderWidth: 1 } },
        { name: "Export income", type: "bar", stack: "s", barWidth: 14, data: rows.map((r) => -r.totals.export_credit), itemStyle: { color: t.s[2], borderColor: t.surface, borderWidth: 1 } },
        { name: "Net", type: "scatter", symbol: "diamond", symbolSize: 12, z: 5, data: rows.map((r) => r.totals.net), itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 } },
      ],
    };
  };
}

export function renderVerdict(root) {
  const F = figures();
  if (!F.best) { root.append(el("div", { class: "empty" }, el("b", { text: "No results yet" }), "Run the optimiser first.")); return; }
  const { ref, renew, best } = F;
  const saveVsRenew = renew.totals.net - best.totals.net;
  const daysLeft = Math.ceil((new Date("2026-11-05T00:00:00") - new Date()) / 864e5);
  const bestIsRenew = best.key === renewKey();
  const nDays = F.R.meta.data.analysis_days;
  const fullYear = nDays >= 350;
  const span = fullYear ? "a year" : `over these ${nDays} days`;

  // ------------------------------------------------------------ hero (exactly one per view)
  const hero = el("section", { class: "card hero" },
    el("div", { class: "eyebrow", text: `Best option from 5 Nov 2026${daysLeft > 0 ? ` · ${daysLeft} days to decide` : ""}` }),
    el("div", { class: "big" }, bestIsRenew ? "Renew Go" : gbp(saveVsRenew), el("small", { text: bestIsRenew ? "no other pairing beats it" : (fullYear ? "a year better off than renewing Go" : `better off than renewing Go (${nDays} days)`) })),
    el("div", { class: "lead" }, bestIsRenew
      ? `Octopus Go 12M Fixed + Outgoing is the cheapest pairing for your solar, battery and usage, even after the price rise.`
      : el("span", null, el("b", { text: label(best) }), ` — with the battery run by the optimiser — beats renewing Octopus Go 12M Fixed + Outgoing by about ${gbp(saveVsRenew)} ${fullYear ? "over 12 months" : "over the " + nDays + " days analysed"}, `,
        `${best.totals.net < 0 ? "ending the year " + gbp(-best.totals.net) + " in profit" : "for a net bill of " + gbp(best.totals.net)}.`)),
    el("div", { class: "fine" },
      `Based on your last ${F.R.meta.data.analysis_days} days (${F.R.meta.data.analysis_from} → ${F.R.meta.data.analysis_to}) priced at today's published rates, VAT ${F.R.meta.params.vat_pct}%. `,
      S.mode === "rt"
        ? "The battery is run by a forecast-driven controller: it re-plans every 2 hours from the day-ahead solar forecast, your last 14 days of usage and the prices published at the time, then lives with what actually happened. "
        : "Perfect-foresight view: the optimiser knows each day's solar and usage in advance, so absolute numbers are an upper bound. ",
      F.R.meta.params.brown_export ? "Includes exporting battery energy that was charged from the grid (what you do today). " : "Excludes exporting grid-charged energy. ",
      S.noSC ? "Standing charges are EXCLUDED (energy only). " : "",
      foresightNote(best)));

  const partial = fullYear ? null : el("div", { class: "note warn", style: { marginTop: "12px" } }, el("b", { text: `Only ${nDays} days of data. ` }),
    "Solar, usage and Agile prices all swing with the seasons, so these figures cover that period only - they are not a yearly estimate. Use a full year of data before deciding.");

  // ------------------------------------------------------------ KPI row
  const op = F.asOperated;
  const tiles = el("div", { class: "grid g4" },
    tile("Today's contract · as you run it", op ? netPhrase(op.net) : "needs real data", op ? el("span", null, "your actual flows at today's Go + Outgoing rates") : "needs measured household data", { ref: true }),
    tile(`Today's contract · ${modeName()}`, netPhrase(ref.totals.net), op ? el("span", null, badge(`${gbpSigned(op.net - ref.totals.net)} from better control`, "n")) : `same contract, ${modeName()} control`, { ref: true }),
    tile(`Renew Go · ${modeName()}`, netPhrase(renew.totals.net), el("span", null, badge(`${gbpSigned(renew.totals.net - ref.totals.net)} vs today's contract`, renew.totals.net > ref.totals.net ? "b" : "g"), " price rise on 5 Nov")),
    tile(`Best option · ${modeName()}`, netPhrase(best.totals.net), el("span", null, badge(`${gbpSigned(best.totals.net - renew.totals.net)} vs renewing`, best.totals.net < renew.totals.net ? "g" : "n"), " ", label(best))));

  // ------------------------------------------------------------ ranking
  let showAll = false;
  const selKey = () => S.sel;
  const body = el("div");
  const draw = () => {
    const rows = showAll ? F.rows : F.rows.slice(0, 12).concat(F.rows.slice(12).filter((r) => r.current || r.key === renewKey()));
    const card = chartCard({
      title: "Every tariff pairing, ranked", height: Math.max(300, rows.length * 30 + 60),
      sub: "Annual import cost + standing charge − export income. Bars to the left of zero are income. The diamond is the net result; click a row to select it.",
      legend: legendEl([{ color: t0().s[0], text: "Import cost" }, { color: t0().s[1], text: "Standing charge" }, { color: t0().s[2], text: "Export income" }, { color: t0().ink, text: "Net (◆)" }]),
      controls: el("div", { class: "seg" }, [["Top 12", false], ["All", true]].map(([txt, v]) => el("button", { type: "button", text: txt, "aria-pressed": String(showAll === v), onclick: () => { showAll = v; body.replaceChildren(); draw(); } }))),
      build: (t) => rankingBuild(rows, F, selKey())(t),
      table: () => ({
        cols: ["#", "Pairing", "Net £/yr", "Import £", "Standing £", "Export £", "Import kWh", "Export kWh", "Cycles", "Loss kWh", "vs renewal £", "vs your contract £", "Perfect-foresight £", "Foresight penalty £"],
        rows: F.rows.map((r, i) => {
          const pf = S.resultsBy.perfect && S.resultsBy.perfect.scenarios[r.key];
          return [i + 1, tag(r, F), n0(r.totals.net), n0(r.totals.import_cost), n0(r.totals.standing), n0(-r.totals.export_credit), n0(r.totals.import_kwh), n0(r.totals.export_kwh), n0(r.totals.cycles), n0(r.totals.loss_kwh), gbpSigned(r.totals.net - renew.totals.net), gbpSigned(r.totals.net - ref.totals.net),
            pf ? n0(pf.totals.net) : "-", pf ? gbpSigned(r.totals.net - pf.totals.net) : "-"];
        }),
      }),
    });
    body.append(card);
    card.render();
    withChart(card.chartDiv, (chart) => { chart.off("click"); chart.on("click", (p) => { const r = rows[p.dataIndex]; if (r) S.setSel(r.key); }); });
    S.afterSelect = () => { card.render(); };
  };
  const t0 = () => tok();

  // ------------------------------------------------------------ what each lever is worth
  const lever = F.real && op ? [
    ["Smarter battery control", op.net - ref.totals.net, "same contract, optimiser instead of today's behaviour"],
    ["Renewal price rise", renew.totals.net - ref.totals.net, "Go 12M Fixed renewal vs your contract today"],
    ["Switching tariff", best.totals.net - renew.totals.net, "best pairing vs renewing Go (both optimised)"],
  ] : [
    ["Renewal price rise", renew.totals.net - ref.totals.net, "Go 12M Fixed renewal vs your contract today (both optimised)"],
    ["Switching tariff", best.totals.net - renew.totals.net, "best pairing vs renewing Go (both optimised)"],
  ];
  const levers = el("section", { class: "card" },
    el("div", { class: "ch" }, el("div", null, el("h3", { text: "What moves the bill" }), el("div", { class: "sub", text: "Positive = costs you more, negative = saves you money" }))),
    el("div", { class: "tbl" }, el("table", null, el("tbody", null, lever.map(([a, v, d]) => el("tr", null, el("td", null, el("b", { text: a }), el("div", { class: "muted", text: d })), el("td", { class: "num " + (v < 0 ? "good" : v > 0 ? "bad" : ""), text: (v < 0 ? "▼ " : v > 0 ? "▲ " : "") + gbpSigned(v) + "/yr" })))))));

  const savings = savingsSection(F, tag);
  root.append(hero, ...(partial ? [partial] : []), el("div", { style: { height: "16px" } }), tiles, savings, el("div", { style: { height: "16px" } }), body, el("div", { style: { height: "16px" } }), levers);
  draw();
  savings.redraw();
}
