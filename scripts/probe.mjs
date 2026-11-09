const UA = { 'User-Agent': 'kayak-wallonie/1.0 (https://github.com/skycrow2-cloud/kayak-wallonie)', 'Accept': 'application/json' };
const j = async u => { try { const r = await fetch(u, { headers: UA }); const t = await r.text(); try { return JSON.parse(t); } catch { console.log('NOJSON', r.status, u, t.slice(0, 200)); } } catch (e) { console.log('ERR', u, e.message); } };
const hw = await j('https://heichwaasser.lu/api/v1/rivers');
for (const r of hw || []) console.log('HW', r.name, '|', r.stations.map(s => `${s.id}:${s.city}(${s.latitude},${s.longitude}) ${s.current?.value}${s.current?.unit}`).join(' ; '));
const sid = hw?.find(r => /S[uû]re|Sauer/i.test(r.name))?.stations?.[0]?.id;
for (const p of [`stations/${sid}`, `stations/${sid}/measurements`, `rivers/1`]) { const x = await j('https://heichwaasser.lu/api/v1/' + p); console.log('HWP', p, JSON.stringify(x)?.slice(0, 600)); }
const K = 'https://download.waterinfo.be/tsmdownload/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=1&format=json';
const kn = await j(K + '&request=getStationList&station_name=*Kleine*Nete*&returnfields=station_no,station_name,station_latitude,station_longitude');
console.log('KN', JSON.stringify(kn).slice(0, 2500));
for (const st of ['L11_022', 'L08_097', 'L08_194', 'L10_085', 'L10_09M']) {
  const l = await j(K + `&request=getTimeseriesList&station_no=${st}&returnfields=station_no,station_name,ts_id,ts_name,parametertype_name,ts_unitsymbol`);
  console.log('TS', st, JSON.stringify((l || []).filter(r => /^(H|Q)$/.test(r[4]) || r === l[0]).slice(0, 14)));
}
