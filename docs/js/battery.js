import { S, el, esc, gbp, n0, n1, n2, kwh, pct, tok, baseOption, axisStyle, chartCard, legendEl, tile, label, scn, ranked, REF, tableEl, badge } from "./core.js";

const WEAR_LIFE = 6000;        // rated cycles of the cells

function chain(P, high) {
  const c = high ? P.chg_seg[1][1] : P.chg_seg[0][1], i = high ? P.inv_seg[1][1] : P.inv_seg[0][1], b = Math.sqrt(P.eta_bat);
  const steps = [["Bought from the grid", 100, ""], ["After the charger (AC → DC)", 100 * c, `${n1(100 * (1 - c))} lost in the charger`], ["Into the cells", 100 * c * b, `${n1(100 * c * (1 - b))} lost charging the cells`],
    ["Out of the cells", 100 * c * b * b, `${n1(100 * c * b * (1 - b))} lost discharging`], ["Delivered to the house or grid", 100 * c * b * b * i, `${n1(100 * c * b * b * (1 - i))} lost in the inverter`]];
  return { steps, eta: c * b * b * i };
}


/** Plain-English read-out of the break-even maths using the LIVE night rates (never hard-coded). */
function beText() {
  const T = S.tariffs && S.tariffs.tariffs;
  if (!T || !T.go_cur || !T.go_fix || !T.outgoing) return "";
  const P = S.status.settings, eta = chain(P, false).eta, w = P.wear_p;
  const nightNow = Math.min(...T.go_cur.profile), nightNew = Math.min(...T.go_fix.profile), dayNew = Math.max(...T.go_fix.profile), out = T.outgoing.profile[0];
  const cost = (c) => c / eta + w;
  const sell = (c) => out - cost(c), run = (c) => dayNew - cost(c);
  return `Charging at today's ${n2(nightNow)}p Go night rate costs ${n2(cost(nightNow))}p per kWh delivered, so selling at ${n2(out)}p earns ${n2(sell(nightNow))}p. At the renewal's ${n2(nightNew)}p it costs ${n2(cost(nightNew))}p, so selling at ${n2(out)}p ${sell(nightNew) >= 0 ? "still earns " + n2(sell(nightNew)) + "p" : "loses " + n2(-sell(nightNew)) + "p"} - but running the house from the battery instead of buying at ${n2(dayNew)}p still saves ${n2(run(nightNew))}p per kWh.`;
}

export function renderBattery(root) {
  const P = S.status.settings, s = scn(S.sel), ref = scn(REF());
  const lo = chain(P, false), hi = chain(P, true);

  // ------------------------------------------------------------ energy chain
  const flow = (c, title) => el("div", { style: { flex: "1 1 300px", minWidth: "0" } },
    el("div", { style: { fontWeight: 600, margin: "0 0 6px" }, text: title }),
    c.steps.map(([a, v, loss]) => el("div", { style: { margin: "6px 0" } },
      el("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--ink2)" } }, el("span", { text: a }), el("b", { style: { color: "var(--ink)" }, text: n1(v) + " kWh" })),
      el("div", { class: "bar" }, el("i", { style: { width: v + "%" } })), loss ? el("div", { class: "muted", style: { fontSize: "11px" }, text: loss }) : null)),
    el("div", { style: { marginTop: "8px", fontSize: "13px" } }, "Round trip: ", el("b", { text: n1(100 * c.eta) + "%" }), " of every kWh you buy to charge comes back out."));
  const chainCard = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Where 100 kWh bought from the grid ends up" }),
    el("div", { class: "sub", text: "Using the measured MultiPlus-II and Seplos efficiencies for this system. Charging gently (left) wastes less than flat-out (right)." }))),
    el("div", { style: { display: "flex", gap: "28px", flexWrap: "wrap" } }, flow(lo, "Gentle (≤ 4 kW charge, ≤ 4.5 kW discharge)"), flow(hi, "Flat-out (top of the power range)")));

  // ------------------------------------------------------------ break-even
  const SELL = [{ v: 12, n: "Sell at 12p (Outgoing)" }, { v: 16, n: "Sell at 16p (Prime peak)" }, { v: 27.81, n: "Sell at 27.8p (Flux peak)" }, { v: 33.89, n: "Avoid 33.9p (Go renewal day rate)" }];
  const MARK = [[4.755, "Go now"], [8.21, "Go Var"], [9.5, "Go renewal"], [13.97, "Flux night"]];
  let eta = lo.eta, wear = P.wear_p;
  const beHost = el("div");
  const drawBE = () => {
    beHost.replaceChildren();
    const card = chartCard({
      title: "Is it worth cycling the battery?", height: 330,
      sub: "Profit per kWh delivered = what you sell it for (or avoid paying) − charging price ÷ efficiency − wear. Above zero, cycling pays.",
      legend: legendEl(SELL.map((x, k) => ({ color: tok().s[k], text: x.n, line: true }))),
      build: (t) => ({
        ...baseOption(t), grid: { left: 8, right: 70, top: 16, bottom: 36, containLabel: true },
        tooltip: { ...baseOption(t).tooltip, trigger: "axis", formatter: (ps) => `<b>Charging at ${n1(ps[0].axisValue)}p</b><br>` + ps.map((p) => `${esc(p.seriesName)}: <b>${p.value[1] >= 0 ? "+" : "−"}${n2(Math.abs(p.value[1]))}p/kWh</b>`).join("<br>") },
        xAxis: { type: "value", min: 0, max: 36, name: "Charging price (p/kWh)", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
        yAxis: { type: "value", name: "Profit p/kWh", nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
        series: SELL.map((x, k) => ({
          name: x.n, type: "line", showSymbol: false, lineStyle: { width: 2, color: t.s[k] }, itemStyle: { color: t.s[k] },
          data: [0, 36].map((c) => [c, x.v - c / eta - wear]),
          ...(k === 0 ? { markLine: { symbol: "none", silent: true, lineStyle: { color: t.axis, width: 1, type: "solid" }, label: { color: t.muted, fontSize: 10, formatter: (p) => p.name, position: "insideEndTop" }, data: [{ yAxis: 0, name: "", label: { show: false } }, ...MARK.map(([x0, nm]) => ({ xAxis: x0, name: nm }))] } } : {}),
        })),
      }),
      table: () => ({ cols: ["Use of the energy", "Break-even charging price (p/kWh)"], rows: SELL.map((x) => [x.n, n2(eta * (x.v - wear))]) }),
    });
    beHost.append(card); card.render();
  };
  const num = (v, step, on) => { const i = el("input", { type: "number", value: v, step, onchange: (e) => on(parseFloat(e.target.value)) }); return i; };
  const beControls = el("div", { class: "form", style: { margin: "0 0 10px" } },
    el("label", null, "Round-trip efficiency, charge to delivery (%)", num((eta * 100).toFixed(1), 0.5, (v) => { if (v > 30 && v <= 100) { eta = v / 100; drawBE(); } })),
    el("label", null, "Battery wear cost (p per kWh discharged)", num(wear, 0.1, (v) => { if (v >= 0) { wear = v; drawBE(); } })),
    el("div", { class: "note" }, el("b", { text: "Reading it: " }), "the break-even charging price is where a line crosses zero. ", beText()));

  // ------------------------------------------------------------ across scenarios
  const rows = ranked().slice(0, 14);
  const have = rows.some((r) => r.key === REF());
  const show = have ? rows : rows.concat([ref]);
  const lossCard = chartCard({
    title: "Energy lost per year", height: Math.max(260, show.length * 26 + 50),
    sub: "Everything bought or generated that doesn't reach the house or grid: charger, cells, inverter and standby. Lower is better for the battery - and for the bill if it cycles for no reason.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 70, top: 6, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } }, formatter: (ps) => { const r = show[ps[0].dataIndex]; return `<b>${esc(label(r))}</b><br>${kwh(r.totals.loss_kwh)} lost (${n1(r.totals.loss_pct)}% of throughput)<br>${n0(r.totals.cycles)} battery cycles`; } },
      xAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => n0(v) } },
      yAxis: { type: "category", data: show.map(label), inverse: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: t.narrow ? 105 : 200, overflow: "truncate" } },
      series: [{ type: "bar", barWidth: 12, data: show.map((r) => r.totals.loss_kwh), itemStyle: { color: t.s[1], borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", color: t.ink2, fontSize: 11, formatter: (p) => n0(p.value) } }],
    }),
    table: () => ({ cols: ["Pairing", "Lost kWh", "% of throughput", "Cycles/yr", "Years to 6,000 cycles", "Wear £/yr"], rows: ranked().map((r) => [label(r), n0(r.totals.loss_kwh), n1(r.totals.loss_pct), n0(r.totals.cycles), r.totals.cycles > 0 ? n1(WEAR_LIFE / r.totals.cycles) : "∞", n0(r.totals.wear_cost)]) }),
  });
  const cycCard = chartCard({
    title: "Battery cycles per year", height: Math.max(260, show.length * 26 + 50),
    sub: "Full-cycle equivalents. A LiFePO4 pack is typically rated around 6,000 cycles, so ~365 a year is ~16 years of life before wear-out.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 70, top: 6, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } }, formatter: (ps) => { const r = show[ps[0].dataIndex]; return `<b>${esc(label(r))}</b><br>${n0(r.totals.cycles)} cycles/yr · ${r.totals.cycles ? n1(WEAR_LIFE / r.totals.cycles) : "∞"} years to ${n0(WEAR_LIFE)}<br>wear ≈ ${gbp(r.totals.wear_cost)}/yr`; } },
      xAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      yAxis: { type: "category", data: show.map(label), inverse: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: t.narrow ? 105 : 200, overflow: "truncate" } },
      series: [{ type: "bar", barWidth: 12, data: show.map((r) => r.totals.cycles), itemStyle: { color: t.s[0], borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", color: t.ink2, fontSize: 11, formatter: (p) => n0(p.value) } }],
    }),
    table: () => ({ cols: ["Pairing", "Cycles/yr", "Years to 6,000"], rows: ranked().map((r) => [label(r), n0(r.totals.cycles), r.totals.cycles ? n1(WEAR_LIFE / r.totals.cycles) : "∞"]) }),
  });

  // ------------------------------------------------------------ selected scenario health + measured
  const T = s.totals;
  const op = ref.replay;
  const health = el("div", { class: "grid g4" },
    tile("Average battery level", pct(T.soc_avg_pct, 1), label(s)),
    tile("Time above 90 %", pct(T.soc_over90_pct, 1), "high-SOC dwell ages LiFePO4 cells slowest when kept low"),
    tile("Time below 20 %", pct(T.soc_under20_pct, 1), `reserve floor ${n0(P.soc_min * 100)} % for power cuts`),
    tile("Wear cost", gbp(T.wear_cost) + "/yr", `${n0(T.cycles)} cycles · ${T.cycles ? n1(WEAR_LIFE / T.cycles) : "∞"} years to ${n0(WEAR_LIFE)}`));
  const measured = op ? el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Your measured losses vs the optimiser" }), el("div", { class: "sub", text: "Energy balance from your Victron data: imports + solar − house − exports − change in battery level." }))),
    el("div", { class: "grid g3" }, tile("Last 12 months, as you ran it", kwh(op.loss_kwh) + (op.loss_pct != null ? ` (${n1(op.loss_pct)}%)` : ""), "measured"),
      tile("Same contract, optimised", kwh(ref.totals.loss_kwh) + (ref.totals.loss_pct != null ? ` (${n1(ref.totals.loss_pct)}%)` : ""), "modelled"),
      tile("Difference", kwh(op.loss_kwh - ref.totals.loss_kwh), op.loss_kwh > ref.totals.loss_kwh ? "energy you could stop wasting" : "the optimiser cycles harder than you do"))) : null;

  root.append(chainCard, el("div", { style: { height: "16px" } }), beControls, beHost, el("div", { style: { height: "16px" } }), health, el("div", { style: { height: "16px" } }),
    el("div", { class: "grid g2" }, lossCard, cycCard), measured ? el("div", { style: { height: "16px" } }) : null, measured);
  drawBE(); lossCard.render(); cycCard.render();
}
