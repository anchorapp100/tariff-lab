import { S, post, el, esc, gbp, n0, n1, n2, tok, baseOption, axisStyle, chartCard, legendEl, tile, seqColor, months, tableEl, badge, isStatic } from "./core.js";

const HH = Array.from({ length: 48 }, (_, k) => `${String(Math.floor(k / 2)).padStart(2, "0")}:${k % 2 ? "30" : "00"}`);

function windowsText(r) {
  if (!r.windows) return "";
  if (r.windows.length === 1) return `${n2(r.windows[0].p)}p all day`;
  return r.windows.map((w) => `${w.frm}–${w.to} ${n2(w.p)}p`).join(" · ");
}

export function renderTariffs(root) {
  const C = S.tariffs;
  if (!C) { root.append(el("div", { class: "empty" }, el("b", { text: "Tariff data not loaded" }), "Check the server log.")); return; }
  const T = C.tariffs, AG = C.agile_heat;
  const ag = S.status.agile && S.status.agile.kinds;

  // ------------------------------------------------------------ import rates through the day
  const imp = [["go_cur", "Go (current)", null], ["go_fix", "Go Fixed (renewal)", 0], ["go_var", "Go Variable", 1], ["flux_imp", "Flux", 2]];
  const impCard = chartCard({
    title: "Import rates through the day", height: 300, sub: "p/kWh, ex-VAT (VAT is 0 % today). Your current Go and the renewal share the same cheap window but not the same price.",
    legend: legendEl(imp.map(([id, n, k]) => ({ color: k === null ? tok().ink2 : tok().s[k], text: n, line: true }))),
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 16, top: 12, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", formatter: (ps) => `<b>${esc(ps[0].axisValue)}</b><br>` + ps.map((p) => `${esc(p.seriesName)}: <b>${n2(p.value)}p</b>`).join("<br>") },
      xAxis: { type: "category", data: HH, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: 3 } },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => v + "p" } },
      series: imp.filter(([id]) => T[id] && T[id].profile).map(([id, n, k]) => ({ name: n, type: "line", step: "start", data: T[id].profile, showSymbol: false, lineStyle: { width: id === "go_cur" ? 2 : 2.5, color: k === null ? t.ink2 : t.s[k] }, itemStyle: { color: k === null ? t.ink2 : t.s[k] } })),
    }),
    table: () => ({ cols: ["Time", ...imp.map(([, n]) => n)], rows: HH.map((h, i) => [h, ...imp.map(([id]) => (T[id] && T[id].profile ? n2(T[id].profile[i]) : "-"))]) }),
  });

  // ------------------------------------------------------------ export rates through the day
  const agExp = AG ? HH.map((_, i) => AG.export.reduce((a, row) => a + row[i], 0) / AG.export.length) : null;
  const exp = [["outgoing", "Outgoing 12p"], ["prime", "Prime Outgoing"], ["flux_exp", "Flux Export"], ["seg", "SEG"]];
  const expCard = chartCard({
    title: "Export rates through the day", height: 300, sub: "p/kWh. Agile Outgoing is shown as its average for each half-hour over the last year; it moves every day.",
    legend: legendEl([...exp.map(([, n], k) => ({ color: tok().s[k], text: n, line: true })), ...(agExp ? [{ color: tok().s[4], text: "Agile Outgoing (average)", line: true }] : [])]),
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 16, top: 12, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", formatter: (ps) => `<b>${esc(ps[0].axisValue)}</b><br>` + ps.map((p) => `${esc(p.seriesName)}: <b>${n2(p.value)}p</b>`).join("<br>") },
      xAxis: { type: "category", data: HH, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: 3 } },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => v + "p" } },
      series: [...exp.filter(([id]) => T[id] && T[id].profile).map(([id, n], k) => ({ name: n, type: "line", step: "start", data: T[id].profile, showSymbol: false, lineStyle: { width: 2.5, color: t.s[k] }, itemStyle: { color: t.s[k] } })),
        ...(agExp ? [{ name: "Agile Outgoing (average)", type: "line", data: agExp.map((v) => +v.toFixed(2)), showSymbol: false, lineStyle: { width: 2.5, color: t.s[4] }, itemStyle: { color: t.s[4] } }] : [])],
    }),
    table: () => ({ cols: ["Time", ...exp.map(([, n]) => n), "Agile Outgoing avg"], rows: HH.map((h, i) => [h, ...exp.map(([id]) => (T[id] && T[id].profile ? n2(T[id].profile[i]) : "-")), agExp ? n2(agExp[i]) : "-"]) }),
  });

  // ------------------------------------------------------------ flat rates + standing charges
  const flat = [["fix18", "Fixed 18M"], ["flex", "Flexible"], ["fix12", "Fixed 12M"]].filter(([id]) => T[id] && T[id].profile).map(([id, n]) => [n, T[id].profile[0]]);
  if (ag) flat.push(["Agile (12-month average)", ag.import.mean_p]);
  flat.sort((a, b) => a[1] - b[1]);
  const flatCard = chartCard({
    title: "Flat and average import rates", height: 220, sub: "p/kWh at any time of day. Agile is its average, but it swings from negative to 86p.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 56, top: 6, bottom: 24, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } }, formatter: (ps) => `<b>${esc(ps[0].name)}</b>: ${n2(ps[0].value)}p/kWh` },
      xAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 }, min: 0 },
      yAxis: { type: "category", data: flat.map((x) => x[0]), inverse: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 12 } },
      series: [{ type: "bar", barWidth: 14, data: flat.map((x) => x[1]), itemStyle: { color: t.s[0], borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", color: t.ink2, fontSize: 11, formatter: (p) => n2(p.value) + "p" } }],
    }),
    table: () => ({ cols: ["Tariff", "p/kWh"], rows: flat.map((x) => [x[0], n2(x[1])]) }),
  });
  const sc = Object.values(T).filter((r) => r.ok && r.kind === "import").map((r) => [r.short, r.standing_exc]).sort((a, b) => a[1] - b[1]);
  const scCard = chartCard({
    title: "Standing charge", height: 260, sub: "Pence per day, ex-VAT. Over a year the gap between the dearest and cheapest is the figure in the bar labels.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 72, top: 6, bottom: 24, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } }, formatter: (ps) => `<b>${esc(ps[0].name)}</b>: ${n2(ps[0].value)}p/day = ${gbp(ps[0].value * 3.65)}/yr` },
      xAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 }, min: 0 },
      yAxis: { type: "category", data: sc.map((x) => x[0]), inverse: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 12 } },
      series: [{ type: "bar", barWidth: 14, data: sc.map((x) => x[1]), itemStyle: { color: t.s[0], borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", color: t.ink2, fontSize: 11, formatter: (p) => n2(p.value) + "p · " + gbp(p.value * 3.65) } }],
    }),
    table: () => ({ cols: ["Tariff", "p/day", "£/year"], rows: sc.map((x) => [x[0], n2(x[1]), gbp(x[1] * 3.65)]) }),
  });

  // ------------------------------------------------------------ Agile history heatmaps
  const agCards = AG ? ["import", "export"].map((k) => {
    const M = AG[k]; const max = Math.max(...M.flat(), 1);
    return chartCard({
      title: `Agile ${k} · average price by month and time of day`, height: 300, sub: k === "import" ? `Last 12 months, region ${C.region}, ex-VAT. ${ag ? ag.import.negative_slots + " half-hours were negative (you were paid to use power)." : ""}` : "What Agile Outgoing would have paid.",
      build: (t) => {
        const items = [];
        AG.months.forEach((_, yi) => HH.forEach((__, xi) => { const v = M[yi][xi]; items.push({ value: [xi, yi, v], itemStyle: { color: seqColor(Math.max(0, v) / max, t.dark), borderColor: t.surface, borderWidth: 1 } }); }));
        return {
          ...baseOption(t), grid: { left: 8, right: 8, top: 8, bottom: 44, containLabel: true },
          tooltip: { ...baseOption(t).tooltip, trigger: "item", formatter: (p) => `<b>${esc(months(AG.months[p.value[1]]))} · ${HH[p.value[0]]}</b><br>${n2(p.value[2])}p/kWh` },
          xAxis: { type: "category", data: HH, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: 3 } },
          yAxis: { type: "category", data: AG.months.map(months), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11 } },
          visualMap: { show: true, type: "continuous", min: 0, max, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 150, text: [n0(max) + "p", "0"], calculable: false, inRange: { color: [seqColor(0, t.dark), seqColor(0.5, t.dark), seqColor(1, t.dark)] }, textStyle: { color: t.muted, fontSize: 11 } },
          series: [{ type: "heatmap", data: items, animation: false }],
        };
      },
      table: () => ({ cols: ["Month", ...HH.filter((_, i) => i % 4 === 0)], rows: AG.months.map((m, yi) => [months(m), ...M[yi].filter((_, i) => i % 4 === 0).map(n2)]) }),
    });
  }) : [];

  // ------------------------------------------------------------ catalogue table
  const rows = Object.values(T).filter((r) => r.ok || r.error).map((r) => [
    r.name, r.product || "-", r.kind, r.shape === "series" ? `half-hourly · avg ${n2(ag && (r.kind === "import" ? ag.import.mean_p : ag.export.mean_p))}p` : windowsText(r), r.kind === "import" ? n2(r.standing_exc) + "p/day" : "none",
  ]);
  const cat = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Every tariff considered" }),
    el("div", { class: "sub", text: `Fetched from the public Octopus API for region ${C.region} (West Midlands) at ${new Date((C.fetched || 0) * 1000).toLocaleString("en-GB")}. Rates are today's published prices.` })),
    isStatic() ? null : el("button", { class: "btn small", type: "button", text: "Refresh from Octopus", onclick: () => S.rerun({ refresh_tariffs: true, force: true }) })),
    tableEl(["Tariff", "Product code", "Type", "Rates (ex-VAT)", "Standing charge"], rows));
  const exc = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Tariffs left out - and why" }), el("div", { class: "sub", text: "These can't be used with your setup, matching the Octopus compatibility chart." }))),
    el("ul", { style: { margin: 0, paddingLeft: "18px", color: "var(--ink2)" } }, (C.excluded || []).map((x) => el("li", { style: { margin: "5px 0" } }, el("b", { text: x.name + ": " }), x.reason))));

  root.append(el("div", { class: "grid g2" }, impCard, expCard), el("div", { style: { height: "16px" } }), el("div", { class: "grid g2" }, flatCard, scCard), el("div", { style: { height: "16px" } }),
    ...(agCards.length ? [el("div", { class: "grid g2" }, ...agCards), el("div", { style: { height: "16px" } })] : []), cat, el("div", { style: { height: "16px" } }), exc);
  impCard.render(); expCard.render(); flatCard.render(); scCard.render(); agCards.forEach((c) => c.render());
}
