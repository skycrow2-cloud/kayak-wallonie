// Parcours hors Wallonie : géométrie OpenStreetMap, mesures (LU / VL / FR), état estimé d'après le règlement.
import { ROUTES, PAYS } from './routes-extra.mjs';

const UA = { 'User-Agent': 'kayak-wallonie/1.0 (https://github.com/skycrow2-cloud/kayak-wallonie)', 'Accept': 'application/json' };
const OVERPASS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const r4 = n => Math.round(n * 1e4) / 1e4;
const sleep = ms => new Promise(r => setTimeout(r, globalThis.__mockFetch ? 0 : ms));

async function getJSON(url, { timeout = 30000, tries = 2 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
      const r = await (globalThis.__mockFetch || fetch)(url, { headers: UA, signal: c.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { last = e; await sleep(1500); }
  }
  throw new Error(url.slice(0, 90) + ' -> ' + last?.message);
}

function haversine(a, b) {
  const R = 6371, d = Math.PI / 180, dLa = (b[0] - a[0]) * d, dLo = (b[1] - a[1]) * d;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// plus court chemin le long du réseau de lignes entre deux points (reliant les morceaux disjoints)
export function pathBetween(lines, A, B) {
  const key = p => p[0] + ',' + p[1], pts = new Map(), adj = new Map();
  const link = (a, b) => { const ka = key(a), kb = key(b); if (ka === kb) return; pts.set(ka, a); pts.set(kb, b);
    if (!adj.has(ka)) adj.set(ka, new Map()); if (!adj.has(kb)) adj.set(kb, new Map());
    const w = haversine(a, b); adj.get(ka).set(kb, w); adj.get(kb).set(ka, w); };
  for (const l of lines) for (let i = 1; i < l.length; i++) link(l[i - 1], l[i]);
  if (pts.size < 2) return null;
  // relie les composantes par leurs points les plus proches (petits trous dans OSM)
  const comps = [], seen = new Set();
  for (const k of adj.keys()) { if (seen.has(k)) continue; const c = [], st = [k]; seen.add(k);
    while (st.length) { const x = st.pop(); c.push(x); for (const y of adj.get(x).keys()) if (!seen.has(y)) { seen.add(y); st.push(y); } } comps.push(c); }
  while (comps.length > 1) {
    let best = null;
    for (let j = 1; j < comps.length; j++) for (const x of comps[0]) for (const y of comps[j]) { const d = haversine(pts.get(x), pts.get(y)); if (!best || d < best.d) best = { d, x, y, j }; }
    if (best.d > 3) break; // trop loin : autre rivière
    link(pts.get(best.x), pts.get(best.y)); comps[0] = comps[0].concat(comps[best.j]); comps.splice(best.j, 1);
  }
  const nearest = p => { let b = null, bd = Infinity; for (const [k, q] of pts) { const d = haversine(p, q); if (d < bd) { bd = d; b = k; } } return [b, bd]; };
  const [s, ds] = nearest(A), [e, de] = nearest(B);
  if (ds > 2 || de > 2) return null;
  const dist = new Map([[s, 0]]), prev = new Map(), done = new Set();
  while (true) {
    let u = null, du = Infinity; for (const [k, d] of dist) if (!done.has(k) && d < du) { u = k; du = d; }
    if (u === null || u === e) break; done.add(u);
    for (const [v, w] of adj.get(u)) if (du + w < (dist.get(v) ?? Infinity)) { dist.set(v, du + w); prev.set(v, u); }
  }
  if (!dist.has(e)) return null;
  const path = [e]; while (path.at(-1) !== s) path.push(prev.get(path.at(-1)));
  return { trace: path.reverse().map(k => pts.get(k)), km: Math.round(dist.get(e) * 10) / 10 };
}

async function osmLines(route) {
  const pad = 0.04, la = [route.start[0], route.end[0]], lo = [route.start[1], route.end[1]];
  const bbox = [Math.min(...la) - pad, Math.min(...lo) - pad, Math.max(...la) + pad, Math.max(...lo) + pad].map(r4).join(',');
  const q = `[out:json][timeout:90];way["waterway"~"^(river|canal)$"]["name"~"^(${route.osm})$",i](${bbox});out geom;`;
  let last;
  for (const host of OVERPASS) {
    try { const j = await getJSON(host + '?data=' + encodeURIComponent(q), { timeout: 120000, tries: 1 }); return j.elements.filter(e => e.geometry).map(e => e.geometry.map(g => [r4(g.lat), r4(g.lon)])); }
    catch (e) { last = e; }
  }
  throw last;
}

export async function extraStatic(prev) {
  const out = { v: 1, fetched: new Date().toISOString(), routes: {} };
  for (const r of ROUTES) {
    try {
      const lines = await osmLines(r);
      const p = pathBetween(lines, r.start, r.end);
      if (p) out.routes[r.id] = p;
      else console.warn('  tracé introuvable', r.id, lines.length, 'lignes OSM');
    } catch (e) { console.warn('  OSM', r.id, e.message); if (prev?.routes?.[r.id]) out.routes[r.id] = prev.routes[r.id]; }
    await sleep(1200);
  }
  return out;
}

// ---------- mesures ----------
const thin = (d, every) => { const t = d.filter((_, i) => i % every === 0); if (d.length && t.at(-1) !== d.at(-1)) t.push(d.at(-1)); return t; };
const localISO = ts => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

async function gaugeLU(id) {
  const j = await getJSON(`https://heichwaasser.lu/api/v1/stations/${id}`);
  const m = (j.measurements || []).filter(x => x.value != null).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const serie = thin(m.map(x => [x.timestamp.slice(0, 16), x.value]), 12); // 15 min -> 3 h
  return { valeur: m.at(-1)?.value ?? j.current?.value ?? null, heure: (m.at(-1)?.timestamp || j.current?.timestamp || '').slice(0, 16), unite: 'cm', grandeur: 'Hauteur', serie, nom: j.city };
}
const KIWIS = 'https://download.waterinfo.be/tsmdownload/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=1&format=json';
async function gaugeVL(st) {
  const l = await getJSON(`${KIWIS}&request=getTimeseriesList&station_no=${st}&ts_name=P.60&returnfields=station_name,ts_id,parametertype_name,ts_unitsymbol`);
  const rows = l.slice(1); const pick = rows.find(r => r[2] === 'Q') || rows.find(r => r[2] === 'H');
  if (!pick) throw new Error('pas de série P.60 pour ' + st);
  const v = await getJSON(`${KIWIS}&request=getTimeseriesValues&ts_id=${pick[1]}&period=P7D&returnfields=Timestamp,Value`);
  const d = (v[0]?.data || []).filter(x => x[1] != null);
  const H = pick[2] === 'H';
  return { valeur: d.at(-1)?.[1] ?? null, heure: d.at(-1) ? localISO(d.at(-1)[0]) : null, unite: H ? 'm' : 'm³/s', grandeur: H ? 'Hauteur' : 'Débit',
    serie: thin(d.map(x => [localISO(x[0]), Math.round(x[1] * 1000) / 1000]), 3), nom: pick[0].split('/')[0] };
}
async function gaugeFR(code, g = 'Q') {
  const j = await getJSON(`https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?code_entite=${code}&grandeur_hydro=${g}&timestep=60&size=200&sort=desc&fields=date_obs,resultat_obs`);
  const d = (j.data || []).filter(x => x.resultat_obs != null).reverse();
  const k = 1000; // Q en l/s -> m³/s ; H en mm -> m
  return { valeur: d.length ? Math.round(d.at(-1).resultat_obs / k * 1000) / 1000 : null, heure: d.length ? localISO(d.at(-1).date_obs) : null,
    unite: g === 'Q' ? 'm³/s' : 'm', grandeur: g === 'Q' ? 'Débit' : 'Hauteur', serie: thin(d.map(x => [localISO(x.date_obs), Math.round(x.resultat_obs / k * 1000) / 1000]), 3) };
}
async function gauge(g) {
  if (!g) return null;
  if (g.provider === 'lu') return gaugeLU(g.station);
  if (g.provider === 'vl') return gaugeVL(g.station);
  if (g.provider === 'fr') return gaugeFR(g.station, g.grandeur);
}

// ---------- règles ----------
function easter(y) { // computus (Meeus/Jones/Butcher)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1));
}
const md = d => String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
function inSaison(saisons, now) {
  if (!saisons?.length) return true;
  const t = md(now);
  return saisons.some(s => s.from <= s.to ? (t >= s.from && t <= s.to) : (t >= s.from || t <= s.to));
}
function saisonOK(rule, now) {
  let ok = inSaison(rule.saisons, now);
  if (rule.feteDieu && !ok) { // Sûre frontalière : ouverte dès la Fête-Dieu si avant le 15 juin, + Ascension tardive et Pentecôte
    const y = now.getUTCFullYear(), E = easter(y), day = n => md(new Date(E.getTime() + n * 864e5)), t = md(now);
    if (t >= day(60) && t < '06-15') ok = true;
    if (t >= day(48) && t <= day(50)) ok = true;
    if (t === day(39) && day(39) > '05-18') ok = true;
  }
  return ok;
}
const fmtMD = s => { const [m, d] = s.split('-'); return `${+d}/${+m}`; };
const saisonsTexte = s => !s?.length || (s.length === 1 && s[0].from === '01-01' && s[0].to === '12-31') ? 'Toute l’année' : s.map(x => `${fmtMD(x.from)} – ${fmtMD(x.to)}`).join(', ');

export async function buildExtras(stat, meteoFn) {
  const now = new Date(), errors = [], recs = [];
  const gauges = {};
  for (const r of ROUTES) {
    const k = r.gauge ? r.gauge.provider + ':' + r.gauge.station : null;
    if (k && !(k in gauges)) { try { gauges[k] = await gauge(r.gauge); } catch (e) { gauges[k] = null; errors.push(`${r.gauge.provider} ${r.gauge.station}: ${e.message}`); } }
  }
  let meteo = {};
  try { meteo = await meteoFn(Object.fromEntries(ROUTES.map(r => [r.id, r.start]))); } catch (e) { errors.push('météo: ' + e.message); }
  for (const r of ROUTES) {
    const g = r.gauge ? gauges[r.gauge.provider + ':' + r.gauge.station] : null;
    const rule = r.rule || {}, saison = saisonOK(rule, now);
    const v = g?.valeur ?? null, hasMin = rule.min != null, hasMax = rule.max != null;
    let statut, justif = null;
    if (!saison) { statut = 'saison'; justif = 'Hors période autorisée (' + saisonsTexte(rule.saisons) + ')'; }
    else if (hasMin || hasMax) {
      if (v == null) { statut = 'info'; justif = 'Mesure indisponible : vérifiez l’échelle sur place'; }
      else if (hasMin && v < rule.min) { statut = 'ferme'; justif = 'Pas assez d’eau'; }
      else if (hasMax && v > rule.max) { statut = 'ferme'; justif = 'Trop d’eau'; }
      else statut = 'ouvert';
    } else if (rule.saisons?.length) statut = 'ouvert';
    else { statut = 'info'; justif = 'Pas de seuil publié : vérifiez les interdictions temporaires'; }
    const geo = stat?.routes?.[r.id];
    const trace = geo?.trace || [r.start, r.end];
    const prevision = statut === 'ouvert'
      ? (hasMin && v != null && v < rule.min * 1.1 ? { niveau: 'risque', texte: 'Proche du seuil minimum : à surveiller' } : { niveau: 'ouvert', texte: 'Autorisé d’après le règlement' })
      : statut === 'saison' ? { niveau: 'ferme', texte: 'Hors période autorisée' }
      : statut === 'ferme' ? { niveau: 'ferme', texte: 'Seuil réglementaire non atteint' }
      : { niveau: 'inconnu', texte: 'État non publié : vérifiez sur place ou auprès du gestionnaire' };
    recs.push({
      id: r.id, pays: r.pays, region: PAYS[r.pays], officiel: false, statut,
      nom: r.nom, riviere: r.riviere, annexe: null, saison, ouvert: statut === 'ouvert', justif,
      debit: v, debitHeure: g?.heure || null, unite: g?.unite || null, grandeur: g?.grandeur || null,
      min: rule.min ?? null, max: rule.max ?? null,
      station: r.gauge ? { code: String(r.gauge.station), nom: r.gauge.label } : null,
      serie: g?.serie || [], meteo: meteo[r.id] || [],
      description: rule.texte || '', regle: rule.texte || '', saisonsTexte: saisonsTexte(rule.saisons), source: r.source,
      difficulte: r.difficulte || null, longueurKm: geo?.km ?? Math.round(haversine(r.start, r.end) * 10) / 10,
      trace, traceApprox: !geo, altitudes: null, lignes: [],
      aires: [{ type: 'E', nom: 'Départ du parcours', info: '', lat: r.start[0], lon: r.start[1] }, { type: 'D', nom: 'Arrivée du parcours', info: '', lat: r.end[0], lon: r.end[1] }],
      prevision,
    });
  }
  return { recs, errors };
}
