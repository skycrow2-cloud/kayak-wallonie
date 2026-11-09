for (const u of ['https://fonts.openmaptiles.org/Open%20Sans%20Semibold/0-255.pbf', 'https://demotiles.maplibre.org/font/Open%20Sans%20Semibold/0-255.pbf', 'https://fonts.openmaptiles.org/Noto%20Sans%20Bold/0-255.pbf']) {
  try { const r = await fetch(u); const b = await r.arrayBuffer(); console.log('FONT', r.status, b.byteLength, r.headers.get('access-control-allow-origin'), u); } catch (e) { console.log('FONT ERR', u, e.message); }
}
