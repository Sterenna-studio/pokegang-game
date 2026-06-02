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
- [ ] Sigle Magma drope en zone Magma (1,5%)
- [ ] Sceau Aqua drope en zone Aqua (1,5%)
- [ ] Combat Groudon disponible à pwr ≥ 4500
- [ ] Combat Kyogre disponible à pwr ≥ 4500

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
- [ ] **CP4 Supabase** : validé
- [ ] **→ PRÊT POUR RELEASE**
