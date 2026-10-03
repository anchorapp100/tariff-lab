import { S, getDetail, el, esc, gbp, n0, n1, n2, kwh, tok, baseOption, axisStyle, chartCard, withChart, legendEl, tile, label, scn, seqColor, onColor, months, tableEl } from "./core.js";

const detail = (key) => getDetail(key);
const HH = Array.from({ length: 48 }, (_, k) => `${String(Math.floor(k / 2)).padStart(2, "0")}:${k % 2 ? "30" : "00"}`);
const METRICS = {
  charge: { name: "Charging from the grid", unit: "kW avg", mul: 2, sub: "Average power drawn from the grid to fill the battery, by month and time of day." },
  export: { name: "Exporting to the grid", unit: "kW avg", mul: 2, sub: "Average power sold to the grid." },
  import: { name: "Importing from the grid", unit: "kW avg", mul: 2, sub: "Average total grid import (charging plus house)." },
  soc: { name: "Battery state of charge", unit: "%", mul: 1, sub: "Average battery level through the day." },
};
let metric = "charge", season = "Winter";

export async function renderDispatch(root) {
  const key = S.sel, det = await detail(key), s = scn(key);
  const host = el("div");
  root.append(host);

  // ------------------------------------------------------------------ heatmap
  const heatHost = el("div");
  const drawHeat = () => {
    heatHost.replaceChildren();
    const M = METRICS[metric], h = det.heat;
    const data = []; let max = 0;
    h.months.forEach((_, yi) => HH.forEach((__, xi) => { const v = h[metric][yi][xi] * M.mul; max = Math.max(max, v); }));
    max = metric === "soc" ? 100 : Math.max(0.1, Math.ceil(max * 10) / 10);
    const card = chartCard({
      title: `${M.name} · ${label(s)}`, sub: M.sub, height: 330,
      controls: el("div", { class: "seg" }, Object.entries(METRICS).map(([k, m]) => el("button", { type: "button", text: { charge: "Grid charge", export: "Export", import: "Import", soc: "SOC" }[k], "aria-pressed": String(metric === k), onclick: () => { metric = k; drawHeat(); } }))),
      build: (t) => {
        const items = [];
        h.months.forEach((_, yi) => HH.forEach((__, xi) => { const v = h[metric][yi][xi] * M.mul; const c = seqColor(v / max, t.dark); items.push({ value: [xi, yi, +v.toFixed(2)], itemStyle: { color: c, borderColor: t.surface, borderWidth: 1 } }); }));
        return {
          ...baseOption(t), grid: { left: 8, right: 8, top: 8, bottom: 48, containLabel: true },
          tooltip: { ...baseOption(t).tooltip, trigger: "item", formatter: (p) => `<b>${esc(months(h.months[p.value[1]]))} · ${HH[p.value[0]]}</b><br>${n2(p.value[2])} ${M.unit}` },
          xAxis: { type: "category", data: HH, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: 3 } },
          yAxis: { type: "category", data: h.months.map(months), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11 } },
          visualMap: { show: true, type: "continuous", min: 0, max, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 160, text: [`${n1(max)} ${M.unit}`, "0"], calculable: false, inRange: { color: [seqColor(0, t.dark), seqColor(0.5, t.dark), seqColor(1, t.dark)] }, textStyle: { color: t.muted, fontSize: 11 }, formatter: (v) => n1(v) },
          series: [{ type: "heatmap", data: items, animation: false, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } } }],
        };
      },
      table: () => ({ cols: ["Month", ...HH.filter((_, k) => k % 4 === 0)], rows: det.heat.months.map((m, yi) => [months(m), ...HH.map((_, xi) => xi).filter((xi) => xi % 4 === 0).map((xi) => n2(det.heat[metric][yi][xi] * METRICS[metric].mul))]) }),
    });
    heatHost.append(card); card.render();
  };

  // ------------------------------------------------------------------ typical day
  const dayHost = el("div");
  const drawDay = () => {
    dayHost.replaceChildren();
    const P = det.season[season] || Object.values(det.season)[0];
    const t0 = tok();
    const panels = [{ name: "Price p/kWh", top: 2, h: 80 }, { name: "Solar, house and grid (kW)", top: 100, h: 124 }, { name: "Battery grid-charging ↑ / discharging ↓ (kW)", top: 242, h: 100 }, { name: "State of charge %", top: 360, h: 80 }];
    const card = chartCard({
      title: `An average ${season.toLowerCase()} day`, sub: "Average of every day in the season, for the selected pairing. Shows when the optimiser charges, holds and sells.", height: 462,
      controls: el("div", { class: "seg" }, Object.keys(det.season).map((k) => el("button", { type: "button", text: k, "aria-pressed": String(k === season), onclick: () => { season = k; drawDay(); } }))),
      legend: legendEl([{ color: t0.s[0], text: "Import / import price" }, { color: t0.s[2], text: "Export / export price" }, { color: t0.s[1], text: "Solar" }, { color: t0.ink2, text: "House load", line: true }, { color: t0.s[4], text: "Grid → battery" }, { color: t0.s[3], text: "Battery out" }]),
      build: (t) => {
        const grid = panels.map((p) => ({ left: 46, right: 12, top: p.top + 16, height: p.h - 16 }));
        const xs = panels.map((p, k) => ({ type: "category", gridIndex: k, data: HH, boundaryGap: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { show: k === panels.length - 1, color: t.muted, fontSize: 11, interval: 3 } }));
        const ys = panels.map((p, k) => ({ type: "value", gridIndex: k, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 10 }, ...(k === 3 ? { min: 0, max: 100, interval: 50 } : {}) }));
        const line = (name, data, c, gi, w = 2, extra = {}) => ({ type: "line", name, xAxisIndex: gi, yAxisIndex: gi, data, showSymbol: false, lineStyle: { width: w, color: c }, itemStyle: { color: c }, ...extra });
        const bar = (name, data, c, gi, st) => ({ type: "bar", name, xAxisIndex: gi, yAxisIndex: gi, data, stack: st, barCategoryGap: "20%", itemStyle: { color: c, borderColor: t.surface, borderWidth: 0.5 } });
        return {
          ...baseOption(t), title: panels.map((p) => ({ text: p.name, left: 46, top: p.top, textStyle: { color: t.muted, fontSize: 11, fontWeight: 500 } })), grid, xAxis: xs, yAxis: ys,
          axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.axis } },
          tooltip: { ...baseOption(t).tooltip, trigger: "axis", formatter: (ps) => { const k = ps[0].dataIndex; return `<b>${HH[k]}</b><br>Import ${n2(P.pi[k])}p · Export ${n2(P.pe[k])}p<br>Solar ${n2(P.pv[k])} kW · House ${n2(P.load[k])} kW<br>Grid in ${n2(P.import[k])} kW · out ${n2(P.export[k])} kW<br>Grid→battery ${n2(P.charge[k])} kW · Battery out ${n2(P.discharge[k])} kW<br>SOC ${n1(P.soc[k])}%`; } },
          series: [line("Import price", P.pi, t.s[0], 0), line("Export price", P.pe, t.s[2], 0), line("Solar", P.pv, t.s[1], 1, 2, { areaStyle: { color: t.s[1], opacity: 0.14 } }), line("House load", P.load, t.ink2, 1), line("Grid import", P.import, t.s[0], 1, 1.5), line("Grid export", P.export, t.s[2], 1, 1.5),
            bar("Grid → battery", P.charge, t.s[4], 2, "b"), bar("Battery out", P.discharge.map((v) => -v), t.s[3], 2, "b"), line("SOC", P.soc, t.ink, 3, 2, { areaStyle: { color: t.ink, opacity: 0.08 } })],
        };
      },
      table: () => ({ cols: ["Time", "Import p", "Export p", "Solar kW", "House kW", "Grid in kW", "Grid out kW", "Grid→batt kW", "Batt out kW", "SOC %"], rows: HH.map((h, k) => [h, n2(P.pi[k]), n2(P.pe[k]), n2(P.pv[k]), n2(P.load[k]), n2(P.import[k]), n2(P.export[k]), n2(P.charge[k]), n2(P.discharge[k]), n1(P.soc[k])]) }),
    });
    dayHost.append(card); card.render();
  };

  // ------------------------------------------------------------------ the charging rule
  const D = det.daily;
  const xs = D.pv, ys = D.chg_kwh;
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
  const slope = sxy / sxx, icpt = my - slope * mx;
  const r2 = (() => { let ssr = 0, sst = 0; xs.forEach((x, i) => { ssr += (ys[i] - (icpt + slope * x)) ** 2; sst += (ys[i] - my) ** 2; }); return 1 - ssr / sst; })();
  const bins = []; const bw = 5;
  for (let b = 0; b < 12; b++) { const idx = xs.map((x, i) => (x >= b * bw && x < (b + 1) * bw ? i : -1)).filter((i) => i >= 0); if (idx.length >= 3) bins.push([b * bw + bw / 2, idx.reduce((a, i) => a + ys[i], 0) / idx.length, idx.length]); }
  const ruleCard = chartCard({
    title: "How much to charge from the grid", height: 340,
    sub: "Each dot is one day: grid energy bought to fill the battery against that day's solar. The line is the average for days with similar sun.",
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 16, top: 16, bottom: 36, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "item", formatter: (p) => p.seriesName === "Day" ? `<b>${esc(D.dates[p.dataIndex])}</b><br>Solar ${n1(p.value[0])} kWh<br>Grid charge ${n1(p.value[1])} kWh` : `Days with ${n0(p.value[0] - bw / 2)}–${n0(p.value[0] + bw / 2)} kWh solar<br>average grid charge <b>${n1(p.value[1])} kWh</b> (${p.value[2]} days)` },
      xAxis: { type: "value", name: "Solar generated that day (kWh)", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      yAxis: { type: "value", name: "Grid charge (kWh)", nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      series: [{ name: "Day", type: "scatter", symbolSize: 7, data: xs.map((x, i) => [x, ys[i]]), itemStyle: { color: t.s[0], opacity: 0.55, borderColor: t.surface, borderWidth: 1 } },
        { name: "Average", type: "line", data: bins, showSymbol: true, symbolSize: 8, lineStyle: { width: 2.5, color: t.s[1] }, itemStyle: { color: t.s[1], borderColor: t.surface, borderWidth: 2 }, z: 5 }],
    }),
    table: () => ({ cols: ["Solar bracket (kWh)", "Days", "Average grid charge (kWh)"], rows: bins.map(([c, v, k]) => [`${n0(c - bw / 2)}–${n0(c + bw / 2)}`, k, n1(v)]) }),
  });


  // ------------------------------------------------------------------ the 4-7pm squeeze
  const P0 = S.status.settings;
  const lo16 = 32, hi19 = 38;                                    // local half-hours 16:00 .. 18:30
  const avg = (rows) => rows.map((r) => r.slice(lo16, hi19).reduce((a, b) => a + b, 0) / (hi19 - lo16) * 2);   // kWh/slot -> kW
  const kLoad = avg(det.heat.load), kExp = avg(det.heat.export), kPv = avg(det.heat.pv), kDis = avg(det.heat.discharge);
  const kCap = kLoad.map((l) => Math.max(0, Math.min(P0.exp_kw, P0.inv_kw - l)));
  const peakCard = chartCard({
    title: "The 4–7 pm squeeze", height: 300,
    sub: `Average power between 16:00 and 19:00 by month. The inverter's ${n1(P0.inv_kw)} kW has to feed the house first, so cooking shrinks what you can export (capacity = inverter − house, capped at ${n1(P0.exp_kw)} kW). Annual export in the window: ${kwh(s.totals.export_peak_kwh)}.`,
    legend: legendEl([{ color: tok().ink2, text: "House load" }, { color: tok().s[2], text: "Exported (achieved)" }, { color: tok().axis, text: "Export capacity left" }]),
    build: (t) => ({
      ...baseOption(t), grid: { left: 8, right: 16, top: 12, bottom: 28, containLabel: true },
      tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
        formatter: (ps) => `<b>${esc(ps[0].axisValueLabel)}</b><br>House ${n2(kLoad[ps[0].dataIndex])} kW · Solar ${n2(kPv[ps[0].dataIndex])} kW<br>Export capacity ${n2(kCap[ps[0].dataIndex])} kW · achieved <b>${n2(kExp[ps[0].dataIndex])} kW</b><br>Battery output ${n2(kDis[ps[0].dataIndex])} kW` },
      xAxis: { type: "category", data: det.heat.months.map(months), ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: t.narrow ? 1 : 0 } },
      yAxis: { type: "value", name: "kW", nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11 } },
      series: [
        { name: "House load", type: "bar", barMaxWidth: 14, data: kLoad.map((v) => +v.toFixed(2)), itemStyle: { color: t.ink2, borderColor: t.surface, borderWidth: 1 } },
        { name: "Exported (achieved)", type: "bar", barMaxWidth: 14, data: kExp.map((v) => +v.toFixed(2)), itemStyle: { color: t.s[2], borderColor: t.surface, borderWidth: 1 } },
        { name: "Export capacity left", type: "line", data: kCap.map((v) => +v.toFixed(2)), showSymbol: true, symbolSize: 6, lineStyle: { width: 2, color: t.axis }, itemStyle: { color: t.muted, borderColor: t.surface, borderWidth: 2 } },
      ],
    }),
    table: () => ({ cols: ["Month", "House kW", "Solar kW", "Battery out kW", "Exported kW", "Export capacity kW"], rows: det.heat.months.map((m, i) => [months(m), n2(kLoad[i]), n2(kPv[i]), n2(kDis[i]), n2(kExp[i]), n2(kCap[i])]) }),
  });

  // monthly table
  const mrows = s.monthly.map((m) => [months(m.month) + (m.days < 28 ? ` (${m.days} d)` : ""), n1(m.chg_kwh / m.days), n1(m.bdis_kwh / m.days), n1(m.export_kwh / m.days), n1(m.import_kwh / m.days), n1(m.pv_kwh / m.days), n1(m.load_kwh / m.days)]);
  const monthly = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Average day, month by month" }), el("div", { class: "sub", text: "kWh per day for the selected pairing." }))), tableEl(["Month", "Grid → battery", "Battery out", "Export", "Import", "Solar", "House"], mrows));

  const rule = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "Rule of thumb for the controller" }))),
    el("p", { style: { margin: "0 0 6px", color: "var(--ink2)" } }, "On average the optimiser buys ", el("b", { text: kwh(my, 1) }), " from the grid per day. Each extra kWh of sun cuts that by ", el("b", { text: n2(-slope) + " kWh" }), ` (fit explains ${n0(100 * r2)}% of the day-to-day variation).`),
    el("p", { style: { margin: 0, color: "var(--muted)", fontSize: "12px" } }, "Charge more on gloomy days and less on sunny ones - a planner's solar forecast already supplies exactly this input."));

  host.append(heatHost, el("div", { style: { height: "16px" } }), dayHost, el("div", { style: { height: "16px" } }), peakCard, el("div", { style: { height: "16px" } }), el("div", { class: "grid g2" }, ruleCard, el("div", { class: "grid" }, rule, monthly)));
  drawHeat(); drawDay(); peakCard.render(); ruleCard.render();
}
