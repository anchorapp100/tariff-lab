import { S, api, getDetail, el, esc, gbp, gbpSigned, n0, n1, n2, kwh, tok, baseOption, axisStyle, chartCard, withChart, legendEl, tile, label, scn, REF, renewKey, ranked, divColor, netPhrase } from "./core.js";

let date = null;
const cap = () => S.status.cap_kwh;
const sum = (a) => a.reduce((x, y) => x + y, 0);

const detail = (key) => getDetail(key);

export async function renderDay(root) {
  const key = S.sel;
  const det = await detail(key);
  const dates = det.daily.dates;
  if (!date || !dates.includes(date)) {
    const pref = dates.find((d) => d.endsWith("-01-15")) || dates[Math.floor(dates.length / 2)];
    date = pref;
  }
  const host = el("div");
  root.append(host);
  await draw(host, key, det);
}

async function draw(host, key, det) {
  const s = scn(key);
  const dates = det.daily.dates;
  const i = dates.indexOf(date);
  const d = await api(`/api/day?key=${encodeURIComponent(key)}&date=${date}&mode=${S.mode}`);

  // ---------------------------------------------------------------- controls
  const go = (nd) => { if (dates.includes(nd)) { date = nd; draw(host, key, det); } };
  const bestIdx = det.daily.net.indexOf(Math.min(...det.daily.net)), worstIdx = det.daily.net.indexOf(Math.max(...det.daily.net));
  const picker = el("div", { class: "filters", style: { padding: "0 0 8px" } },
    el("button", { class: "btn ghost small", type: "button", text: "◀", "aria-label": "Previous day", onclick: () => go(dates[i - 1]) }),
    el("input", { type: "date", value: date, min: dates[0], max: dates[dates.length - 1], "aria-label": "Day", onchange: (e) => go(e.target.value) }),
    el("button", { class: "btn ghost small", type: "button", text: "▶", "aria-label": "Next day", onclick: () => go(dates[i + 1]) }),
    el("span", { class: "muted", text: "Jump to:" }),
    ...[["Best day", dates[bestIdx]], ["Worst day", dates[worstIdx]], ["Mid-winter", dates.find((x) => x.endsWith("-01-15"))], ["Mid-summer", dates.find((x) => x.endsWith("-07-15"))]]
      .filter(([, v]) => v).map(([t, v]) => el("button", { class: "btn ghost small", type: "button", text: t, onclick: () => go(v) })));
  picker.querySelector("input").style.cssText = "background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px 8px;color:var(--ink)";

  // ---------------------------------------------------------------- calendar
  const calCard = chartCard({
    title: `Daily bill · ${label(s)}`, height: 188,
    sub: "Net cost of each day (import + standing − export). Blue = earned money, red = paid. Click a day to open it.",
    build: (t) => {
      const M = Math.max(2, Math.ceil(Math.max(...det.daily.net.map(Math.abs)) / 1) );
      return {
        ...baseOption(t),
        tooltip: { ...baseOption(t).tooltip, formatter: (p) => `<b>${esc(p.value[0])}</b><br>${netPhrase(p.value[1])}` },
        calendar: { top: 26, left: 34, right: 8, bottom: 6, cellSize: ["auto", 15], range: [dates[0], dates[dates.length - 1]], itemStyle: { borderWidth: 2, borderColor: t.surface, color: t.grid }, splitLine: { show: false }, yearLabel: { show: false }, monthLabel: { color: t.muted, fontSize: 11 }, dayLabel: { color: t.muted, fontSize: 10, firstDay: 1 } },
        visualMap: { show: false, min: -M, max: M, dimension: 1, seriesIndex: 0, inRange: { color: [divColor(-M, M, t), divColor(0, M, t), divColor(M, M, t)] } },
        series: [
          { type: "heatmap", coordinateSystem: "calendar", data: dates.map((x, k) => [x, det.daily.net[k]]), animation: false },
          { type: "scatter", coordinateSystem: "calendar", data: [[date, det.daily.net[i]]], symbol: "rect", symbolSize: 15, itemStyle: { color: "transparent", borderColor: t.ink, borderWidth: 2 }, z: 5, silent: true, animation: false },
        ],
      };
    },
    table: () => ({ cols: ["Date", "Net £"], rows: dates.map((x, k) => [x, n2(det.daily.net[k])]) }),
  });

  // ---------------------------------------------------------------- the day
  const kw = (a) => a.map((v) => +(v * 2).toFixed(3));
  const cp = cap();
  const T = { gi: sum(d.gi), ge: sum(d.ge), chg: sum(d.chg), bdis: sum(d.bdis), pv: sum(d.pv), load: sum(d.load), net: sum(d.cost) / 100 + s.standing_p_day / 100 };
  const lab = d.labels;
  const real = !!d.actual;
  const t0 = tok();

  const kpi = el("div", { class: "grid g4" },
    tile("Net for the day", netPhrase(T.net), el("span", null, `incl. ${n2(s.standing_p_day)}p standing charge`)),
    tile("Bought from grid", kwh(T.gi, 1), `avg ${n2(T.gi ? sum(d.gi.map((v, k) => v * d.pi[k])) / T.gi : 0)}p/kWh`),
    tile("Sold to grid", kwh(T.ge, 1), `avg ${n2(T.ge ? sum(d.ge.map((v, k) => v * d.pe[k])) / T.ge : 0)}p/kWh`),
    tile("Battery cycles", n2(T.bdis / cp), `${kwh(T.bdis, 1)} discharged · solar ${kwh(T.pv, 1)} · home ${kwh(T.load, 1)}`));

  // plain-English explanation of what the optimiser did
  const story = [];
  const win = (arr, thr) => { const idx = arr.map((v, k) => (v > thr ? k : -1)).filter((k) => k >= 0); return idx.length ? [idx[0], idx[idx.length - 1]] : null; };
  const w = win(d.chg, 0.05);
  if (w) {
    const e = sum(d.chg), avg = sum(d.chg.map((v, k) => v * d.pi[k])) / e;
    story.push(`Charged the battery from the grid with ${kwh(e, 1)} between ${lab[w[0]]} and ${lab[Math.min(w[1] + 1, lab.length - 1)]} at an average ${n2(avg)}p/kWh (SOC ${Math.round(d.soc[Math.max(0, w[0] - 1)])}% → ${Math.round(Math.max(...d.soc.slice(w[0], w[1] + 2)))}%).`);
  } else story.push("No grid charging: solar and the stored energy covered the day.");
  const pk = d.labels.map((l, k) => (l >= "16:00" && l < "19:00" ? k : -1)).filter((k) => k >= 0);
  const pkExp = sum(pk.map((k) => d.ge[k]));
  if (T.ge > 0.2) story.push(`Exported ${kwh(T.ge, 1)} in total, ${kwh(pkExp, 1)} of it between 16:00 and 19:00 (${n2(sum(pk.map((k) => d.ge[k] * d.pe[k])) / Math.max(pkExp, 1e-9))}p/kWh there).`);
  story.push(`Solar produced ${kwh(T.pv, 1)} against a house load of ${kwh(T.load, 1)}; the battery delivered ${kwh(T.bdis, 1)}${sum(d.curt) > 0.05 ? ` and ${kwh(sum(d.curt), 1)} of solar had to be curtailed` : ""}.`);
  const dear = d.pi.indexOf(Math.max(...d.pi));
  story.push(`Dearest import slot: ${lab[dear]} at ${n2(d.pi[dear])}p${d.gi[dear] < 0.05 ? " - the optimiser kept off the grid." : ` - still bought ${n2(d.gi[dear])} kWh.`}`);
  if (real) {
    const aNet = sum(d.actual.gi.map((v, k) => (v || 0) * d.pi[k] - (d.actual.ge[k] || 0) * d.pe[k])) / 100 + s.standing_p_day / 100;
    story.push(`What you actually did that day, priced on this tariff: ${netPhrase(aNet)} (${gbpSigned(aNet - T.net)} vs the optimiser).`);
  }

  const panels = [{ id: "price", name: "Price p/kWh", top: 4, h: 84 }, { id: "flow", name: "Solar & house (kW)", top: 112, h: 118 }, { id: "grid", name: "Grid (kW) · import ↑ export ↓", top: 254, h: 104 }, { id: "batt", name: "Battery power (kW) · charging ↑ discharging ↓", top: 382, h: 104 }, { id: "soc", name: "State of charge %", top: 510, h: 84 }];
  const chartCardMain = chartCard({
    title: new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), height: 640,
    sub: `${label(s)} - the optimiser's decisions for this day (30-minute slots). Hover any panel; they move together.`,
    legend: legendEl([
      { color: t0.s[0], text: "Grid import / import price" }, { color: t0.s[2], text: "Grid export / export price" }, { color: t0.s[1], text: "Solar" }, { color: t0.ink2, text: "House load", line: true },
      { color: t0.s[4], text: "Battery charging" }, { color: t0.s[3], text: "Battery discharging" }, ...(real ? [{ color: t0.ink, text: "What you actually did", line: true }] : [])]),
    build: (t) => {
      const grids = panels.map((p) => ({ left: 50, right: 14, top: p.top + 16, height: p.h - 16 }));
      const xs = panels.map((p, k) => ({ type: "category", gridIndex: k, data: lab, boundaryGap: true, ...axisStyle(t), splitLine: { show: false }, axisLabel: { show: k === panels.length - 1, color: t.muted, fontSize: 11, interval: 3 }, axisLine: { lineStyle: { color: t.axis } } }));
      const ys = panels.map((p, k) => ({ type: "value", gridIndex: k, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 10 }, scale: false, ...(p.id === "soc" ? { min: 0, max: 100, interval: 50 } : {}) }));
      const bar = (name, data, color, gi, stack) => ({ type: "bar", name, xAxisIndex: gi, yAxisIndex: gi, data, stack, barCategoryGap: "20%", itemStyle: { color, borderColor: t.surface, borderWidth: 0.5 } });
      const step = (name, data, color, gi, w = 2) => ({ type: "line", name, xAxisIndex: gi, yAxisIndex: gi, data, step: "start", showSymbol: false, lineStyle: { width: w, color }, itemStyle: { color } });
      const series = [
        step("Import price", d.pi, t.s[0], 0), step("Export price", d.pe, t.s[2], 0),
        { type: "line", name: "Solar", xAxisIndex: 1, yAxisIndex: 1, data: kw(d.pv), showSymbol: false, lineStyle: { width: 2, color: t.s[1] }, areaStyle: { color: t.s[1], opacity: 0.14 }, itemStyle: { color: t.s[1] } },
        { type: "line", name: "House load", xAxisIndex: 1, yAxisIndex: 1, data: kw(d.load), showSymbol: false, lineStyle: { width: 2, color: t.ink2 }, itemStyle: { color: t.ink2 } },
        bar("Grid import", kw(d.gi), t.s[0], 2, "g"), bar("Grid export", kw(d.ge).map((v) => -v), t.s[2], 2, "g"),
        bar("Battery charging", kw(d.bch), t.s[4], 3, "b"), bar("Battery discharging", kw(d.bdis).map((v) => -v), t.s[3], 3, "b"),
        { type: "line", name: "State of charge", xAxisIndex: 4, yAxisIndex: 4, data: d.soc, showSymbol: false, lineStyle: { width: 2, color: t.ink }, areaStyle: { color: t.ink, opacity: 0.08 }, itemStyle: { color: t.ink } },
      ];
      if (real) {
        series.push({ type: "line", name: "Actual grid (net)", xAxisIndex: 2, yAxisIndex: 2, data: d.actual.gi.map((v, k) => (v === null ? null : +(((v || 0) - (d.actual.ge[k] || 0)) * 2).toFixed(3))), showSymbol: false, lineStyle: { width: 1.5, color: t.ink }, itemStyle: { color: t.ink }, step: "start" });
        series.push({ type: "line", name: "Actual SOC", xAxisIndex: 4, yAxisIndex: 4, data: d.actual.soc, showSymbol: false, lineStyle: { width: 1.5, color: t.muted }, itemStyle: { color: t.muted } });
      }
      return {
        ...baseOption(t),
        title: panels.map((p, k) => ({ text: p.name, left: 50, top: p.top, textStyle: { color: t.muted, fontSize: 11, fontWeight: 500 } })),
        grid: grids, xAxis: xs, yAxis: ys, series,
        axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.axis, width: 1 } },
        tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "line" },
          formatter: (ps) => {
            const g = (n) => ps.find((p) => p.seriesName === n);
            const k = ps[0].dataIndex;
            const row = (c, a, b) => `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:10px;height:3px;background:${c};margin-right:6px;vertical-align:middle"></i>${a}</span><b>${b}</b></div>`;
            return `<div style="font-weight:600;margin-bottom:4px">${esc(lab[k])}</div>` +
              row(t.s[0], "Import price", n2(d.pi[k]) + "p") + row(t.s[2], "Export price", n2(d.pe[k]) + "p") + `<div style="height:4px"></div>` +
              row(t.s[1], "Solar", n2(d.pv[k] * 2) + " kW") + row(t.ink2, "House", n2(d.load[k] * 2) + " kW") +
              row(t.s[0], "Grid import", n2(d.gi[k] * 2) + " kW") + row(t.s[2], "Grid export", n2(d.ge[k] * 2) + " kW") +
              row(t.s[4], "Battery in", n2(d.bch[k] * 2) + " kW") + row(t.s[3], "Battery out", n2(d.bdis[k] * 2) + " kW") + row(t.ink, "State of charge", n1(d.soc[k]) + "%") +
              `<div style="border-top:1px solid ${t.border};margin-top:4px;padding-top:4px;display:flex;justify-content:space-between"><span>Slot cost</span><b>${n2(d.cost[k])}p</b></div>`;
          } },
      };
    },
    table: () => ({ cols: ["Time", "Import p", "Export p", "Solar kWh", "House kWh", "Import kWh", "Export kWh", "Grid→batt kWh", "Batt out kWh", "SOC %", "Cost p"],
      rows: lab.map((l, k) => [l, n2(d.pi[k]), n2(d.pe[k]), n2(d.pv[k]), n2(d.load[k]), n2(d.gi[k]), n2(d.ge[k]), n2(d.chg[k]), n2(d.bdis[k]), n1(d.soc[k]), n2(d.cost[k])]) }),
  });

  const storyCard = el("section", { class: "card" }, el("div", { class: "ch" }, el("div", null, el("h3", { text: "What the optimiser did" }))),
    el("ul", { style: { margin: "0", paddingLeft: "18px", color: "var(--ink2)" } }, story.map((x) => el("li", { text: x, style: { margin: "4px 0" } }))));

  host.replaceChildren(calCard, el("div", { style: { height: "12px" } }), picker, kpi, el("div", { style: { height: "12px" } }), chartCardMain, el("div", { style: { height: "12px" } }), storyCard);
  calCard.render();
  withChart(calCard.chartDiv, (c) => { c.off("click"); c.on("click", (p) => { if (p.value && p.value[0]) go(p.value[0]); }); });
  chartCardMain.render();
}
