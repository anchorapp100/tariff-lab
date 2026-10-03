// Static snapshot: answers the app's /api/... calls from pre-computed JSON files. No server, no network except
// same-origin file reads. Loaded before main.js; core.js sees window.OTL.api and routes every call here.
const cache = new Map();
const safe = (k) => String(k).replace("|", "__");
const pad = (n) => String(n).padStart(2, "0");

function J(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) { const e = new Error(`${r.status} ${url}`); e.status = r.status; throw e; }
      return r.json();
    }));
  }
  return cache.get(url);
}

/** Rebuild the /api/day payload for one day from the compact per-scenario decision arrays. */
async function dayDetail(key, date, mode) {
  const [base, ser, prices] = await Promise.all([J("data/base.json"), J(`data/series/${mode}/${safe(key)}.json`), J("data/prices.json")]);
  const [imp, exp] = key.split("|");
  const row = base.days.find((d) => d[0] === date);
  if (!row) { const e = new Error("404 day"); e.status = 404; throw e; }
  const i0 = row[1], n = row[2];
  const sl = (arr, div, dp) => arr.slice(i0, i0 + n).map((v) => +(v / div).toFixed(dp));
  const pi = prices[imp].slice(i0, i0 + n).map((v) => v / 1e4);
  const pe = prices[exp].slice(i0, i0 + n).map((v) => v / 1e4);
  const gi = sl(ser.gi, 1000, 3), ge = sl(ser.ge, 1000, 3);
  const out = {
    date, labels: base.lhh.slice(i0, i0 + n).map((l) => `${pad(l >> 1)}:${l & 1 ? "30" : "00"}`),
    pv: sl(base.pv, 1000, 3), load: sl(base.load, 1000, 3), gi, ge, chg: sl(ser.chg, 1000, 3), bch: sl(ser.bch, 1000, 3),
    bdis: sl(ser.bdis, 1000, 3), curt: sl(ser.curt, 1000, 3), soc: sl(ser.soc, 10, 2), pi, pe,
    cost: gi.map((g, k) => +(g * pi[k] - ge[k] * pe[k]).toFixed(3)),
  };
  if (base.act) {                                       // measured flows for the "what you actually did" overlay (-1 = no reading)
    const a = (arr, div) => arr.slice(i0, i0 + n).map((v) => (v < 0 ? null : +(v / div).toFixed(3)));
    out.actual = { gi: a(base.act.gi, 1000), ge: a(base.act.ge, 1000), soc: a(base.act.soc, 10) };
  }
  return out;
}

async function route(path, opts) {
  const u = new URL(path, "http://snapshot.local");
  const q = u.searchParams, mode = q.get("mode") || "perfect";
  switch (u.pathname) {
    case "/api/status": return J("data/status.json");
    case "/api/results": return J(`data/results_${mode}.json`);
    case "/api/tariffs": return J("data/tariffs.json");
    case "/api/actual": return J("data/actual.json");
    case "/api/scenario": return J(`data/scenario/${mode}/${safe(q.get("key"))}.json`);
    case "/api/arbitrage": return q.get("source") === "actual" ? J("data/arbitrage/actual.json") : J(`data/arbitrage/${mode}/${safe(q.get("key"))}.json`);
    case "/api/day": return dayDetail(q.get("key"), q.get("date"), mode);
    case "/api/run": return { started: false, job: { status: "done", done: 1, total: 1, msg: "snapshot", error: null, elapsed: 0 } };
    default: { const e = new Error(`404 ${u.pathname}`); e.status = 404; throw e; }
  }
}

window.OTL = { static: true, api: route };
