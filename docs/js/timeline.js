import { S, getDetail, el, esc, gbp, gbpSigned, n0, tok, baseOption, axisStyle, chartCard, label, ranked, scn, REF, renewKey, slotFor, releaseSlot, months, tableEl } from "./core.js";

let picked = null;        // ordered list of scenario keys shown
let mode = "adv";

const daily = (key) => getDetail(key);
const cum = (a) => { let s = 0; return a.map((v) => (s += v)); };
const colorOf = (key, t) => (key === REF() ? t.ink2 : t.s[slotFor(key)]);

export async function renderTimeline(root) {
  const rows = ranked();
  const opts = rows.filter((r) => !r.current);
  if (!picked) picked = [REF(), renewKey(), ...opts.filter((r) => r.key !== renewKey()).slice(0, 3).map((r) => r.key)].filter((k, i, a) => scn(k) && a.indexOf(k) === i);
  picked.forEach((k) => slotFor(k));
  const host = el("div");
  root.append(host);
  await draw(host);
}

async function draw(host) {
  host.replaceChildren(el("div", { class: "empty", text: "Loading…" }));
  const D = {};
  await Promise.all(picked.map(async (k) => { D[k] = await daily(k); }));
  const t0 = tok();
  const dates = D[picked[0]].daily.dates;
  const renewDaily = (await daily(renewKey())).daily.net;

  const chips = el("div", { class: "chips" },
    picked.map((k) => el("button", { class: "chip", type: "button", "aria-pressed": "true", title: "Click to remove", onclick: () => { picked = picked.filter((x) => x !== k); if (k !== REF()) releaseSlot(k); draw(host); } },
      el("i", { style: { background: colorOf(k, t0), height: "3px", width: "16px" } }), label(scn(k)))),
    (() => {
      const free = ranked().filter((r) => !picked.includes(r.key));
      const sel = el("select", { "aria-label": "Add a scenario", disabled: picked.length >= 6 || !free.length ? true : null, onchange: (e) => { if (e.target.value) { picked = [...picked, e.target.value]; draw(host); } } },
        el("option", { value: "", text: picked.length >= 6 ? "6 shown (max)" : "+ Add a pairing…" }), ...free.map((r) => el("option", { value: r.key, text: label(r) })));
      sel.style.cssText = "border:1px solid var(--border);background:var(--surface);border-radius:999px;padding:3px 10px;font-size:12px;color:var(--ink2)";
      return sel;
    })());

  const series = (t) => picked.map((k) => {
    const net = D[k].daily.net;
    const vals = mode === "cum" ? cum(net) : mode === "adv" ? cum(net.map((v, i) => renewDaily[i] - v)) : null;
    return { k, vals, c: colorOf(k, t) };
  });

  const title = { cum: "Running total of your net bill", adv: "How far ahead of renewing Go", month: "Net bill by month" }[mode];
  const sub = { cum: "Cumulative import + standing − export since 3 Oct. Lower is better; a line that falls is earning money.",
    adv: "Cumulative saving versus renewing Octopus Go 12M Fixed + Outgoing (both optimised). Above zero = ahead of renewal.",
    month: "Net bill per calendar month (negative = income). The first and last months are part-months." }[mode];

  const card = chartCard({
    title, sub, height: 400,
    controls: el("div", { class: "seg" }, [["adv", "vs renewal"], ["cum", "Running bill"], ["month", "Monthly"]].map(([m, txt]) => el("button", { type: "button", text: txt, "aria-pressed": String(mode === m), onclick: () => { mode = m; draw(host); } }))),
    build: (t) => {
      if (mode === "month") {
        const ms = scn(picked[0]).monthly.map((m) => m.month);
        return {
          ...baseOption(t), grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
          tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" } },
            formatter: (ps) => `<div style="font-weight:600;margin-bottom:4px">${esc(ps[0].axisValueLabel)}</div>` + ps.slice().sort((a, b) => a.value - b.value).map((p) => `<div style="display:flex;justify-content:space-between;gap:16px"><span><i style="display:inline-block;width:10px;height:3px;background:${p.color};margin-right:6px;vertical-align:middle"></i>${esc(p.seriesName)}</span><b>${gbp(p.value)}</b></div>`).join("") },
          xAxis: { type: "category", data: ms.map(months), ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11 } },
          yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => (v < 0 ? "−£" : "£") + n0(Math.abs(v)) } },
          series: picked.map((k) => ({ name: label(scn(k)), type: "bar", barMaxWidth: 14, barGap: "8%", data: scn(k).monthly.map((m) => m.net), itemStyle: { color: colorOf(k, t), borderColor: t.surface, borderWidth: 1 } })),
        };
      }
      const ss = series(t);
      return {
        ...baseOption(t), grid: { left: 8, right: t.narrow ? 12 : 150, top: 16, bottom: 28, containLabel: true },
        tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: t.axis, width: 1 } },
          formatter: (ps) => `<div style="font-weight:600;margin-bottom:4px">${esc(ps[0].axisValueLabel)}</div>` + ps.slice().sort((a, b) => (mode === "adv" ? b.value - a.value : a.value - b.value)).map((p) => `<div style="display:flex;justify-content:space-between;gap:16px"><span><i style="display:inline-block;width:14px;height:2px;background:${p.color};margin-right:6px;vertical-align:middle"></i>${esc(p.seriesName)}</span><b>${mode === "adv" ? gbpSigned(p.value) : gbp(p.value)}</b></div>`).join("") },
        xAxis: { type: "category", data: dates, boundaryGap: false, ...axisStyle(t), splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: (i, v) => v.slice(8) === "01", formatter: (v) => months(v.slice(0, 7)) } },
        yAxis: { type: "value", ...axisStyle(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => (v < 0 ? "−£" : "£") + n0(Math.abs(v)) } },
        series: ss.map((s) => ({
          name: label(scn(s.k)), type: "line", data: s.vals, showSymbol: false, smooth: false, lineStyle: { width: s.k === REF() ? 2 : 2.5, color: s.c }, itemStyle: { color: s.c }, z: s.k === REF() ? 1 : 3,
          endLabel: { show: !t.narrow, color: t.ink2, fontSize: 11, distance: 6, formatter: () => label(scn(s.k)) }, emphasis: { focus: "series" },
        })),
      };
    },
    table: () => {
      if (mode === "month") return { cols: ["Month", ...picked.map((k) => label(scn(k)))], rows: scn(picked[0]).monthly.map((m, i) => [months(m.month) + (m.days < 28 ? ` (${m.days} d)` : ""), ...picked.map((k) => gbp(scn(k).monthly[i].net))]) };
      const ss = series(tok());
      const idx = dates.map((_, i) => i).filter((i) => i % 7 === 6 || i === dates.length - 1);
      return { cols: ["Date", ...picked.map((k) => label(scn(k)))], rows: idx.map((i) => [dates[i], ...ss.map((s) => (mode === "adv" ? gbpSigned(s.vals[i]) : gbp(s.vals[i])))]) };
    },
  });

  // month winners
  const ms = scn(picked[0]).monthly.map((m) => m.month);
  const all = ranked();
  const winRows = ms.map((m, i) => {
    const w = all.filter((r) => !r.current).map((r) => ({ r, v: r.monthly[i].net })).sort((a, b) => a.v - b.v)[0];
    const rn = scn(renewKey()).monthly[i];
    return [months(m) + (scn(picked[0]).monthly[i].days < 28 ? ` (${scn(picked[0]).monthly[i].days} d)` : ""), label(w.r), gbp(w.v), gbpSigned(w.v - rn.net)];
  });
  const winners = el("section", { class: "card" },
    el("div", { class: "ch" }, el("div", null, el("h3", { text: "Cheapest pairing in each month" }), el("div", { class: "sub", text: "The best tariff changes with the season - the annual winner isn't always the monthly winner." }))),
    tableEl(["Month", "Cheapest switchable pairing", "Net", "vs renewing Go"], winRows));

  host.replaceChildren(chips, card, el("div", { style: { height: "16px" } }), winners);
  card.render();
}
