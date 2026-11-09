// Sonde ponctuelle des API (lancée à la main dans GitHub Actions) — sortie dans le journal.
const UA = { 'User-Agent': 'Mozilla/5.0 (kayak-wallonie probe)', 'Accept': '*/*' };
async function get(url, n = 1500, opts = {}) {
  try {
    const r = await fetch(url, { headers: UA, ...opts });
    const t = await r.text();
    console.log(`\n### ${r.status} ${url.slice(0, 160)}\n${t.slice(0, n)}`);
    return t;
  } catch (e) { console.log(`\n### ERR ${url.slice(0, 160)} ${e.message}`); return ''; }
}
const steps = (process.env.PROBE || 'lu,fr,vl,osm').split(',');
if (steps.includes('lu')) {
  const kml = await get('https://www.inondations.lu/stations.kml', 200);
  console.log('LU kml len', kml.length, kml.slice(0, 1500)); console.log('LU names', [...kml.matchAll(/<name>\s*(?:<!\[CDATA\[)?([^<\]]*)/g)].map(m => m[1]).join(' | ').slice(0, 3000));
  await get('https://www.inondations.lu/water-level-export/all', 3000);
  await get('https://heichwaasser.lu/api/v1/rivers', 1500);
}
if (steps.includes('fr')) {
  for (const r of ['Semoy', 'Meuse', 'Chiers', 'Houille', 'Viroin', 'Bar']) {
    const t = await get(`https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?libelle_cours_eau=${encodeURIComponent(r)}&code_departement=08&en_service=true&format=json&size=30&fields=code_station,libelle_station,longitude_station,latitude_station`, 0);
    try { console.log(r, JSON.stringify(JSON.parse(t).data)); } catch { console.log(r, t.slice(0, 300)); }
  }
}
if (steps.includes('vl')) {
  for (const ds of [1, 4]) for (const n of ['*Nete*', '*Dommel*', '*Dijle*', '*Zenne*', '*Demer*', '*Mark*'])
    await get(`https://download.waterinfo.be/tsmdownload/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=${ds}&request=getStationList&format=json&station_name=${encodeURIComponent(n)}&returnfields=station_no,station_name,station_latitude,station_longitude`, 900);
}
if (steps.includes('osm')) {
  const q = '[out:json][timeout:60];way["waterway"="river"]["name"~"Semoy|Semois"](49.78,4.72,49.92,4.98);out geom;';
  for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    for (const ua of ['kayak-wallonie/1.0 (https://github.com/skycrow2-cloud/kayak-wallonie)']) {
      const t = await get(host + '?data=' + encodeURIComponent(q), 0, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
      try { const j = JSON.parse(t); console.log('OSM OK', host, 'ways', j.elements.length, 'pts', j.elements.reduce((s, e) => s + (e.geometry?.length || 0), 0)); } catch { console.log('OSM KO', host, t.slice(0, 200)); }
    }
  }
}
