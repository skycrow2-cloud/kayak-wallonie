// Parcours hors Wallonie. L'état y est ESTIMÉ à partir du règlement (période + seuil d'échelle),
// faute de publication officielle quotidienne comme Infokayak. Les règles sont reprises des textes cités dans `source`.
//
// start = embarquement (amont), end = débarquement (aval), en [lat, lon].
// gauge.provider : 'lu' (heichwaasser.lu, cm), 'vl' (waterinfo.be KiWIS), 'fr' (Hub'Eau).
// rule.saisons : périodes autorisées [{ from:'MM-DD', to:'MM-DD' }] (to < from = à cheval sur l'an), absent = toute l'année.
// rule.min / rule.max : seuil sur la mesure de gauge (même unité), absent = pas de seuil chiffré.

export const PAYS = { VL: 'Flandre', BXL: 'Bruxelles', LU: 'Luxembourg', DE: 'Allemagne', FR: 'France' };

const HIVER = [{ from: '10-01', to: '03-31' }];
const SURE_AVAL = [{ from: '06-15', to: '02-29' }];

export const ROUTES = [
  // ---------------- Flandre (VMM) ----------------
  {
    id: 'VL-KLEINE-NETE', pays: 'VL', riviere: 'Kleine Nete', osm: 'Kleine Nete',
    nom: 'La Kleine Nete, du moulin de Retie au moulin de Grobbendonk',
    start: [51.2440, 5.0527], end: [51.1941, 4.7537],
    gauge: { provider: 'vl', station: 'L10_054', label: 'Herentals' },
    rule: { texte: 'Navigation de jour, uniquement via les pontons et aires désignés. La VMM interdit temporairement la navigation quand la profondeur descend sous 50 cm (pas de seuil d’échelle publié).' },
    source: 'https://vmm.vlaanderen.be/beleid/waterbeleid/waterrecreatie',
    difficulte: 'Facile, portages aux barrages',
  },
  {
    id: 'VL-DOMMEL', pays: 'VL', riviere: 'Dommel', osm: 'Dommel',
    nom: 'La Dommel à Pelt, d’Overpelt à la frontière',
    start: [51.2262, 5.4245], end: [51.2603, 5.4211],
    gauge: { provider: 'vl', station: 'L11_022', label: 'Overpelt' },
    rule: { texte: 'Navigation possible hors interdiction temporaire de la VMM (profondeur minimale de 50 cm).' },
    source: 'https://vmm.vlaanderen.be/beleid/waterbeleid/waterrecreatie',
  },
  {
    id: 'VL-DIJLE', pays: 'VL', riviere: 'Dijle', osm: 'Dijle|Dyle',
    nom: 'La Dyle (Dijle), de Sint-Joris-Weert à Leuven',
    start: [50.7990, 4.6470], end: [50.8705, 4.6946],
    gauge: { provider: 'vl', station: 'L08_097', label: 'Korbeek-Dijle' },
    rule: { texte: 'Kayak, canoë, raft et SUP autorisés selon la convention VMM ; portages obligatoires aux barrages et moulins.' },
    source: 'https://vmm.vlaanderen.be/beleid/waterbeleid/waterrecreatie',
  },
  {
    id: 'BXL-ZENNE', pays: 'VL', riviere: 'Zenne', osm: 'Zenne|Senne',
    nom: 'La Senne (Zenne), de Lot à Drogenbos',
    start: [50.7665, 4.2745], end: [50.8051, 4.3008],
    gauge: { provider: 'vl', station: 'L08_194', label: 'Halle' },
    rule: { texte: 'Parcours de pagaie balisé (convention VMM 2024) entre Lot et Drogenbos.' },
    source: 'https://vmm.vlaanderen.be/beleid/waterbeleid/waterrecreatie',
  },

  // ---------------- Luxembourg (règlement grand-ducal sur le canotage) ----------------
  {
    id: 'LU-SURE-1', pays: 'LU', riviere: 'Sûre', osm: 'Sûre|Sauer',
    nom: 'La Sûre, de Martelange à Neimillen (Bigonville)',
    start: [49.8312, 5.7372], end: [49.8686, 5.8000],
    gauge: { provider: 'lu', station: 81, label: 'Bigonville' },
    rule: { saisons: HIVER, texte: 'Autorisé du 1er octobre au 31 mars. Le ministre peut interdire temporairement si le niveau menace la faune ou la flore.' },
    source: 'https://legilux.public.lu/',
    difficulte: 'Eau vive, réservé aux pagayeurs expérimentés',
  },
  {
    id: 'LU-SURE-2', pays: 'LU', riviere: 'Sûre', osm: 'Sûre|Sauer',
    nom: 'La Sûre, du barrage de compensation d’Esch-sur-Sûre à Ettelbruck',
    start: [49.9050, 5.9440], end: [49.8460, 6.1000],
    gauge: { provider: 'lu', station: 3, label: 'Michelau' },
    rule: { saisons: HIVER, texte: 'Autorisé du 1er octobre au 31 mars.' },
    source: 'https://legilux.public.lu/',
  },
  {
    id: 'LU-SURE-3', pays: 'LU', riviere: 'Sûre', osm: 'Sûre|Sauer',
    nom: 'La Sûre, d’Ettelbruck à Wallendorf-Pont',
    start: [49.8460, 6.1000], end: [49.8745, 6.2900],
    gauge: { provider: 'lu', station: 63, label: 'Diekirch' },
    rule: { saisons: SURE_AVAL, texte: 'Autorisé du 15 juin au 29 février (parcours d’entraînement Ingeldorf–Diekirch ouvert toute l’année).' },
    source: 'https://legilux.public.lu/',
  },
  {
    id: 'LU-SURE-4', pays: 'LU', riviere: 'Sûre / Sauer', osm: 'Sûre|Sauer',
    nom: 'La Sûre frontalière, de Wallendorf-Pont à Echternach',
    start: [49.8745, 6.2900], end: [49.8125, 6.4210],
    gauge: { provider: 'lu', station: 67, label: 'Bollendorf' },
    rule: { saisons: SURE_AVAL, min: 56, feteDieu: true, texte: 'Rivière frontière LU/DE : interdit du 1er mars à la veille de la Fête-Dieu (au plus tard 14 juin), sauf Ascension tardive et Pentecôte. Ensuite, autorisé seulement si l’échelle de Bollendorf atteint 56 cm. Mise à l’eau aux seules aires désignées.' },
    source: 'https://sgdnord.rlp.de/',
  },
  {
    id: 'LU-SURE-5', pays: 'LU', riviere: 'Sûre / Sauer', osm: 'Sûre|Sauer',
    nom: 'La Sûre frontalière, d’Echternach à Steinheim (confluence de la Prüm)',
    start: [49.8125, 6.4210], end: [49.8105, 6.4690],
    gauge: { provider: 'lu', station: 67, label: 'Bollendorf' },
    rule: { saisons: SURE_AVAL, min: 56, feteDieu: true, texte: 'Même règle que l’amont : période autorisée et 56 cm minimum à Bollendorf. Le lac de Rosport-Ralingen est ouvert toute l’année.' },
    source: 'https://sgdnord.rlp.de/',
  },
  {
    id: 'LU-SURE-6', pays: 'LU', riviere: 'Sûre / Sauer', osm: 'Sûre|Sauer',
    nom: 'La Sûre frontalière, du canal de Rosport à Wasserbillig',
    start: [49.7590, 6.5130], end: [49.7146, 6.5005],
    gauge: { provider: 'lu', station: 67, label: 'Bollendorf' },
    rule: { saisons: SURE_AVAL, min: 56, feteDieu: true, texte: 'Période autorisée et 56 cm minimum à l’échelle de Bollendorf.' },
    source: 'https://sgdnord.rlp.de/',
  },
  {
    id: 'LU-OUR', pays: 'LU', riviere: 'Our', osm: 'Our|Ur',
    nom: 'L’Our, du pont de Vianden à Wallendorf-Pont',
    start: [49.9345, 6.2070], end: [49.8760, 6.2880],
    gauge: { provider: 'lu', station: 19, label: 'Vianden' },
    rule: { saisons: HIVER, texte: 'Autorisé du 1er octobre au 31 mars.' },
    source: 'https://legilux.public.lu/',
  },
  {
    id: 'LU-CLERVE', pays: 'LU', riviere: 'Clerve', osm: 'Clerve|Clerf|Klierf',
    nom: 'La Clerve, de Clervaux à Kautenbach',
    start: [50.0535, 6.0275], end: [49.9530, 6.0220],
    gauge: { provider: 'lu', station: 65, label: 'Clervaux' },
    rule: { saisons: HIVER, texte: 'Autorisé du 1er octobre au 31 mars.' },
    source: 'https://legilux.public.lu/',
    difficulte: 'Eau vive',
  },
  {
    id: 'LU-WILTZ', pays: 'LU', riviere: 'Wiltz', osm: 'Wiltz|Wolz',
    nom: 'La Wiltz, de Wiltz à Goebelsmühle',
    start: [49.9660, 5.9360], end: [49.9225, 6.0500],
    gauge: { provider: 'lu', station: 55, label: 'Kautenbach' },
    rule: { saisons: HIVER, texte: 'Autorisé du 1er octobre au 31 mars.' },
    source: 'https://legilux.public.lu/',
    difficulte: 'Eau vive',
  },
  {
    id: 'LU-ALZETTE', pays: 'LU', riviere: 'Alzette', osm: 'Alzette|Uelzecht|Alzig',
    nom: 'L’Alzette, de Mersch à Ettelbruck',
    start: [49.7520, 6.1145], end: [49.8437, 6.0971],
    gauge: { provider: 'lu', station: 53, label: 'Mersch' },
    rule: { saisons: [{ from: '01-01', to: '12-31' }], texte: 'Autorisé toute l’année (de Hesperange à Ettelbruck).' },
    source: 'https://legilux.public.lu/',
  },

  // ---------------- Allemagne ----------------
  {
    id: 'DE-RUR', pays: 'DE', riviere: 'Rur', osm: 'Rur|Roer',
    nom: 'La Rur, de Heimbach à Obermaubach',
    start: [50.6370, 6.4760], end: [50.7130, 6.4490],
    gauge: null,
    rule: { saisons: [{ from: '07-15', to: '02-28' }], texte: 'Autorisé du 15 juillet au 28 février, avec une autorisation (place de bateau) à réserver auprès du Kanu-Verband NRW. Le débit dépend des lâchers du barrage de Heimbach (Pegeldienst Kanu-NRW).' },
    source: 'https://www.kanu-nrw.de/',
  },

  // ---------------- France (Ardennes) ----------------
  {
    id: 'FR-SEMOY', pays: 'FR', riviere: 'Semoy', osm: 'Semoy|Semois',
    nom: 'La Semoy, des Hautes-Rivières à Monthermé',
    start: [49.8860, 4.8370], end: [49.8830, 4.7380],
    gauge: { provider: 'fr', station: 'B611101001', grandeur: 'Q', label: 'Haulmé' },
    rule: { texte: 'Pas de seuil réglementaire publié. Débarquez aux aires des campings et loueurs ; niveau souvent trop bas en été.' },
    source: 'https://www.visitardenne.com/',
  },
  {
    id: 'FR-MEUSE', pays: 'FR', riviere: 'Meuse', osm: 'Meuse|Maas',
    nom: 'La Meuse, de Charleville-Mézières à Monthermé',
    start: [49.7700, 4.7230], end: [49.8830, 4.7300],
    gauge: { provider: 'fr', station: 'B540001001', grandeur: 'Q', label: 'Charleville-Mézières' },
    rule: { saisons: [{ from: '01-01', to: '12-31' }], texte: 'Voie navigable ouverte toute l’année : cédez le passage aux bateaux, contournez les écluses par les aires de portage.' },
    source: 'https://www.vnf.fr/',
  },
];
