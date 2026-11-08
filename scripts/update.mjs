// Collecte des données kayak en Wallonie -> site/data.json
// Sources : Infokayak (SPW), géoservices SPW, hydrometrie.wallonie.be (KiWIS), Open-Meteo.
// Node 20+, aucune dépendance.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = process.env.OUT_FILE || 'site/data.json';
const STATE = process.env.STATE_FILE || 'state/state.json';
const STATIC_CACHE = process.env.STATIC_CACHE || 'state/static.json';
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_SERVER = process.env.NTFY_SERVER || 'https://ntfy.sh';
const WATCH = (process.env.WATCH || '').split(',').map(s => s.trim()).filter(Boolean); // vide = tous
const SITE_URL = process.env.SITE_URL || '';

const URL_TRONCONS = 'https://kayak.spw.wallonie.be/rest/services/troncons/';
const URL_GEO = 'https://geoservices3.wallonie.be/arcgis/rest/services/APP_KAYAK/PKAYAK/MapServer/';
const URL_KIWIS = 'https://hydrometrie.wallonie.be/services/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=0&format=json';
const URL_METEO = 'https://api.open-meteo.com/v1/forecast';

const fetchImpl = globalThis.__mockFetch || fetch;

async function getJSON(url, { tries = 3, timeout = 30000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const r = await fetchImpl(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept': 'application/json,text/plain,*/*', 'Referer': 'https://kayak.spw.wallonie.be/public/home' } });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      last = e;
      await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw new Error(`${url.slice(0, 120)} -> ${last?.message}`);
}

const readJSON = async (f, d) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return d; } };
const parseMaybe = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const r4 = n => Math.round(n * 1e4) / 1e4;

// ---------- Géométries (tronçons + aires) ----------
function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * rad, dLo = (b[1] - a[1]) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function lineLengthKm(lines) {
  // Les données contiennent des segments dupliqués (aller/retour) : on déduplique par paire de points.
  const seen = new Set(); let km = 0;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const k = [a.join(), b.join()].sort().join('|');
    if (seen.has(k)) continue; seen.add(k); km += haversine(a, b);
  }
  return Math.round(km * 10) / 10;
}

// Remet les morceaux de tracé (désordonnés, dupliqués, parfois disjoints) en une seule ligne continue.
function buildTrace(lines) {
  const key = p => p[0] + ',' + p[1];
  const pts = new Map(), adj = new Map();
  const link = (a, b, w) => {
    const ka = key(a), kb = key(b); if (ka === kb) return;
    pts.set(ka, a); pts.set(kb, b);
    if (!adj.has(ka)) adj.set(ka, new Map()); if (!adj.has(kb)) adj.set(kb, new Map());
    adj.get(ka).set(kb, w); adj.get(kb).set(ka, w);
  };
  for (const l of lines) for (let i = 1; i < l.length; i++) link(l[i - 1], l[i], haversine(l[i - 1], l[i]));
  if (pts.size < 2) return null;
  // composantes connexes, puis on les relie par leurs points les plus proches
  const comps = []; const seen = new Set();
  for (const k of adj.keys()) {
    if (seen.has(k)) continue;
    const c = [], st = [k]; seen.add(k);
    while (st.length) { const x = st.pop(); c.push(x); for (const y of adj.get(x).keys()) if (!seen.has(y)) { seen.add(y); st.push(y); } }
    comps.push(c);
  }
  while (comps.length > 1) {
    const a = comps[0]; let best = null;
    for (let j = 1; j < comps.length; j++) for (const x of a) for (const y of comps[j]) {
      const d = haversine(pts.get(x), pts.get(y)); if (!best || d < best.d) best = { d, x, y, j };
    }
    link(pts.get(best.x), pts.get(best.y), best.d);
    comps[0] = a.concat(comps[best.j]); comps.splice(best.j, 1);
  }
  const dijkstra = src => {
    const dist = new Map([[src, 0]]), prev = new Map(), done = new Set();
    while (true) {
      let u = null, du = Infinity;
      for (const [k, d] of dist) if (!done.has(k) && d < du) { u = k; du = d; }
      if (u === null) break; done.add(u);
      for (const [v, w] of adj.get(u)) if (du + w < (dist.get(v) ?? Infinity)) { dist.set(v, du + w); prev.set(v, u); }
    }
    let far = src; for (const [k, d] of dist) if (d > dist.get(far)) far = k;
    return { far, prev, dist };
  };
  const A = dijkstra(adj.keys().next().value).far;
  const { far: B, prev, dist } = dijkstra(A);
  const path = [B]; while (path.at(-1) !== A) path.push(prev.get(path.at(-1)));
  return { trace: path.reverse().map(k => pts.get(k)), km: Math.round(dist.get(B) * 10) / 10 };
}

// Oriente la trace de l'amont vers l'aval : altitude des extrémités (Open-Meteo), sinon position des aires.
async function orientTraces(geo, aires) {
  // 5 points échantillonnés dans le premier et le dernier quart de chaque trace : moins sensible au bruit du relief
  const out = {}, samples = [];
  for (const [id, lines] of Object.entries(geo)) {
    const t = buildTrace(lines); if (!t) continue;
    out[id] = t; const n = t.trace.length;
    for (let k = 0; k < 5; k++) {
      samples.push([id, 'A', t.trace[Math.floor(k / 5 * (n - 1) / 4)]]);
      samples.push([id, 'B', t.trace[n - 1 - Math.floor(k / 5 * (n - 1) / 4)]]);
    }
  }
  const elev = {};
  try {
    for (let i = 0; i < samples.length; i += 100) {
      const chunk = samples.slice(i, i + 100);
      const j = await getJSON(`${URL_METEO.replace('forecast', 'elevation')}?latitude=${chunk.map(e => e[2][0]).join(',')}&longitude=${chunk.map(e => e[2][1]).join(',')}`);
      chunk.forEach((e, n) => { const o = (elev[e[0]] ||= { A: [], B: [] }); if (j.elevation[n] != null) o[e[1]].push(j.elevation[n]); });
    }
  } catch (e) { console.warn('altitudes:', e.message); }
  const med = a => { if (!a?.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const [id, t] of Object.entries(out)) {
    const zA = med(elev[id]?.A), zB = med(elev[id]?.B);
    let reverse = null;
    if (zA != null && zB != null && Math.abs(zA - zB) >= 3) reverse = zA < zB;
    if (reverse === null) { // repli : les embarquements (E) sont plutôt en amont, les débarquements (D) en aval
      const near = p => haversine(p, t.trace[0]) < haversine(p, t.trace.at(-1)) ? 1 : -1;
      let score = 0;
      for (const a of aires.filter(a => a.tro === id)) score += a.type === 'E' ? near([a.lat, a.lon]) : a.type === 'D' ? -near([a.lat, a.lon]) : 0;
      reverse = score < 0;
    }
    if (reverse) t.trace.reverse();
    t.altitudes = zA != null ? (reverse ? [zB, zA] : [zA, zB]) : null;
  }
  return out;
}

async function fetchStatic() {
  const q = (id, extra) => getJSON(`${URL_GEO}${id}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson${extra}`);
  const [tr, ai] = await Promise.all([
    q(5, '&maxAllowableOffset=0.0002&geometryPrecision=5'),
    q(3, '&geometryPrecision=5'),
  ]);
  const geo = {};
  for (const f of tr.features) {
    const g = f.geometry; if (!g) continue;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    (geo[f.properties.nomtro] ||= []).push(...lines.map(l => l.map(p => [r4(p[1]), r4(p[0])])));
  }
  const aires = ai.features
    .filter(f => f.properties.pubint !== 'N' && f.geometry)
    .map(f => ({
      tro: f.properties.nomtro,
      type: f.properties.typemb, // ED, E, D, NA
      nom: (f.properties.nomair || f.properties.aireid || '').trim(),
      info: (f.properties.divers || '').replace(/GPS\s*:.*$/m, '').trim(),
      lat: r4(f.geometry.coordinates[1]), lon: r4(f.geometry.coordinates[0]),
    }));
  const traces = await orientTraces(geo, aires);
  return { v: 2, geo, aires, traces, fetched: new Date().toISOString() };
}

// ---------- Hydrométrie (KiWIS) ----------
const kiwisNo = code => (code || '').replace(/^S/, ''); // S9541 -> 9541 ; L5610 reste L5610

async function fetchFlows(codes) {
  const nos = [...new Set(codes.map(kiwisNo).filter(Boolean))];
  const list = await getJSON(`${URL_KIWIS}&request=getTimeseriesList&station_no=${nos.join(',')}&ts_name=10-Debit.1h.Moyen&returnfields=station_no,ts_id,ts_name,parametertype_name`);
  const byNo = {};
  for (const [no, id, name, par] of list.slice(1)) if (par === 'Q' && name === '10-Debit.1h.Moyen') byNo[no] = id;
  const ids = Object.values(byNo);
  if (!ids.length) return {};
  const vals = await getJSON(`${URL_KIWIS}&request=getTimeseriesValues&ts_id=${ids.join(',')}&period=P7D&returnfields=Timestamp,Value`);
  const byId = Object.fromEntries(vals.map(s => [String(s.ts_id), s.data.filter(d => d[1] != null)]));
  const out = {};
  for (const [no, id] of Object.entries(byNo)) {
    const d = byId[id] || [];
    // garde 1 point / 3 h pour alléger, + le dernier
    const thin = d.filter((_, i) => i % 3 === 0); if (d.length && thin.at(-1) !== d.at(-1)) thin.push(d.at(-1));
    out[no] = thin.map(([t, v]) => [t.slice(0, 16), Math.round(v * 1000) / 1000]);
  }
  return out;
}

// ---------- Météo (Open-Meteo) ----------
async function fetchRain(points) {
  const keys = Object.keys(points); if (!keys.length) return {};
  const lat = keys.map(k => points[k][0]).join(','), lon = keys.map(k => points[k][1]).join(',');
  const j = await getJSON(`${URL_METEO}?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max,weather_code&past_days=2&forecast_days=4&timezone=Europe%2FBrussels`);
  const arr = Array.isArray(j) ? j : [j];
  const out = {};
  keys.forEach((k, i) => {
    const d = arr[i]?.daily; if (!d) return;
    out[k] = d.time.map((t, n) => ({ date: t, pluie: d.precipitation_sum[n], tmax: d.temperature_2m_max[n], code: d.weather_code[n] }));
  });
  return out;
}

// ---------- Prévision indicative ----------
function outlook({ open, q, min, max, serie, meteo }) {
  if (q == null || !min) return { niveau: 'inconnu', texte: 'Pas assez de données' };
  const today = new Date().toISOString().slice(0, 10);
  const fut = (meteo || []).filter(d => d.date >= today);
  const rain3 = fut.slice(0, 3).reduce((s, d) => s + (d.pluie || 0), 0);
  const past = serie?.length > 8 ? serie.at(-9)[1] : null; // ~24 h plus tôt (1 pt / 3 h)
  const trend = past ? (q - past) / past : 0;
  const ratio = q / min;
  if (max && q > max) return { niveau: rain3 > 10 ? 'ferme' : 'possible', texte: 'Niveau trop haut' + (rain3 > 10 ? ', pluie encore attendue' : ', devrait baisser'), rain3, trend };
  if (open) {
    if (ratio < 1.15 && trend < 0 && rain3 < 5) return { niveau: 'risque', texte: 'Proche du minimum et en baisse : risque de fermeture', rain3, trend };
    return { niveau: 'ouvert', texte: 'Devrait rester praticable', rain3, trend };
  }
  if (ratio >= 0.8 && rain3 >= 10) return { niveau: 'possible', texte: 'Fermé, mais la pluie prévue pourrait suffire', rain3, trend };
  if (ratio >= 0.5 && rain3 >= 25) return { niveau: 'possible', texte: 'Fermé, ouverture possible si les fortes pluies prévues se confirment', rain3, trend };
  return { niveau: 'ferme', texte: 'Fermé, ouverture peu probable dans les 3 jours', rain3, trend };
}

function seasonOK(typtro, d = new Date()) {
  if (String(typtro) !== '2') return true; // annexe 1B : toute l'année
  const m = d.getMonth() + 1, day = d.getDate();
  return m >= 10 || m <= 2 || (m === 3 && day <= 15); // annexe 1C : 1/10 -> 15/3
}

function difficulty(txt) {
  const m = (txt || '').match(/WW\s*([IVX]+\+?(?:\s*[-–à]\s*[IVX]+\+?)?(?:\s*\([^)]*\))?)/);
  return m ? 'WW ' + m[1].trim() : null;
}

async function notify(title, msg, tags) {
  if (!NTFY_TOPIC) return;
  try {
    await fetchImpl(`${NTFY_SERVER}/${encodeURIComponent(NTFY_TOPIC)}`, {
      method: 'POST', body: msg,
      headers: { Title: encodeURIComponent(title) === title ? title : '=?UTF-8?B?' + Buffer.from(title).toString('base64') + '?=', Tags: tags, ...(SITE_URL ? { Click: SITE_URL } : {}) },
    });
  } catch (e) { console.warn('ntfy:', e.message); }
}

// ---------- Main ----------
async function main() {
  const errors = [];
  const raw = await getJSON(URL_TRONCONS); // indispensable : on échoue si indisponible
  const troncons = (raw.troncons || raw).filter(t => t.pubint !== 'N');

  let stat = await readJSON(STATIC_CACHE, null);
  const staleDays = stat ? (Date.now() - Date.parse(stat.fetched)) / 864e5 : Infinity;
  if (staleDays > 7 || stat?.v !== 2) {
    try { stat = await fetchStatic(); await mkdir('state', { recursive: true }); await writeFile(STATIC_CACHE, JSON.stringify(stat)); }
    catch (e) { errors.push('géométries: ' + e.message); stat ||= { geo: {}, aires: [] }; }
  }

  let flows = {};
  try { flows = await fetchFlows(troncons.map(t => t.codaqu)); } catch (e) { errors.push('hydrométrie: ' + e.message); }

  const points = {};
  for (const t of troncons) {
    const a = stat.aires.find(x => x.tro === t.nomtro && x.type !== 'NA');
    const g = stat.geo[t.nomtro]?.[0]?.[0];
    const p = a ? [a.lat, a.lon] : g;
    if (p) points[t.nomtro] = p;
  }
  let meteo = {};
  try { meteo = await fetchRain(points); } catch (e) { errors.push('météo: ' + e.message); }

  const out = troncons.map(t => {
    const mes = parseMaybe(t.mesjou) || {};
    const par = parseMaybe(t.tropar) || {};
    const sta = parseMaybe(t.station) || {};
    const serie = flows[kiwisNo(t.codaqu)] || [];
    const qLive = serie.at(-1)?.[1] ?? null;
    const navaut = mes.navaut || (String(t.stapub) === '1' ? 'O' : 'N');
    const open = navaut === 'O' && t.troope !== 'N';
    const min = par.sebas1 ?? null, max = par.sehau1 ?? null;
    const lines = stat.geo[t.nomtro] || [];
    const rec = {
      id: t.nomtro,
      nom: t.adrtro,
      riviere: sta.coueau?.libriv || t.adrtro.split(',')[0].replace(/^(La |Le |L')/, ''),
      annexe: String(t.typtro) === '2' ? '1C' : '1B',
      saison: seasonOK(t.typtro),
      ouvert: open,
      justif: t.justif || null,
      officiel: { debit: mes.debitj ?? null, date: mes.formatedDatmes || null, heure: mes.heudebj || null },
      debit: qLive ?? mes.debitj ?? null,
      debitHeure: serie.at(-1)?.[0] || null,
      min, max,
      station: { code: t.codaqu, nom: sta.libsta || null },
      serie,
      meteo: meteo[t.nomtro] || [],
      description: (t.despar || '').trim(),
      note: (t.noteco || '').trim(),
      difficulte: difficulty(t.despar),
      longueurKm: stat.traces?.[t.nomtro]?.km ?? (lines.length ? lineLengthKm(lines) : null),
      trace: stat.traces?.[t.nomtro]?.trace || null,
      altitudes: stat.traces?.[t.nomtro]?.altitudes || null,
      lignes: lines,
      aires: stat.aires.filter(a => a.tro === t.nomtro),
    };
    rec.prevision = outlook({ open, q: rec.debit, min, max, serie, meteo: rec.meteo });
    return rec;
  });

  for (const r of out) if (r.trace) console.log(`  ${r.id.padEnd(10)} ${String(r.longueurKm).padStart(5)} km  amont ${r.trace[0].join(',')} -> aval ${r.trace.at(-1).join(',')}  alt ${r.altitudes?.join(' -> ') ?? '?'}`);

  // ---------- Alertes ----------
  const prev = await readJSON(STATE, {});
  const next = {};
  for (const r of out) {
    next[r.id] = { ouvert: r.ouvert, prev: r.prevision.niveau };
    const p = prev[r.id]; if (!p) continue;
    if (WATCH.length && !WATCH.includes(r.id) && !WATCH.includes(r.riviere)) continue;
    if (p.ouvert !== r.ouvert) {
      await notify(r.ouvert ? `✅ ${r.riviere} ouvert` : `⛔ ${r.riviere} fermé`, `${r.nom}\nDébit ${r.debit ?? '?'} m³/s (min ${r.min ?? '?'}, max ${r.max ?? '?'})`, r.ouvert ? 'canoe,white_check_mark' : 'no_entry');
    } else if (!r.ouvert && p.prev !== 'possible' && r.prevision.niveau === 'possible') {
      await notify(`🌧️ ${r.riviere} : ouverture possible`, `${r.nom}\n${r.prevision.texte}`, 'cloud_with_rain');
    }
  }
  await mkdir('state', { recursive: true });
  await writeFile(STATE, JSON.stringify(next));

  await mkdir(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const alertes = NTFY_TOPIC ? { url: `${NTFY_SERVER}/${encodeURIComponent(NTFY_TOPIC)}`, suivis: WATCH } : null;
  await writeFile(OUT, JSON.stringify({ maj: new Date().toISOString(), erreurs: errors, alertes, troncons: out }));
  console.log(`OK : ${out.length} tronçons, ${out.filter(r => r.ouvert).length} ouverts, ${Object.keys(flows).length} séries de débit, météo ${Object.keys(meteo).length}. Erreurs: ${errors.length ? errors.join(' | ') : 'aucune'}`);
}

if (!globalThis.__noMain) main().catch(e => { console.error(e); process.exit(1); });
export { main, outlook, lineLengthKm, seasonOK, difficulty, buildTrace };
