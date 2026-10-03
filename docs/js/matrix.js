import { S, withChart, el, esc, gbp, gbpSigned, n0, tok, baseOption, chartCard, label, scn, REF, renewKey, divColor, onColor, netPhrase, kwh } from "./core.js";

const IMPORTS = ["go_cur", "go_fix", "go_var", "flux_imp", "agile", "flex", "fix12", "fix18"];
const EXPORTS = ["outgoing", "prime", "agile_out", "seg", "flux_exp"];
const INAME = { go_cur: "Go (current)", go_fix: "Go Fixed (renewal)", go_var: "Go Variable", flux_imp: "Flux", agile: "Agile", flex: "Flexible", fix12: "Fixed 12M", fix18: "Fixed 18M" };
const ENAME = { outgoing: "Outgoing 12p", prime: "Prime Outgoing", agile_out: "Agile Outgoing", seg: "SEG", flux_exp: "Flux Export" };

const METRICS = [
  { id: "renew", title: "Saving vs renewing Go", sub: "Annual £ better (−) or worse (+) than renewing Go 12M Fixed + Outgoing, both with optimised battery control.", f: (s) => s.totals.net - scn(renewKey()).totals.net },
  { id: "net", title: "Net annual bill", sub: "Import cost + standing charge − export income. Negative = you earn more than you pay.", f: (s) => s.totals.net },
  { id: "ref", title: "Saving vs today's contract", sub: "Annual £ better (−) or worse (+) than your current Go contract at today's rates, both optimised.", f: (s) => s.totals.net - scn(REF()).totals.net },
];

export function renderMatrix(root) {
  let metric = METRICS[0];
  const host = el("div");
  const draw = () => {
    host.replaceChildren();
    const cells = [];
    let max = 1;
    IMPORTS.forEach((i, yi) => EXPORTS.forEach((e, xi) => {
      const s = scn(i + "|" + e);
      if (s) { const v = metric.f(s); cells.push({ xi, yi, i, e, s, v }); max = Math.max(max, Math.abs(v)); }
    }));
    const bestSwitch = cells.filter((c) => !c.s.current).sort((a, b) => a.s.totals.net - b.s.totals.net)[0];
    max = Math.ceil(max / 50) * 50;

    const card = chartCard({
      title: metric.title, sub: metric.sub, height: 420,
      controls: el("div", { class: "seg" }, METRICS.map((m) => el("button", { type: "button", text: m.id === "renew" ? "vs renewal" : m.id === "net" ? "Net bill" : "vs today", "aria-pressed": String(m.id === metric.id), onclick: () => { metric = m; draw(); } }))),
      build: (t) => {
        const data = [];
        IMPORTS.forEach((i, yi) => EXPORTS.forEach((e, xi) => {
          const c = cells.find((x) => x.xi === xi && x.yi === yi);
          if (!c) {
            data.push({ value: [xi, yi, 0], na: true, itemStyle: { color: t.dark ? "#222221" : "#f0efec", borderColor: t.surface, borderWidth: 3 }, label: { show: true, formatter: "✕", color: t.muted, fontSize: 13 } });
            return;
          }
          const col = divColor(c.v, max, t);
          const isBest = bestSwitch && c.s.key === bestSwitch.s.key;
          data.push({ value: [xi, yi, c.v], key: c.s.key,
            itemStyle: { color: col, borderColor: isBest ? t.ink : t.surface, borderWidth: isBest ? 3 : 3 },
            label: { show: true, color: onColor(col), fontWeight: isBest ? 700 : 500, fontSize: 13,
              formatter: () => (c.s.current ? "● " : isBest ? "★ " : "") + (metric.id === "net" ? gbp(c.v) : gbpSigned(c.v)) } });
        }));
        return {
          ...baseOption(t),
          grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
          tooltip: { ...baseOption(t).tooltip, trigger: "item", formatter: (p) => {
            const c = cells.find((x) => x.xi === p.value[0] && x.yi === p.value[1]);
            if (!c) return `<b>${esc(INAME[IMPORTS[p.value[1]]])} + ${esc(ENAME[EXPORTS[p.value[0]]])}</b><br><span style="color:${t.muted}">Octopus doesn't allow this pairing</span>`;
            const T = c.s.totals, r = scn(renewKey()).totals.net;
            return `<div style="font-weight:600;margin-bottom:4px">${esc(label(c.s))}</div>` +
              `<div style="display:flex;justify-content:space-between;gap:16px"><span>Net</span><b>${netPhrase(T.net)}</b></div>` +
              `<div style="display:flex;justify-content:space-between;gap:16px"><span>vs renewing Go</span><b>${gbpSigned(T.net - r)}</b></div>` +
              `<div style="color:${t.muted};margin-top:4px">${kwh(T.import_kwh)} in · ${kwh(T.export_kwh)} out · ${n0(T.cycles)} cycles · ${n0(T.loss_kwh)} kWh lost</div>`;
          } },
          xAxis: { type: "category", data: EXPORTS.map((e) => ENAME[e]), position: "top", splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: t.narrow ? 10 : 12, fontWeight: 600, interval: 0, width: t.narrow ? 54 : 120, overflow: "break" }, name: "EXPORT tariff →", nameLocation: "start", nameTextStyle: { color: t.muted, fontSize: 11, align: "right", padding: [0, 6, 0, 0] } },
          yAxis: { type: "category", data: IMPORTS.map((i) => INAME[i]), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: t.narrow ? 10 : 12, fontWeight: 600, width: t.narrow ? 62 : 140, overflow: "truncate" } },
          series: [{ type: "heatmap", data, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 3 } }, progressive: 0, animation: false }],
        };
      },
      table: () => ({
        cols: ["Import tariff", ...EXPORTS.map((e) => ENAME[e])],
        rows: IMPORTS.map((i) => [INAME[i], ...EXPORTS.map((e) => { const c = cells.find((x) => x.i === i && x.e === e); return c ? (metric.id === "net" ? gbp(c.v) : gbpSigned(c.v)) : "✕"; })]),
      }),
    });
    host.append(card);
    card.render();
    withChart(card.chartDiv, (chart) => { chart.off("click"); chart.on("click", (p) => { if (p.data && p.data.key) S.setSel(p.data.key); }); });

    // legend (gradient) - cheaper <-> dearer
    const t = tok();
    const stops = [-1, -.5, 0, .5, 1].map((k) => divColor(k * max, max, t));
    host.append(el("div", { style: { display: "flex", alignItems: "center", gap: "10px", margin: "10px 2px 0", fontSize: "12px", color: "var(--ink2)" } },
      el("span", { text: `${metric.id === "net" ? "income" : "cheaper"} −£${n0(max)}` }),
      el("div", { style: { flex: "0 1 260px", height: "8px", borderRadius: "4px", background: `linear-gradient(90deg, ${stops.join(",")})` } }),
      el("span", { text: `${metric.id === "net" ? "bill" : "dearer"} +£${n0(max)}` }),
      el("span", { class: "muted", text: "· ✕ not allowed · ★ best pairing you can switch to · ● your current contract" })));

    // best partner table
    const rows = [];
    IMPORTS.forEach((i) => { const cs = cells.filter((c) => c.i === i).sort((a, b) => a.s.totals.net - b.s.totals.net); if (cs[0]) rows.push([INAME[i], ENAME[cs[0].e], netPhrase(cs[0].s.totals.net), gbpSigned(cs[0].s.totals.net - scn(renewKey()).totals.net)]); });
    host.append(el("div", { style: { height: "16px" } }), el("section", { class: "card" },
      el("div", { class: "ch" }, el("div", null, el("h3", { text: "Best export partner for each import tariff" }), el("div", { class: "sub", text: "Export tariffs are chosen separately from import tariffs, so the matrix is really two decisions." }))),
      (() => { const t2 = el("table"); t2.append(el("thead", null, el("tr", null, ["Import tariff", "Best export", "Net", "vs renewing Go"].map((c) => el("th", { text: c }))))); const tb = el("tbody"); rows.forEach((r) => tb.append(el("tr", null, r.map((c, k) => el("td", { class: k ? "num" : "", text: c }))))); t2.append(tb); return el("div", { class: "tbl" }, t2); })()));
  };
  root.append(host);
  draw();
}
