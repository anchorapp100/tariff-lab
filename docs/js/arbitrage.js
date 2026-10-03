import { S, api, getDetail, el, esc, gbp, gbpSigned, n0, n1, n2, kwh, tok, baseOption, axisStyle, chartCard, legendEl, tile, badge, label, scn, ranked, REF, months, tableEl, modeName } from "./core.js";

let source = "model";            // "model" = the selected scenario, "actual" = your measured year on today's contract

const pf = (v, d = 1) => (v === null || v === undefined ? "–" : n2(v).slice(0, d === 1 ? -1 : undefined));

export async function renderArbitrage(root) {
  const host = el("div");
  root.append(host);
  await draw(host);
}

async function draw(host) {
  const real = S.status.source === "vrm";
  if (source === "actual" && !real) source = "model";
  host.replaceChildren(el("div", { class: "empty", text: "Working out where every kWh went…" }));
  let d;
  try {
    d = await api(`/api/arbitrage?key=${encodeURIComponent(S.sel)}&mode=${S.mode}&source=${source}`);
  } catch (e) {
    host.replaceChildren(el("div", { class: "empty" }, el("b", { text: "No arbitrage data for this selection" }), String(e.message)));
    return;
  }
  const t0 = tok();
  const M = d.money;
  const s = scn(d.key);
  // the counterfactual comes from the scenario summary (not the API) so the standing-charge switch applies to it
  const cf = { ess: s.ess.net, net: d.measured ? s.replay.net : s.totals.net };
  cf.value = cf.ess - cf.net;
  const sp = s.split;
  const title = d.measured ? "What you actually did" : label(s);
  const priceNote = d.measured ? `priced at your current contract (${label(s)}) rates` : `${modeName()} control`;

  // ------------------------------------------------------------ controls + how to read
  const toggle = el("div", { class: "filters", style: { padding: "0 0 8px" } },
    el("span", { class: "muted", text: "Showing" }),
    el("div", { class: "seg" },
      el("button", { type: "button", text: `Modelled · ${label(scn(S.sel))}`, "aria-pressed": String(source === "model"), onclick: () => { source = "model"; draw(host); } }),
      el("button", { type: "button", text: "Your actual year (measured)", disabled: real ? null : true, title: real ? "" : "needs your VRM data", "aria-pressed": String(source === "actual"), onclick: () => { source = "actual"; draw(host); } })));
  const how = el("section", { class: "card flat note" },
    el("b", { text: "How this fits with the rest of the app. " }),
    "Every £ figure elsewhere is import cost + standing charge − export income of the TOTAL metered flows, and those flows already include the energy you bought off-peak and sold later. Nothing here changes that - this tab only labels the battery's energy by what charged it, so you can see what the bought part cost and what it earned. Each tariff pairing is optimised on its own prices: it buys a kWh only if it can later be sold, or save buying, for more than it cost to deliver. ",
    d.measured ? "VRM books every conversion loss (PV through the inverter, standby) against the battery, so the measured view is slightly conservative for the bought energy." : "");

  // ------------------------------------------------------------ tiles
  const profitCls = M.profit >= 0 ? "good" : "bad";
  const tiles = el("div", { class: "grid g3" },
    tile("Bought for the battery", kwh(M.bought_kwh), el("span", null, `${gbp(M.bought_cost)} at an average ${n2(M.avg_buy_p || 0)}p/kWh`)),
    tile("…then sold to the grid", kwh(M.export_kwh), el("span", null, `${gbp(M.revenue)} at an average ${n2(M.avg_sell_p || 0)}p/kWh`)),
    tile("…or ran the house", kwh(M.house_kwh), el("span", null, `saved ${gbp(M.value_house)} - avoided imports at ${n2(M.avg_avoid_p || 0)}p/kWh`)),
    tile("Battery wear", gbp(M.wear), `${n2(S.status.settings.wear_p)}p per kWh discharged - the cost of using up cycles`),
    tile("Arbitrage profit (accounting)", gbp(M.profit), el("span", null, badge(`${n2(M.margin_p || 0)}p per kWh delivered`, M.profit >= 0 ? "g" : "b"), ` ${n0(100 * (M.efficiency || 0))}% of bought energy came back out`), { cls: profitCls }),
    tile("Worth vs a solar-only battery", gbp(cf.value), el("span", null, `bill ${gbp(cf.net)} instead of ${gbp(cf.ess)} without grid charging`), { cls: cf.value >= 0 ? "good" : "bad" }));

  // ------------------------------------------------------------ sankey
  // drop the start/end battery-level nodes when they are negligible (a few kWh against ~10,000 flowing through)
  const SK0 = d.sankey;
  const tiny = (l) => (l.source === "Battery at start" || l.target === "Battery at end") && l.value < 25;
  const SK = { ...SK0, links: SK0.links.filter((l) => !tiny(l)) };
  SK.nodes = SK0.nodes.filter((n) => SK.links.some((l) => l.source === n || l.target === n));
  const nodeColor = (n, t) => ({ "Solar": t.s[1], "Grid import": t.s[0], "Battery · grid-charged": t.s[4], "Battery · solar-charged": t.s[3], "House": t.ink2, "Export": t.s[2] }[n] || t.axis);
  const skCard = chartCard({
    title: `Where every kWh goes · ${title}`, height: 540,
    sub: `Annual energy, ${priceNote}. The battery is split by what charged it: magenta is energy bought from the grid, yellow is solar. Grey is lost as heat or used for standby.`,
    legend: legendEl([{ color: t0.s[1], text: "Solar" }, { color: t0.s[0], text: "Grid import" }, { color: t0.s[4], text: "Battery · grid-charged" }, { color: t0.s[3], text: "Battery · solar-charged" }, { color: t0.ink2, text: "House" }, { color: t0.s[2], text: "Export" }, { color: t0.axis, text: "Losses" }]),
    build: (t) => ({
      ...baseOption(t),
      tooltip: { ...baseOption(t).tooltip, trigger: "item", formatter: (p) => (p.dataType === "edge" ? `${esc(p.data.source)} → ${esc(p.data.target)}<br><b>${n0(p.data.value)} kWh</b>` : `<b>${esc(p.name)}</b><br>${n0(p.value)} kWh`) },
      series: [{
        type: "sankey", left: 6, right: t.narrow ? 90 : 130, top: 8, bottom: 8, nodeWidth: 14, nodeGap: t.narrow ? 8 : 12, nodeAlign: "justify", draggable: false,
        emphasis: { focus: "adjacency" }, lineStyle: { color: "source", opacity: 0.32, curveness: 0.5 },
        label: { color: t.ink2, fontSize: t.narrow ? 10 : 11, formatter: (p) => `${p.name}  ${n0(p.value)}` },
        data: SK.nodes.map((n) => ({ name: n, itemStyle: { color: nodeColor(n, t), borderColor: t.surface, borderWidth: 1 } })),
        links: SK.links,
      }],
    }),
    table: () => ({ cols: ["From", "To", "kWh"], rows: [...SK.links].sort((a, b) => b.value - a.value).map((l) => [l.source, l.target, n0(l.value)]) }),
  });

  // ------------------------------------------------------------ money waterfall
  const steps = [["Sold to the grid", M.revenue], ["House bills avoided", M.value_house], ["Cost of buying", -M.bought_cost], ["Battery wear", -M.wear]];
  const wf = (() => { let run = 0; const base = [], gain = [], cost = [], wear = [], total = []; steps.forEach(([nm, v], i) => { if (v >= 0) { base.push(run); gain.push(v); cost.push(0); wear.push(0); total.push(0); run += v; } else { run += v; base.push(run); gain.push(0); cost.push(i === 2 ? -v : 0); wear.push(i === 3 ? -v : 0); total.push(0); } }); base.push(0); gain.push(0); cost.push(0); wear.push(0); total.push(run); return { base, gain, cost, wear, total, cats: [...steps.map((x) => x[0]), "Arbitrage profit"] }; })();
  const moneyCard = chartCard({
    title: "What the bought energy earns", height: 320, sub: "Accounting view, per year: money in from the energy that was bought off-peak, less what it cost.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 12, top: 24, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => { const i = ps[0].dataIndex; const v = i < 4 ? steps[i][1] : M.profit; return `<b>${esc(wf.cats[i])}</b><br>${gbpSigned(v)} a year`; } },
      xAxis: { type: "category", data: wf.cats, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: t.narrow ? 9 : 11, interval: 0, width: 80, overflow: "break" } },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => (v < 0 ? "−£" : "£") + n0(Math.abs(v)) } },
      series: [
        { type: "bar", stack: "w", data: wf.base, itemStyle: { color: "transparent" }, silent: true, tooltip: { show: false } },
        ...[["gain", t.s[2]], ["cost", t.s[0]], ["wear", t.s[1]], ["total", t.ink]].map(([k, c]) => ({
          type: "bar", stack: "w", name: k, barMaxWidth: 36, data: wf[k], itemStyle: { color: c, borderColor: t.surface, borderWidth: 1 },
          label: { show: true, position: "top", color: t.ink2, fontSize: 11, formatter: (p) => (p.value ? (k === "cost" || k === "wear" ? "−" : "") + gbp(p.value) : "") },
        })),
      ],
    }),
    table: () => ({ cols: ["Step", "£ per year"], rows: [...steps.map(([nm, v]) => [nm, gbpSigned(v)]), ["Arbitrage profit", gbpSigned(M.profit)]] }),
  });

  // ------------------------------------------------------------ value ladder (counterfactual split)
  const ladder = sp ? [["Solar-only battery", sp.ess], ["+ night charging for the house", sp.house_only], ["+ exporting the bought energy", sp.perfect]] : null;
  const splitCard = ladder ? chartCard({
    title: "Where the value comes from", height: 320,
    sub: `Net annual bill of the same year with the battery allowed to do more (perfect-foresight optimiser, so the steps are comparable). ${d.measured ? "Modelled on your current contract." : ""}`,
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 84, top: 12, bottom: 24, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } }, formatter: (ps) => `<b>${esc(ladder[ps[0].dataIndex][0])}</b><br>net ${netText(ps[0].value)}` },
      xAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => (v < 0 ? "−£" : "£") + n0(Math.abs(v)) } },
      yAxis: { type: "category", data: ladder.map((x) => x[0]), inverse: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 12, width: t.narrow ? 100 : 190, overflow: "break" } },
      series: [{ type: "bar", barWidth: 22, data: ladder.map((x) => x[1]), itemStyle: { color: t.s[0], borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", color: t.ink, fontWeight: 600, fontSize: 12, formatter: (p) => netText(p.value) } }],
    }),
    table: () => ({ cols: ["Battery strategy", "Net £/yr", "Step worth £"], rows: ladder.map((x, i) => [x[0], n0(x[1]), i ? n0(ladder[i - 1][1] - x[1]) : "-"]) }),
  }) : null;
  function netText(v) { return v >= 0 ? `${gbp(v)} bill` : `${gbp(-v)} income`; }
  const splitNote = sp ? el("div", { class: "note", style: { marginTop: "10px" } },
    "Night charging for the house is worth ", el("b", { text: gbp(sp.value_house) }), " a year; exporting the bought energy adds ", el("b", { text: gbp(sp.value_export) }),
    ". Your selected controller (", modeName(), ") gets ", el("b", { text: gbp(sp.value_total) }), " in total from the battery vs a solar-only one.") : null;

  // ------------------------------------------------------------ monthly
  const MO = d.monthly;
  const profitCard = chartCard({
    title: "Arbitrage profit by month", height: 300, sub: "Accounting view per calendar month; the first and last months are part-months.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 12, top: 16, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => { const m = MO[ps[0].dataIndex]; return `<b>${esc(months(m.month))}</b> (${m.days} days)<br>profit <b>${gbp(m.profit, 2)}</b><br>bought ${kwh(m.bought_kwh)} at ${n2(m.avg_buy_p || 0)}p<br>sold ${kwh(m.export_kwh)} · house ${kwh(m.house_kwh)}<br>wear ${gbp(m.wear, 2)}`; } },
      xAxis: { type: "category", data: MO.map((m) => months(m.month)), ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: t.narrow ? 1 : 0 } },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => (v < 0 ? "−£" : "£") + n0(Math.abs(v)) } },
      series: [{ type: "bar", barMaxWidth: 24, data: MO.map((m) => m.profit), itemStyle: { color: t.s[2], borderRadius: [4, 4, 0, 0] } }],
    }),
    table: () => ({ cols: ["Month", "Days", "Bought kWh", "Avg buy p", "Sold kWh", "House kWh", "Revenue £", "Saved £", "Cost £", "Wear £", "Profit £"],
      rows: MO.map((m) => [months(m.month), m.days, n0(m.bought_kwh), n2(m.avg_buy_p || 0), n0(m.export_kwh), n0(m.house_kwh), n0(m.revenue), n0(m.value_house), n0(m.bought_cost), n0(m.wear), n2(m.profit)]) }),
  });
  const energyCard = chartCard({
    title: "Energy bought and where it went, by month", height: 300, sub: "kWh per month: bought for the battery, then delivered to the grid or the house (the gap is lost as heat).",
    legend: legendEl([{ color: t0.s[0], text: "Bought for the battery" }, { color: t0.s[2], text: "Sold to the grid" }, { color: t0.ink2, text: "Ran the house" }]),
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 12, top: 12, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => `<b>${esc(ps[0].axisValueLabel)}</b><br>` + ps.map((p) => `${esc(p.seriesName)}: <b>${n0(p.value)} kWh</b>`).join("<br>") },
      xAxis: { type: "category", data: MO.map((m) => months(m.month)), ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: t.narrow ? 1 : 0 } },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      series: [["Bought for the battery", "bought_kwh", t.s[0]], ["Sold to the grid", "export_kwh", t.s[2]], ["Ran the house", "house_kwh", t.ink2]].map(([nm, k, c]) => ({ name: nm, type: "bar", barMaxWidth: 10, data: MO.map((m) => m[k]), itemStyle: { color: c, borderColor: t.surface, borderWidth: 1 } })),
    }),
    table: () => ({ cols: ["Month", "Bought kWh", "Sold kWh", "House kWh", "Lost kWh"], rows: MO.map((m) => [months(m.month), n0(m.bought_kwh), n0(m.export_kwh), n0(m.house_kwh), n0(m.bought_kwh - m.export_kwh - m.house_kwh)]) }),
  });

  // ------------------------------------------------------------ price histogram
  const H = d.hist;
  const keep = H.bins.map((_, i) => H.bought[i] + H.sold[i] + H.avoided[i] > 1);
  const lo = keep.indexOf(true), hi = keep.lastIndexOf(true);
  const bins = H.bins.slice(lo, hi + 1), lab = bins.map((b) => `${n0(b)}–${n0(b + 2)}p`);
  const histCard = chartCard({
    title: "At what prices it buys and sells", height: 320,
    sub: "kWh of bought energy by the import price paid, and of that energy's output by the price received (export) or avoided (house). The gap between the blue and the other bars is the margin.",
    legend: legendEl([{ color: t0.s[0], text: "Bought (import price)" }, { color: t0.s[2], text: "Sold (export price)" }, { color: t0.ink2, text: "Ran the house (import price avoided)" }]),
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 12, top: 12, bottom: 44, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => `<b>${esc(ps[0].axisValueLabel)}</b><br>` + ps.map((p) => `${esc(p.seriesName)}: <b>${n0(p.value)} kWh</b>`).join("<br>") },
      xAxis: { type: "category", data: lab, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 10, interval: t.narrow ? 2 : 0, rotate: t.narrow ? 0 : 40 } },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      series: [["Bought (import price)", H.bought, t.s[0]], ["Sold (export price)", H.sold, t.s[2]], ["Ran the house (import price avoided)", H.avoided, t.ink2]].map(([nm, arr, c]) => ({ name: nm, type: "bar", barMaxWidth: 12, data: arr.slice(lo, hi + 1), itemStyle: { color: c, borderColor: t.surface, borderWidth: 1 } })),
    }),
    table: () => ({ cols: ["Price band", "Bought kWh", "Sold kWh", "House kWh"], rows: bins.map((b, i) => [lab[i], n0(H.bought[lo + i]), n0(H.sold[lo + i]), n0(H.avoided[lo + i])]) }),
  });

  // ------------------------------------------------------------ does it pay? (the tariff's own prices, after losses and wear)
  const pr = d.prices;
  const cost = pr.buy_p10 / pr.eta + pr.wear_p;
  const mExp = pr.sell_p90 - cost, mHouse = pr.avoid_p90 - cost;
  const be = (price) => pr.eta * (price - pr.wear_p);
  const payRows = [
    ["Cheapest energy it can buy", `${n2(pr.buy_p10)}p`, "10th-percentile import price over the year"],
    [`What a kWh costs once delivered`, `${n2(cost)}p`, `buy price ÷ ${n0(100 * pr.eta)}% round trip + ${n2(pr.wear_p)}p wear`],
    ["Best price it can sell at", `${n2(pr.sell_p90)}p`, `export price (90th percentile) → ${mExp >= 0 ? "+" : "−"}${n2(Math.abs(mExp))}p a kWh`],
    ["Dearest import it can avoid", `${n2(pr.avoid_p90)}p`, `by running the house from the battery (90th percentile) → ${mHouse >= 0 ? "+" : "−"}${n2(Math.abs(mHouse))}p a kWh`],
  ];
  const payCard = el("section", { class: "card" },
    el("div", { class: "ch" }, el("div", null, el("h3", { text: "Does buying pay under this tariff?" }),
      el("div", { class: "sub", text: "The optimiser buys a kWh only if it can later be sold, or save a purchase, for more than it costs to deliver. Nothing is bought just because a slot is cheap." }))),
    el("div", { class: "tbl" }, el("table", null, el("tbody", null, payRows.map(([a, v, c]) => el("tr", null, el("td", null, el("b", { text: a }), el("div", { class: "muted", text: c })), el("td", { class: "num", style: { fontWeight: 600 }, text: v })))))),
    el("div", { class: "note", style: { marginTop: "10px" } },
      mExp >= 0 ? "Exporting bought energy pays here, but only when the cheap price is below " : "Exporting bought energy loses money here: it would need a cheap price below ",
      el("b", { text: `${n2(be(pr.sell_p90))}p` }), `; running the house from the battery pays while the cheap price is below `, el("b", { text: `${n2(be(pr.avoid_p90))}p` }), ". ",
      mExp < 0 && mHouse > 0 ? "So it only buys what the house will use, and skips nights when solar will cover the day. " : "",
      "(For Agile the prices move every half-hour, so these are typical values; the optimiser works slot by slot.)"));

  // ------------------------------------------------------------ how much it buys each night, by month
  const refDet = await getDetail(REF());
  const monthAvg = (det) => { const m = {}; det.daily.dates.forEach((dt, i) => { (m[dt.slice(0, 7)] = m[dt.slice(0, 7)] || []).push(det.daily.chg_kwh[i]); }); return m; };
  const refAvg = monthAvg(refDet);
  const mine = d.monthly.map((m) => (m.days ? m.bought_kwh / m.days : 0));
  const refSeries = MO.map((m) => (refAvg[m.month] ? refAvg[m.month].reduce((a, b) => a + b, 0) / refAvg[m.month].length : 0));
  const showRef = d.measured || d.key !== REF();
  const T = s.totals;
  const buyStats = !d.measured && T.buy_days !== undefined
    ? `It buys on ${T.buy_days} of ${T.days} nights, typically ${n1(T.buy_median_kwh)} kWh a night (most it ever takes: ${n1(T.buy_max_kwh)} kWh).` : "";
  const buyCard = chartCard({
    title: "How much it buys each night", height: 300,
    sub: `Average kWh bought from the grid per night, by month. ${buyStats}${showRef ? ` Compared with the optimiser on your current Go contract, which tops the battery up every night because 4.755p is so cheap.` : ""}`,
    legend: legendEl([{ color: tok().s[4], text: d.measured ? "What you actually bought" : label(s) }, ...(showRef ? [{ color: tok().ink2, text: "Optimiser on your current Go contract" }] : [])]),
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 12, top: 12, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => `<b>${esc(ps[0].axisValueLabel)}</b><br>` + ps.map((p) => `${esc(p.seriesName)}: <b>${n1(p.value)} kWh a night</b>`).join("<br>") },
      xAxis: { type: "category", data: MO.map((m) => months(m.month)), ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: t.narrow ? 1 : 0 } },
      yAxis: { type: "value", name: "kWh a night", nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      series: [
        { name: d.measured ? "What you actually bought" : label(s), type: "bar", barMaxWidth: 14, data: mine.map((v) => +v.toFixed(1)), itemStyle: { color: t.s[4], borderColor: t.surface, borderWidth: 1 } },
        ...(showRef ? [{ name: "Optimiser on your current Go contract", type: "bar", barMaxWidth: 14, data: refSeries.map((v) => +v.toFixed(1)), itemStyle: { color: t.ink2, borderColor: t.surface, borderWidth: 1 } }] : []),
      ],
    }),
    table: () => ({ cols: ["Month", "kWh bought per night", ...(showRef ? ["Current Go (optimiser)"] : [])], rows: MO.map((m, i) => [months(m.month), n1(mine[i]), ...(showRef ? [n1(refSeries[i])] : [])]) }),
  });

  // ------------------------------------------------------------ every pairing
  const rows = ranked().filter((r) => r.arb).sort((a, b) => b.arb.profit - a.arb.profit);
  const sel = S.sel;
  const cmp = el("section", { class: "card" },
    el("div", { class: "ch" }, el("div", null, el("h3", { text: "What arbitrage is worth under every tariff pairing" }),
      el("div", { class: "sub", text: `${modeName()} control. Accounting profit = sold + saved − bought − wear. "Worth vs solar-only" is the honest counterfactual. The last two columns come from the perfect-foresight optimiser. Click a row to select it.` }))),
    tableEl(["Pairing", "Net £/yr", "Nights it buys", "Typical night kWh", "Bought kWh", "Avg buy p", "Sold kWh", "House kWh", "Wear £", "Arbitrage profit £", "Worth vs solar-only £", "…night charging £", "…exporting it £"],
      rows.map((r) => [label(r), n0(r.totals.net), r.totals.buy_days === undefined ? "-" : `${r.totals.buy_days} of ${r.totals.days}`, r.totals.buy_median_kwh === undefined ? "-" : n1(r.totals.buy_median_kwh), n0(r.arb.bought_kwh), n2(r.arb.avg_buy_p || 0), n0(r.arb.export_kwh), n0(r.arb.house_kwh), n0(r.arb.wear), n0(r.arb.profit), n0(r.split ? r.split.value_total : 0), n0(r.split ? r.split.value_house : 0), n0(r.split ? r.split.value_export : 0)]),
      { rowClass: (i) => (rows[i].key === sel ? "sel" : rows[i].current ? "refrow" : ""), onRow: (i) => S.setSel(rows[i].key) }));

  // measured vs optimiser headroom (only when showing the measured year)
  let headroom = null;
  if (d.measured) {
    const ref = scn(REF());
    headroom = el("div", { class: "note" }, el("b", { text: "Versus the optimiser on the same contract: " }),
      `you made ${gbp(M.profit)} (accounting) from the bought energy; the ${modeName()} controller makes ${gbp(ref.arb.profit)} from ${kwh(ref.arb.bought_kwh)} bought. `,
      `You bought ${kwh(M.bought_kwh)}, sold ${kwh(M.export_kwh)} and ran the house on ${kwh(M.house_kwh)} of it.`);
  }

  host.replaceChildren(toggle, how, el("div", { style: { height: "12px" } }), tiles, el("div", { style: { height: "16px" } }), ...(headroom ? [headroom, el("div", { style: { height: "16px" } })] : []), skCard,
    el("div", { style: { height: "16px" } }), el("div", { class: "grid g2" }, moneyCard, el("div", null, ...(splitCard ? [splitCard, splitNote] : []))),
    el("div", { style: { height: "16px" } }), el("div", { class: "grid g2" }, payCard, buyCard), el("div", { style: { height: "16px" } }), el("div", { class: "grid g2" }, profitCard, energyCard), el("div", { style: { height: "16px" } }), histCard, el("div", { style: { height: "16px" } }), cmp);
  [skCard, moneyCard, splitCard, buyCard, profitCard, energyCard, histCard].forEach((c) => c && c.render());
}
