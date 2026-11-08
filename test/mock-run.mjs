// Test hors-ligne : simule les réponses des API (formats relevés le 08/11/2026).
import { rmSync } from 'node:fs';
process.chdir(new URL('..', import.meta.url).pathname);
for (const f of ['test/out/state.json', 'test/out/static.json']) rmSync(f, { force: true });
process.env.OUT_FILE = 'test/out/data.json';
process.env.STATE_FILE = 'test/out/state.json';
process.env.STATIC_CACHE = 'test/out/static.json';
process.env.NTFY_TOPIC = 'test-topic';

const mk = (id, typ, nav, code, q, min, max, nom, riv, desc) => ({
  nomtro: id, troope: 'O', typtro: typ, adrtro: nom, stapub: nav === 'O' ? '1' : '0', pubint: 'O', codaqu: code,
  justif: nav === 'N' ? "Débit insuffisant" : null,
  despar: desc, noteco: '',
  station: { nomsta: code, libsta: 'Station', coueau: { libriv: riv } },
  mesjou: { nomtro: id, debitj: q, navaut: nav, formatedDatmes: '08/11/2026', heudebj: '08:00' },
  tropar: { nomtro: id, codpar: 'DEBIT', sebas1: min, sehau1: max },
});
const troncons = { troncons: [
  mk('SEMOIS2-3', '1', 'N', 'S9541', 0.643, 1.5, 31, "La Semois, de Chiny jusqu'au pont de Linglé", 'Semois', 'Facile. Pour pratiquants débutants. Difficulté WW I (I+ par niveau élevé).'),
  mk('AMBLEVE1', '1', 'O', 'S6732', 6.2, 5, 40, "L'Amblève entre la Confluence avec la Warche et le Pont de Cheneux", 'Amblève', 'Sportif. WW II-III.'),
  mk('SURE', '2', 'N', 'L5610', 0.143, 2.5, 25, "La Sûre, en aval de la rampe d'accès", 'Sûre', ''),
]};
const line = (a, b) => ({ type: 'Feature', properties: { nomtro: a, pubint: 'O' }, geometry: { type: 'MultiLineString', coordinates: [b, [...b].reverse()] } });
const geoTr = { features: [
  line('SEMOIS2-3', [[5.3222, 49.7199], [5.30, 49.71], [5.2656, 49.706]]),
  line('AMBLEVE1', [[5.9318, 50.3912], [5.8768, 50.3946], [5.8226, 50.3977]]),
  line('SURE', [[5.7293, 49.8308], [5.7826, 49.8757]]),
]};
const pt = (tro, typ, nom, lon, lat) => ({ type: 'Feature', properties: { nomtro: tro, typemb: typ, nomair: nom, divers: 'Rive droite\nGPS : 50°', pubint: 'O' }, geometry: { type: 'Point', coordinates: [lon, lat] } });
const geoAi = { features: [
  pt('SEMOIS2-3', 'ED', 'Aire de Chiny "plage"', 5.3507, 49.7387), pt('SEMOIS2-3', 'ED', 'Aire Herbeumont', 5.2316, 49.7747),
  pt('AMBLEVE1', 'E', 'Aire "Au Pont de l\'Amblève" à Stavelot', 5.9318, 50.3912), pt('AMBLEVE1', 'D', 'Aire "Au Pont de Cheneux"', 5.8226, 50.3977),
  pt('SURE', 'E', 'Aire "Im Wohr"', 5.7293, 49.8308),
]};
const now = Date.now();
const serie = (base, slope) => Array.from({ length: 168 }, (_, i) => [new Date(now - (167 - i) * 36e5).toISOString().replace('Z', '+00:00'), +(base + slope * (i - 167)).toFixed(3)]);
const kiwisList = [['station_no', 'ts_id', 'ts_name', 'parametertype_name'], ['9541', '302640010', '10-Debit.1h.Moyen', 'Q'], ['6732', '299124010', '10-Debit.1h.Moyen', 'Q'], ['L5610', '272798010', '10-Debit.1h.Moyen', 'Q']];
const kiwisVals = [{ ts_id: '302640010', data: serie(0.65, -0.001) }, { ts_id: '299124010', data: serie(5.6, -0.004) }, { ts_id: '272798010', data: serie(0.143, 0) }];
const days = n => Array.from({ length: n }, (_, i) => new Date(now + (i - 2) * 864e5).toISOString().slice(0, 10));
const meteo = [12, 1, 0].map(r => ({ daily: { time: days(6), precipitation_sum: [0, 2, r, 3, 1, 0], temperature_2m_max: [9, 10, 11, 8, 7, 9], weather_code: [3, 61, 63, 3, 2, 1] } }));

const calls = [];
globalThis.__mockFetch = async (url, opts = {}) => {
  calls.push((opts.method || 'GET') + ' ' + url.slice(0, 110));
  const ok = b => ({ ok: true, status: 200, json: async () => b });
  if (url.includes('troncons')) return ok(troncons);
  if (url.includes('MapServer/5/')) return ok(geoTr);
  if (url.includes('MapServer/3/')) return ok(geoAi);
  if (url.includes('getTimeseriesList')) return ok(kiwisList);
  if (url.includes('getTimeseriesValues')) return ok(kiwisVals);
  if (url.includes('open-meteo')) return ok(meteo);
  if (url.includes('ntfy')) return ok({});
  return { ok: false, status: 404 };
};

const { readFileSync, writeFileSync } = await import('node:fs');
// 1er passage : état initial
await (await import('../scripts/update.mjs')).main;
await new Promise(r => setTimeout(r, 300));
// 2e passage : la Semois passe ouverte -> doit notifier
troncons.troncons[0].mesjou.navaut = 'O';
globalThis.__noMain = true;
const mod = await import('../scripts/update.mjs?2');
await mod.main();
const d = JSON.parse(readFileSync('test/out/data.json', 'utf8'));
console.log('ntfy calls:', calls.filter(c => c.startsWith('POST')));
for (const t of d.troncons) console.log(t.id, t.ouvert, t.debit, t.min, t.longueurKm, 'km', t.difficulte, t.prevision.niveau, '-', t.prevision.texte, '| aires', t.aires.length, '| serie', t.serie.length, '| meteo', t.meteo.length);
// fixture pour tester le front
writeFileSync('site/data.json', JSON.stringify(d));
