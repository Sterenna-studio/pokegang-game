# PokéGang — Checklist QA pré-release

> Remplis chaque case en cours de jeu. `[x]` = OK · `[!]` = bug trouvé (note le détail) · `[-]` = non testé

---

## CP3-A — Unlock Flow Régions

### Johto
- [ ] La cinématique Archer (Johto) se déclenche aux bonnes conditions (rep 800+ · Ligue Kanto vaincue · puissance suffisante)
- [ ] La cinématique se joue correctement jusqu'au bout sans freeze
- [ ] Après la cinématique, les zones Johto apparaissent dans le sélecteur
- [ ] Le bouton région "Johto" est visible dans le sélecteur de zones
- [ ] Les missions daily/hebdo **Johto** apparaissent dans l'onglet Missions
- [ ] Les quêtes horaires Johto apparaissent (si Johto débloqué)
- [ ] Les Pokémon Johto (dex 152–251) s'affichent dans l'onglet Pokédex → Johto

### Hoenn
- [ ] La cinématique Pierre / Métaloss se déclenche (rep 2000+ · Ligue Johto vaincue · puissance ≥ 2500)
- [ ] Les **4 yeux rouges** de Métaloss brillent sur la silhouette noire (step 2)
- [ ] La cinématique se joue jusqu'au bout sans freeze
- [ ] Les zones Hoenn apparaissent dans le sélecteur
- [ ] Les missions daily/hebdo **Hoenn** apparaissent
- [ ] Les Pokémon Hoenn (dex 252–386) s'affichent dans Pokédex → Hoenn
- [ ] La quête Groudon/Kyogre se débloque à rep ≥ 2500 (notification + bouton 🌋🌊 dans les zones)

### Sinnoh
- [ ] Les zones Sinnoh apparaissent après déblocage
- [ ] Les missions daily/hebdo **Sinnoh** apparaissent
- [ ] Les Pokémon Sinnoh (dex 387–493) s'affichent dans Pokédex → Sinnoh
- [ ] La quête Team Galaxie se débloque à rep ≥ 4500

### Pokédex National
- [ ] L'onglet **National** du Pokédex affiche bien les espèces de toutes les régions débloquées
- [ ] Le compteur "X / 493" s'affiche correctement

---

## CP3-B — Quêtes Légendaires

### Kanto — Oiseaux
- [ ] Quête **Zapdos** débloquée à rep 700 (notification "Quête débloquée : Électhor")
- [ ] Quête **Artikodin** débloquée à rep 800 (notification "Quête débloquée : Artikodin")
- [ ] Quête **Sulfura** débloquée à rep 950 (notification "Quête débloquée : Sulfura")
- [ ] Étape 1 : les combats en zone associée incrémentent le compteur (0/10)
- [ ] Étape 2 : le bouton "Affronter Lorelei / Maj. Bob / Capitaine" est cliquable quand pwr ≥ requis
- [ ] Étape 3 : le combat Artikodin/Zapdos/Sulfura se lance, résultat (capturé ou échappe)
- [ ] Si capturé : le Pokémon apparaît dans le PC
- [ ] Relance possible avec Plume Sacrée (si échappe)
- [ ] `birdsMission[key].owned` passe à `true` → ne réapparaît plus en pool de spawn de la zone

### Kanto — Mewtwo
- [ ] Quête Mewtwo débloquée à rep 900
- [ ] Étapes Rocket (20 combats) → Sylphe Co. (3 rapports) → Manoir (10 combats) → Giovanni → Mewtwo
- [ ] Combat Mewtwo fonctionne (puissance ≥ 6000)

### Johto — Bêtes Sacrées / Lugia / Ho-Oh
- [ ] Quête Bêtes Sacrées débloquée (rep 800 + Johto)
- [ ] Quête Lugia débloquée (rep 1000 + Johto)
- [ ] Quête Ho-Oh débloquée (rep 1000 + Johto)
- [ ] Les Argent'Ailes droppent dans les zones Johto marines (Îles Tourbillon, routes côtières)
- [ ] Les Arcenci'Ailes droppent dans les zones rurales Johto
- [ ] Lugia : bouton affrontement disponible à pwr ≥ 5000
- [ ] Ho-Oh : bouton affrontement disponible à pwr ≥ 5500

### Hoenn — Groudon / Kyogre
- [ ] Bouton 🌋🌊 visible dans la barre de zones (Hoenn débloqué + rep 2500)
- [ ] Étape 1 Groudon : combats zones Magma incrémentent (mt_chimney, jagged_pass…)
- [ ] Étape 1 Kyogre : combats zones Aqua incrémentent
- [ ] Au 20e combat Magma : `magma_hideout_key` est accordée et le QG Magma devient accessible à réputation suffisante
- [ ] Au 20e combat Aqua : `aqua_hideout_key` est accordée et le QG Aqua devient accessible à réputation suffisante
- [ ] Vaincre Maxie OU Archie accorde `cave_origin_pass` et ouvre la Caverne Originelle à réputation suffisante
- [ ] Capturer Groudon ET Kyogre accorde `regi_seal` et ouvre les Grottes des Régis à réputation suffisante
- [ ] Une ancienne save déjà avancée reçoit rétroactivement les accès mérités au chargement
- [ ] Sigle Magma drope en zone Magma (1,5%)
- [ ] Sceau Aqua drope en zone Aqua (1,5%)
- [ ] Combat Groudon disponible à pwr ≥ 4500
- [ ] Combat Kyogre disponible à pwr ≥ 4500

### Combat — lisibilité des sprites
- [ ] Les sprites des deux camps restent à opacité normale pendant tout le replay
- [ ] Le résultat pré-calculé ne grise pas le dresseur, le raid ou son Pokémon avant la fin visuelle du combat
- [ ] L'animation spécifique d'un Pokémon K.O. reste limitée à ce Pokémon
- [ ] Le bouton vitesse passe de ×1 à ×5, ×100 puis ×1 dans un combat standard et un combat événement
- [ ] Avant le démarrage, « Fuir » ferme uniquement la séquence courante ; après le replay, « Fermer » remplace ce handler sans le cumuler

### Hoenn — Deoxys
- [ ] Bouton ☄️ Deoxys visible après Ever Grande vaincu
- [ ] Étapes fonctionnelles (dresseurs Hoenn → météores → Labo Spatial → directeur → Deoxys)

### Sinnoh — Trio du Lac
- [ ] Quêtes Uxie / Mesprit / Azelf débloquées à rep 4200
- [ ] Combats en Rives du Lac incrémentent (0/8)
- [ ] Combat légendaire fonctionne à pwr ≥ 4000

### Sinnoh — Dialga / Palkia / Giratina
- [ ] Quête Team Galaxie débloquée à rep 4500
- [ ] Mars + Jupiter vaincus individuellement
- [ ] Pilier Axial : combats incrémentent
- [ ] Cyrus vaincu → choix Dialga ou Palkia
- [ ] Giratina débloqué après Cyrus (Grotte Retour)

---

## CP3-C — Onboarding V2 (tunnel de première session)

> Toujours tester depuis un slot **vide** — une save existante migre en schéma
> courant et se marque `completed` d'office, elle ne rejoue jamais le tunnel.

### Le tunnel
- [ ] Sur un nouveau slot, le terrain de départ ("Zone inconnue") s'ouvre seul,
      chrome isolé (barre d'onglets, sélecteur de zones, fiche QG masqués —
      `body.onboarding-focus`)
- [ ] Le fond de la Zone inconnue s'affiche (prairie), pas un aplat de couleur
- [ ] 10 captures libres déclenchent l'embuscade Rocket
- [ ] Les sbires entrent en scène avec leur bulle, un clic fait avancer chaque
      réplique (pas de saut global au premier clic)
- [ ] Après l'embuscade (gagnée ou perdue), Giovanni arrive en personne,
      enchaîne ses répliques, PUIS son écran d'identité s'ouvre
- [ ] Après l'écran d'identité, Giovanni repart ; le sbire qui reste planté là
      est le transfuge (recrutement gratuit, choix du visage parmi les
      assaillants **effectivement vus** pendant l'embuscade)
- [ ] Le transfuge réclame dans l'ordre : un Pokémon → une zone → l'option combat
- [ ] Fin du tunnel : argent de complétion versé une seule fois, terrain de
      départ fermé et retiré du sélecteur, popup de fin (agent + zone + timer)

### Déblocage progressif après le tunnel
- [ ] Le Marché se débloque immédiatement à la fin du tunnel (popup dédiée)
- [ ] Pokédex à la 1ère capture post-tunnel, Missions à la 5e — la quête
      journalière "Attraper 5 Pokémon" est déjà réclamable à ce moment-là
- [ ] Événements au 1er combat mené par un agent
- [ ] Raids à rep 50, Classement à rep 100, Compte à la 2e session
- [ ] Une save antérieure à ce système garde TOUS ses onglets (pas de perte)

### Fogmap
- [ ] Sur un compte neuf, aucune tuile verrouillée ne s'affiche avant ~60% du
      seuil de réputation de la zone la plus proche
- [ ] La section "🔑 À débloquer" liste les zones à objet/événement par leur
      nom (Casino, Sylphe SARL, S.S. Anne, Jardin de Pallet…) même à rep 0

### Flashback (saves pré-existantes)
- [ ] Une save déjà `completed` qui n'a jamais vu la cinématique se voit
      proposer le flashback une fois, au boot
- [ ] "Revivre" rejoue les mêmes répliques en filtre sépia/N&B ; "Non merci"
      ne touche à rien (pas de zone rouverte, pas d'onglet reverrouillé)
- [ ] L'offre ne revient jamais après (rechargement inclus)

### Pièges rencontrés pendant le développement (à ne pas redécouvrir)
- **Cache des imports ES imbriqués** : un `import` niché dans un autre module
  (`data/*.js` importé depuis `app.js`) ne porte pas de `?v=` — F5 ou changer
  `?cb=` dans l'URL ne suffit PAS, le navigateur peut reservir une version
  périmée. Changer le port dans `.claude/launch.json` (origine neuve = cache
  vide) est la seule garantie. Diagnostic :
  `performance.getEntriesByType('resource')` → `transferSize: 0` sur un fichier
  qui vient d'être modifié = servi du cache.
- **`document.hidden` dans le volet navigateur** : `requestAnimationFrame` ne
  se déclenche jamais tant que le volet n'est pas affiché, donc tout ce qui en
  dépend (le debounce de `updateTopBar`, les animations CSS) ne progresse pas
  visuellement. Vérifier l'état via le DOM/JS direct plutôt que par capture
  d'écran seule.
- **Style inline vs feuille de style** : un élément qui reçoit
  `el.style.display = '...'` en JS à chaque rendu (ex. `#regionSwitcher`,
  l'animation d'un spawn) ignore une règle CSS externe sans `!important` —
  rencontré deux fois sur cette feature.
- **Preview `lab.sterenna.fr`** : seuls les fichiers runtime sont déployés
  (`tools/` n'y est pas) — les raccourcis console avec
  `fetch('/tools/dev-*.json')` ne marchent que sur `localhost`. Les deux
  variantes (web/itch) de la preview partagent le même `localStorage` —
  effacer les données du site avant de passer de l'une à l'autre.

---

## CP4 — Compte & Cloud Supabase

### Connexion
- [ ] La page Compte s'affiche correctement (onglet ☁ Compte)
- [ ] Connexion avec email/mot de passe fonctionne
- [ ] Message d'erreur si mauvais mot de passe

### Save cloud
- [ ] "Sauvegarder maintenant" → le statut passe à "✅ Syncé il y a Xs"
- [ ] Les snapshots apparaissent dans l'historique
- [ ] "Charger depuis le cloud" restaure bien la save

### Multi-navigateur
- [ ] Ouvrir le jeu dans un 2e navigateur (ou mode privé)
- [ ] Se connecter avec le même compte
- [ ] La save cloud est proposée au chargement si plus récente
- [ ] Les données sont identiques après restauration

### Leaderboard
- [ ] Votre gang apparaît dans le classement après une save cloud
- [ ] Le classement se charge sans erreur

### API publique (optionnel)
- [ ] Toggle "Profil public" → l'URL API s'affiche avec le token
- [ ] Copier l'URL → coller dans le navigateur → JSON retourné correct
- [ ] `docs/api.html` accessible sur https://pokegang.sterenna.fr/docs/api.html

---

## Notes de bugs

> Copie ce bloc pour chaque bug trouvé :

```
Bug #__ : [description courte]
- Étape pour reproduire :
- Résultat obtenu :
- Résultat attendu :
- Critique : oui / non
```

---

## Résultat global

- [ ] **CP3-A Régions** : validé
- [ ] **CP3-B Légendaires** : validé (ou bugs non-critiques acceptés)
- [ ] **CP3-C Onboarding V2** : validé
- [ ] **CP4 Supabase** : validé
- [ ] **→ PRÊT POUR RELEASE**
