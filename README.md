# Kayak Wallonie

Carte mobile des parcours de kayak en Wallonie : état du jour, débit en direct, prévision indicative sur 3 jours, aires d'embarquement et alertes push.

Le site est hébergé gratuitement par GitHub. Toutes les heures, une tâche automatique récupère les données et republie le site.

## Sources

| Donnée | Source |
|---|---|
| Ouvert/fermé du jour, seuils de débit, descriptions | Infokayak (SPW) – `kayak.spw.wallonie.be/rest/services/troncons/` |
| Tracés et aires d'embarquement | Géoservices SPW – `APP_KAYAK/PKAYAK/MapServer` (rafraîchi chaque semaine) |
| Débit horaire sur 7 jours | hydrometrie.wallonie.be (KiWIS, série `10-Debit.1h.Moyen`) |
| Pluie et températures | Open-Meteo |

La « prévision » est une estimation maison (débit, tendance, pluie prévue). Seul l'affichage officiel d'Infokayak fait foi.

## Mise en route (10 minutes)

1. **Créer le dépôt** : sur github.com, cliquez sur *New repository*, nommez-le par exemple `kayak-wallonie`, laissez-le **Public** (GitHub Pages est gratuit pour les dépôts publics) et validez.
2. **Envoyer les fichiers** : sur la page du dépôt vide, cliquez sur *uploading an existing file*. Glissez-y **tout le contenu** du dossier décompressé, y compris le dossier `.github` (sur Mac, `Cmd+Maj+.` affiche les dossiers cachés). Puis cliquez sur *Commit changes*.
3. **Activer le site** : *Settings → Pages → Build and deployment → Source : GitHub Actions*.
4. **Activer les alertes (facultatif)** :
   - choisissez un nom de sujet difficile à deviner, par exemple `kayak-wal-7f3k9q` ;
   - *Settings → Secrets and variables → Actions → New repository secret* : nom `NTFY_TOPIC`, valeur = votre sujet ;
   - pour ne suivre que certaines rivières : onglet *Variables → New repository variable*, nom `WATCH`, valeur par ex. `Semois,Lesse,Ourthe` (noms de rivière ou codes de tronçon comme `LESSE6-7`). Sans cette variable, vous êtes alerté pour tous les parcours ;
   - sur votre téléphone, installez l'app **ntfy** (Android/iOS) et abonnez-vous au même sujet.
5. **Premier lancement** : onglet *Actions → Mise à jour des données → Run workflow*. Après environ 1 minute, le site est en ligne sur `https://VOTRE-NOM.github.io/kayak-wallonie/`.
6. **Installer sur le téléphone** : ouvrez cette adresse, puis *Ajouter à l'écran d'accueil*.

## Si le premier lancement échoue

Ouvrez le run en rouge dans l'onglet *Actions* et regardez l'étape « Collecter les données ». Le message indique quelle source n'a pas répondu. Les serveurs de la Région peuvent refuser les machines de GitHub, situées hors de Belgique. Dans ce cas, copiez le message d'erreur et demandez de l'aide pour l'ajuster.

Seul Infokayak est indispensable. Si les autres sources tombent, le site s'affiche quand même, avec un bandeau « informations partielles ».

## Structure

```
.github/workflows/update.yml   tâche horaire + publication
scripts/update.mjs             collecte -> site/data.json (Node 20, sans dépendance)
site/                          l'application (index.html, PWA)
test/mock-run.mjs              test hors-ligne avec des réponses simulées
```

Test local : `node test/mock-run.mjs`, puis `cd site && python3 -m http.server` et ouvrir http://localhost:8000.
