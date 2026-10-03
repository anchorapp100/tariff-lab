// What solar + battery save versus a standard flat-rate tariff with no solar and no battery.
import { S, el, esc, gbp, gbpSigned, n0, n1, n2, kwh, netPhrase, tok, baseOption, axisStyle, chartCard, legendEl, tile, badge, label, scn, renewKey } from "./core.js";

export function flatTariff() {
  const f = (S.results.meta && S.results.meta.flat) || {};
  const id = f[S.flat] ? S.flat : Object.keys(f)[0];
  return id ? { id, all: f, ...f[id] } : null;
}

/** Bill of the house on a flat 24/7 tariff with no solar and no battery (energy + optional standing charge). */
export function flatBill(r, ft) {
  const T = r.totals;
  return (T.load_kwh * ft.unit_p) / 100 + (S.noSC ? 0 : (T.days * ft.standing_p) / 100);
}

/** Ladder from the flat baseline to a bill: tariff effect + solar + battery sum exactly to the total saving. */
export function ladder(r, ft, net) {
  const B = flatBill(r, ft), Bs = r.nosys.net, SO = r.solar_only.net;
  net = net === undefined ? r.totals.net : net;
  return { B, net, total: B - net, tariff: B - Bs, solar: Bs - SO, battery: SO - net };
}

/** F = figures() from verdict.js; tag(r, F) labels a row. Returns an element with a .redraw() method. */
export function savingsSection(F, tag) {
  const host = el("div");
  const draw = () => {
    host.replaceChildren();
    const ft = flatTariff();
    const ok = ft && F.rows.every((r) => r.nosys && r.solar_only);
    if (!ok) { host.append(el("div", { class: "note" }, "Re-run the optimiser to add the flat-rate comparison.")); return; }
    const sel = scn(S.sel), L = ladder(sel, ft);
    const op = F.asOperated ? ladder(F.ref, ft, F.asOperated.net) : null;
    const pctOf = (v) => (L.B > 0 ? ` (${n0((100 * v) / L.B)}% of the flat-rate bill)` : "");
    const selector = el("div", { class: "seg", role: "group", "aria-label": "Flat tariff to compare against" },
      Object.entries(ft.all).map(([id, f]) => el("button", {
        type: "button", text: `${f.name} · ${n2(f.unit_p)}p`, "aria-pressed": String(id === ft.id),
        onclick: () => { S.flat = id; try { localStorage.setItem("otl-flat", id); } catch (e) { /* ignore */ } draw(); },
      })));
    const tiles = el("div", { class: "grid g3" },
      tile("With no solar and no battery", gbp(L.B), `${n2(ft.unit_p)}p/kWh flat 24/7${S.noSC ? " (no standing charge)" : " + " + n2(ft.standing_p) + "p/day"} on ${kwh(sel.totals.load_kwh)} of house use`, { ref: true }),
      tile(`Your bill on ${label(sel)}`, netPhrase(L.net), el("span", null, badge(`saves ${gbp(L.total)}`, L.total >= 0 ? "g" : "b"), pctOf(L.total))),
      tile("Solar alone saves", gbp(L.solar), "the panels with no battery, on the same tariff", { cls: L.solar >= 0 ? "good" : "bad" }),
      tile("The battery adds", gbp(L.battery), "on top of the solar: night charging, shifting and exporting", { cls: L.battery >= 0 ? "good" : "bad" }),
      tile("Tariff effect", gbpSigned(L.tariff), "the same house with no solar or battery, moved from the flat tariff to this one"),
      op ? tile("As you ran it today", gbp(op.total), `saved vs flat · solar ${gbp(op.solar)} + battery ${gbp(op.battery)}${Math.abs(op.tariff) >= 1 ? " " + gbpSigned(op.tariff) + " tariff" : ""}`, { ref: true, cls: "good" })
        : tile("As you ran it today", "needs real data", "your measured year at today's contract"));
    const rows = F.rows.filter((r, i) => i < 12 || r.current || r.key === renewKey());
    const seg = (r) => ladder(r, ft);
    const card = chartCard({
      title: "What solar and battery save, by tariff pairing", height: Math.max(300, rows.length * 30 + 60),
      sub: `Each bar is the saving against a ${ft.name} flat-rate bill with no solar and no battery: what the panels save (orange), what the battery adds on top (magenta), and the effect of the tariff itself (grey, can be negative). The diamond is the total.`,
      legend: legendEl([{ color: tok().s[1], text: "Solar alone" }, { color: tok().s[4], text: "Battery" }, { color: tok().axis, text: "Tariff effect" }, { color: tok().ink, text: "Total saved (◆)" }]),
      controls: selector,
      build: (t) => {
        const ss = rows.map(seg);
        return {
          ...baseOption(t), grid: { left: 4, right: t.narrow ? 62 : 130, top: 8, bottom: 30, containLabel: true },
          tooltip: {
            ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
            formatter: (ps) => {
              const i = ps[0].dataIndex, r = rows[i], x = ss[i];
              const ln = (c, a, b) => `<div style="display:flex;justify-content:space-between;gap:18px"><span><i style="display:inline-block;width:10px;height:3px;background:${c};margin-right:6px;vertical-align:middle"></i>${a}</span><b>${b}</b></div>`;
              return `<div style="font-weight:600;margin-bottom:4px">${esc(label(r))}</div>` + ln(t.s[1], "Solar alone", gbpSigned(x.solar)) + ln(t.s[4], "Battery", gbpSigned(x.battery)) + ln(t.axis, "Tariff effect", gbpSigned(x.tariff)) +
                `<div style="border-top:1px solid ${t.border};margin:4px 0;padding-top:4px;display:flex;justify-content:space-between"><span>Total saved</span><b>${gbp(x.total)}</b></div><div style="color:${t.muted}">flat-rate bill ${gbp(x.B)} → ${netPhrase(x.net)}</div>`;
            },
          },
          xAxis: { type: "value", splitNumber: t.narrow ? 3 : 5, ...axisStyle(t), axisLabel: { color: t.muted, fontSize: t.narrow ? 9 : 11, formatter: (v) => (v < 0 ? "−£" : "£") + (t.narrow && Math.abs(v) >= 1000 ? n1(Math.abs(v) / 1000) + "k" : n0(Math.abs(v))) } },
          yAxis: [
            { type: "category", data: rows.map((r) => tag(r, F)), inverse: true, ...axisStyle(t), splitLine: { show: false },
              axisLabel: { color: t.ink2, fontSize: t.narrow ? 10 : 12, width: t.narrow ? 112 : 230, overflow: "truncate", formatter: (val, i) => (rows[i].key === S.sel ? `{b|${val}}` : val), rich: { b: { fontWeight: 700, color: t.ink, fontSize: 12 } } } },
            { type: "category", data: ss.map((x) => gbp(x.total)), inverse: true, position: "right", axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: t.ink, fontWeight: 600, fontSize: t.narrow ? 10 : 12, align: "right", margin: -4 } },
          ],
          series: [
            { name: "Solar alone", type: "bar", stack: "s", barWidth: 14, data: ss.map((x) => x.solar), itemStyle: { color: t.s[1], borderColor: t.surface, borderWidth: 1 } },
            { name: "Battery", type: "bar", stack: "s", barWidth: 14, data: ss.map((x) => x.battery), itemStyle: { color: t.s[4], borderColor: t.surface, borderWidth: 1 } },
            { name: "Tariff effect", type: "bar", stack: "s", barWidth: 14, data: ss.map((x) => x.tariff), itemStyle: { color: t.axis, borderColor: t.surface, borderWidth: 1 } },
            { name: "Total saved", type: "scatter", symbol: "diamond", symbolSize: 12, z: 5, data: ss.map((x) => x.total), itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 } },
          ],
        };
      },
      table: () => ({
        cols: ["Pairing", "Flat-rate bill £", "Your bill £", "Total saved £", "Solar £", "Battery £", "Tariff effect £"],
        rows: F.rows.map((r) => { const x = seg(r); return [tag(r, F), n0(x.B), n0(x.net), n0(x.total), n0(x.solar), n0(x.battery), gbpSigned(x.tariff)]; }),
      }),
    });
    host.append(
      el("div", { class: "sec" }, el("h2", { text: "What solar and battery save you" }), el("span", { class: "muted", text: `vs ${ft.name} flat rate, no solar, no battery${S.noSC ? " · standing charges excluded" : ""}` })),
      tiles, el("div", { style: { height: "16px" } }), card);
    card.render();
  };
  host.redraw = draw;
  return host;
}
