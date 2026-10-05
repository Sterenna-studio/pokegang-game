# Audit des mécaniques — état du jeu au 5 octobre 2026 (v0.5.2, schéma 20)

Photographie de ce que fait **réellement le code** aujourd'hui, lue dans les sources (constantes dans
`data/`, logique dans `modules/systems/`). Elle sert de référence avant les prochains choix d'équilibrage.
`docs/design-alpha-mechanics.md` est la spec d'origine : plusieurs de ses règles ont divergé (voir §10).

Légende : **[vérifié]** = lu dans le code · **[à vérifier]** = déduit, pas testé en jeu.

---

## 1. Boucle centrale

1. Des **zones** génèrent des apparitions (Pokémon, dresseur, coffre, événement).
2. Le boss (zone ouverte) ou des **agents** (zone ouverte *ou* fermée, simulation silencieuse au vrai
   `spawnRate`) capturent / combattent.
3. Les captures alimentent le **PC** ; les combats rapportent des **₽** (revenu en attente par zone, à
   collecter) et de la **réputation**.
4. Les ₽ financent des agents, des boosts, des services (pension, labo, salle d'entraînement…).
5. La réputation débloque zones, régions, onglets et titres.

Tout tourne dans un Scheduler central (tick agents 2 s, pension 30 s, XP passif 30 s, entraînement 60 s,
sauvegarde 10 s, cloud 1 h) et les durées hors-ligne sont rattrapées au retour (`offlineCatchup.js`).

## 2. Pokémon

| Élément | Règle | Source |
|---|---|---|
| Potentiel ★ | ★1 35 % · ★2 30 % · ★3 20 % · ★4 10 % · ★5 5 % (Encens +1, plafonné à ★5) | `pokemon.js` |
| Chroma | 0,5 % de base · Aura 2,5 % · Charme Chroma ×2 (permanent) · + bonus de zone additif | `gameplay-config-data.js` |
| Stats | `base × (1 + 0,1·★) × nature × (1 + niveau/100)` | `calculateStats` |
| Puissance (PC) | `1,25·ATK + 0,65·DEF + 1,10·SPD`, soft cap 620 (au-delà ×0,52), chroma ×1,10, mal du pays ×0,75, variance individuelle | `power-config-data.js` |
| Niveau | 20 × niveau d'XP par palier, max 100 ; XP passif 3 / 30 s pour les équipes ; salle d'entraînement | `pokemon.js` |
| Évolution | automatique au niveau, pierre d'évolution (5 000 ₽) | `pokemon.js`, `economy-data.js` |
| Nature | 10 natures, ±10 % sur deux stats | `game-config-data.js` |

Prix de revente : `base(rareté) × multiplicateur ★ × (chroma ×10) × nature × événements de marché`.
Base : 100 / 250 / 600 / 1 500 / 5 000. Multiplicateur ★ : ×0,5 / 1 / 2 / 5 / 15. Saturation : −8 % par vente
récente de la même espèce, plafonné à −60 %, retombe de 1 vente par heure.

## 3. Zones, régions, réputation

- **117 zones à apparitions** (Kanto 27, Johto 30, Hoenn 30, Sinnoh 30 ; mesure faite en exécutant les fichiers de données, la première version de ce document en annonçait ~230 à tort) + QG, vivarium et terrain d'onboarding.
- Chaque zone a un seuil de **réputation**, un `spawnRate`, un pool, des types de dresseurs, un coût
  d'**investissement** (déverrouille élites et événements ; exige une puissance d'agents ≥ `rep × 10`).
- **Niveaux de zone 1-10** (XP cumulée 0 → 5 500 ; capture 2-15, combat 3, coffre 2). Bonus additifs :
  spawn jusqu'à +50 %, argent jusqu'à +50 %, rares jusqu'à +40 %, chroma jusqu'à +20 % (voir §10).
- **Paliers de rareté** selon le niveau de zone et la région (Kanto : rare dès 3, très rare dès 6,
  légendaire à 10 ; Johto un peu plus tôt).
- **Apparitions** : 5 % coffre (25 % avec boost), 8 % événement, élite si maîtrise ≥ 2 (10+ victoires),
  sinon Pokémon ou dresseur. Une zone dont la réputation est repassée sous le seuil passe en mode dégradé
  (combat seul).
- **Régions** : Kanto d'office · Johto 1 000 rép · puis Ligue Johto + 2 000 rép + 2 500 PC · Hoenn 3 500 rép +
  Ligue + 5 000 PC · Sinnoh et Deoxys par quêtes. Les quêtes légendaires (Kanto, Johto, Hoenn, Sinnoh, Deoxys)
  sont des modules dédiés (~800-1 000 lignes chacun) avec sprite en zone et vrai combat.
- **Réputation** : victoire +1 (×multiplicateur de difficulté), +10 pour les dresseurs « spéciaux » (champions,
  Conseil des 4, exécutifs Rocket, rivaux), défaite −5. Titres de 0 à 10 000 ; Capo à 500, Boss à 2 500,
  Intouchable à 10 000.

## 4. Combat

- Résolution : `puissance équipe × couverture de types (0,7-1,4) × (0,8-1,2)` contre la puissance des
  dresseurs ; le plus haut jet gagne. Le type n'agit donc que par un multiplicateur d'équipe, pas tour par tour.
- Gain : `rand(reward)` plafonné à **5 000 ₽**, × bonus de niveau de zone × multiplicateur de difficulté.
- Les raids enchaînent plusieurs dresseurs ; le boss et les agents assignés se battent ensemble.
- Combat manuel (zone ouverte, animé) et agent (silencieux) partagent la même formule.

## 5. Agents

- **Recrutement** : 5 k · 15 k · 100 k · 250 k · 500 k · 1 M · 2 M, puis +1 M par agent jusqu'à 10 M, puis +10 M
  par agent. Un agent = une zone.
- **Grades** par niveau d'agent : Grunt (1) → Sergent 25 → Lieutenant 50 → Commandant 75 → Élite (4 premiers à
  100) ou Général. Slots Pokémon 1 / 2 / 3. Multiplicateur de puissance 0,9 / 1,0 / 1,1 / 1,2 / 1,35 / 1,5.
- **XP d'agent** : captures (3-20 + bonus ★/chroma) et victoires ; `niveau × 30` par palier.
- **Énergie** : 10, remise à zéro à minuit. Une défaite en coûte 2 (3 en quête). À 0 : **prison 1 h**,
  rachetable `200 ₽ × niveau`, sortie à 5 d'énergie.
- Options par agent : capture auto, combat auto, raid auto, notifications.
- **Incubation d'œufs** (refondue ce mois-ci) : un agent = un œuf à la fois, gratuit, multiplicateur ×1,05 →
  ×1,35 selon les éclosions (10 / 50 / 100 / 500 / 1 000).

## 6. Pension et œufs (nouveau modèle)

- Pension achetée **par couples** : 1 offert, puis 200 k et 800 k (3 couples max). Un couple = un œuf toutes
  les 5 min, durée de couvaison 1 / 5 / 15 / 45 / 60 min selon la rareté.
- **Infirmière Joëlle (100 k)** ouvre la pension : sans elle, aucun œuf n'est produit ni récupéré. Option
  « éclosion auto » (désactivée par défaut).
- Un agent sans œuf en récupère un, le couve, le **dépose à la base** ; le joueur l'ouvre (popup à 3 clics :
  type, grade, chroma). Stock total plafonné à 24, la production se met en pause (rien n'est détruit).
- Chroma d'œuf : 1 % (aucun parent chroma), 5 % (un), 15 % (deux). Potentiel = moyenne des parents, +1 à 20 %.
- Autres sources d'œufs : Œuf Mystère (50 k + 500 k·log10(n+1), pool de bébés et starters), dons d'événements.

## 7. Économie (puits et robinets)

**Robinets** : revenu de zone (combats), ventes de Pokémon, missions (quotidiennes 500-3 000 ₽,
hebdomadaires jusqu'à 15 000 ₽, histoire), coffres, bulletins du Marché Noir (demandes de ~80 k à 1 M ₽),
raids PvP (butin plafonné à 1 M ₽ ; perte de 100 k ₽ en cas d'échec).

**Puits** : agents (jusqu'à plusieurs dizaines de M), investissements de zone (1,5 k → ~20 k+ ₽ par zone
Kanto), boosts (500 → 5 000 ₽), Œuf Mystère, Joëlle 100 k, Scientifique 15 k, vente auto 5 M, Traducteur
1 M, Charme Chroma 10 M, skins de ball (50 k → 1,5 M), slots d'entraînement (100 k → 3 M), couples de
pension (200 k / 800 k), titre « Richissime » 5 M, permis de zone (jusqu'à 1 M).

Constat : le plafond de gain par combat (5 000 ₽) et la courbe d'agents (+10 M au-delà du 15ᵉ) ancrent la
fin de partie sur la vente de Pokémon ★5 et chroma (×15 et ×10), pas sur les combats.

## 8. Services et méta

- **Marché** : boosts (Leurre ×2/×3 spawns 60 s, Encens +1★ 90 s, Rarioscope ×3 rares 90 s, Aura chroma ×5
  90 s), pierres, tickets de zones, événements de marché (±prix temporaires, apparition ~toutes les 30 min).
- **Marché Noir** : bulletin de 4 demandes, renouvelé toutes les 2 h.
- **Salle d'entraînement** : 6 slots (+6 achetables), combats internes toutes les minutes pour l'XP.
- **Labo / Scientifique** : révélation d'espèce d'œuf (10 k), mutation artificielle.
- **Missions** : quotidiennes, hebdomadaires, horaires (relance 500 ₽), histoire permanentes.
- **Raids PvP** (Supabase) : défense configurée, cooldown 1 h par cible.
- **Cosmétique** : page `/gang/` séparée (musique, fonds, pins, skins de ball, vitrine, vivarium), overlay OBS.
- **Déblocage progressif d'onglets** : Marché fin du tutoriel, Missions 5 captures, Événements 1 opération
  d'agent, Raids 50 rép, Classement 100 rép, Compte 2ᵉ session.
- **Compte** : sauvegarde cloud Supabase (1 h), classement, 3 slots locaux.

## 9. Ce qui est volontairement éteint

- Événements de zone V2 (`ZONE_EVENTS_ENABLED = false`) : territoire, prime, invasion rivale, tournoi,
  apparition légendaire. Les niveaux de zone restent actifs.
- Poké Balls : purement cosmétiques (plus de ressource ni d'effet sur le potentiel).

---

## 10. Écarts et points d'attention

Classés par ordre d'importance à mon avis.

1. **Chroma de zone probablement hors d'échelle [vérifié dans le code, intention à confirmer].**
   `ZONE_LEVEL_BONUSES.shinyBonus` vaut 0,05 → 0,20 et s'**ajoute** à la probabilité (`rollShiny`). Une zone
   niveau 10 donne donc ≈ 20,5 % de chroma par capture, contre 0,5 % de base ; niveau 7 ≈ 5,5 %. Pour
   comparaison, la pension plafonne à 15 % avec deux parents chroma et l'Œuf Mystère à 2 %. Les valeurs de
   `regions-config.js` (0,001 → 0,025) ressemblent à l'intention initiale (« 2 % au niveau 10 »).
2. **Données mortes dans `regions-config.js`.** `levelBonusScale` (argent ×1 → ×3-4, chroma par région) n'est lu
   par aucun module : l'argent réel vient de `zones-v2-config.js` (+50 % max). La config affiche une
   progression que le jeu n'applique pas.
3. **`zone.tier` n'existe dans aucune donnée de zone.** `agent.js` lit `zone?.tier || 1` pour choisir une
   perte d'énergie de 2 ou 3 : la branche « zone tier 4-5 = −3 » n'est jamais atteinte (toujours −2).
4. **Spec `design-alpha-mechanics.md` périmée.** Elle dit « suppression de l'XP agent », « slots d'équipe selon
   les captures (50/150) » et décrit des zones contestées (`lossStreak`, `contested`). Le code a l'XP
   d'agent, des slots selon le grade, et a supprimé les zones contestées (purge dans `migrateSave.js`).
5. **Rareté de la récompense de combat.** Plafond fixe de 5 000 ₽ alors que le prix d'un agent monte à
   plusieurs millions : l'argent « actif » devient marginal tôt, ce qui pousse vers la vente de Pokémon.
6. **Agents : une défaite ne coûte presque rien.** Pas de perte d'XP ; la seule sanction est la prison
   (1 h, rachetable 200 ₽ × niveau, soit 20 000 ₽ au niveau 100). Faible face à des revenus à plusieurs
   dizaines de milliers par heure.
7. **Joëlle sans dispense.** Les joueurs ayant déjà des Pokémon en pension sans Joëlle voient leur élevage
   suspendu jusqu'à l'achat (décision actée : peu de joueurs concernés).
8. **Incubation : pas d'arbitrage.** Un agent qui couve continue de travailler normalement [à vérifier] ; le
   choix de l'agent (priorité, « préférer disponible ») n'a d'effet que sur la vitesse de ×1,05 à ×1,35.

## 11. Suite proposée

Décisions à prendre : (1) échelle réelle du chroma de zone, (2) supprimer ou brancher `levelBonusScale`,
(3) trancher `zone.tier` (le renseigner ou retirer la branche), (4) mettre à jour ou archiver la spec alpha.
Zones d'ombre restantes pour un prochain passage : détail des quêtes légendaires par région, calibrage
numérique des dresseurs (`trainers-data.js`, `makeTrainerTeam`), raids PvP côté serveur, onboarding V2.

---

## 12. Annexe — chroma : taux mesurés (ajoutée le 5 octobre)

Probabilité de chroma par capture = `(base 0,5 % ou Aura 2,5 %) × Charme (×2) + bonus de zone`. Le bonus de zone
n'existe qu'aux niveaux 7 à 10 (+5 / +10 / +15 / +20 points) et **n'est pas multiplié par le Charme**.

| Niveau de zone | Base | Charme | Aura | Aura + Charme |
|---|---|---|---|---|
| 1 à 6 | 0,5 % | 1,0 % | 2,5 % | 5,0 % |
| 7 | 5,5 % | 6,0 % | 7,5 % | 10,0 % |
| 8 | 10,5 % | 11,0 % | 12,5 % | 15,0 % |
| 9 | 15,5 % | 16,0 % | 17,5 % | 20,0 % |
| 10 | 20,5 % | 21,0 % | 22,5 % | 25,0 % |

Fréquences d'apparition (mesurées sur les données) : zone médiane 0,06 apparition/s (une toutes les ~17 s,
soit ~216/h), de 0,03 à 0,08. Environ 65-70 % des apparitions sont des Pokémon. Un agent en capture auto sur
une seule zone fait donc ≈ 145 captures/h. Niveau 7 de zone = 1 900 XP de zone, soit ≈ 3 h ; niveau 10 =
5 500 XP, soit ≈ 9 h.

Le bonus de vitesse d'apparition des niveaux de zone (+5 % → +50 %) n'est lui non plus pas appliqué : les
minuteurs lisent `zone.spawnRate` sans le bonus, malgré le commentaire du code. Les boosts Leurre / Super
Leurre (×2 / ×3 apparitions) ne sont lus par aucun module d'apparition [à vérifier en jeu].

### Correctif appliqué le 5 octobre (taux de base inchangé)

- Bonus de zone remplacé par l'échelle de la région (`levelBonusScale.shinyBonus`), plafonné à 2,5 points
  (`ZONE_SHINY_BONUS_CAP`) : Kanto 0,1 → 2,0 %, Johto 0,2 → 2,5 %, Hoenn et Sinnoh plafonnés à 2,5 %.
- Le Charme multiplie maintenant le total : `(base ou Aura + bonus de zone) × Charme`.
- Taux obtenus au niveau 10 : Kanto 2,5 % · Johto/Hoenn/Sinnoh 3,0 % (6,0 % avec Charme). Niveaux 1 à 6 : 0,5 %.
  La base (0,5 %), l'Aura (2,5 %) et le Charme (×2) ne changent pas.
- Le bonus de vitesse d'apparition des niveaux de zone (+5 % → +50 %) est appliqué, et le Leurre / Super
  Leurre (×2 / ×3) aussi : apparitions supplémentaires tirées à chaque tick du minuteur
  (`_extraSpawnTicks`, `zoneSystem.js`). Rattrapage hors-ligne : seul le bonus de niveau compte.
- `levelBonusScale.moneyMult` (argent ×1 → ×3 à ×8 selon la région, jamais lu) supprimé : l'argent suit uniquement
  `zones-v2-config.js` (+50 % max).
- Garde-fou : `tools/test-shiny-rates.mjs`.

---

## 13. Quêtes légendaires par région

Modules : `kantoMissions.js` (Oiseaux, Mewtwo), `johtoMissions.js` (Bêtes, Lugia, Ho-Oh), `legendaryMissions.js`
(Groudon/Kyogre, Hoenn), `sinnohMissions.js` (Dialga/Palkia, Giratina, Trio du Lac), `deoxysMission.js`.
Toutes suivent le même patron : une série de **combats de grind** dans des zones dédiées, un ou plusieurs
**dresseurs de quête**, puis un **légendaire qui apparaît comme sprite persistant dans sa zone**. Un clic ouvre un
vrai combat tour par tour (`questCombat.js`, `eventCombat.js`).

### 13.1 Déblocage

| Quête | Seuil de réputation | Autres conditions |
|---|---|---|
| Zapdos / Articuno / Moltres | 700 / 800 / 950 | alignés sur le seuil de leur zone |
| Mewtwo | 900 | — |
| Bêtes Sacrées | 800 | Johto débloqué (1 000 rép) |
| Lugia, Ho-Oh | 1 000 | Johto débloqué |
| Groudon / Kyogre (Magma / Aqua) | 2 500 | Hoenn débloqué (3 500 rép + Ligue + 5 000 PC) |
| Deoxys | 4 000 | Hoenn débloqué + Arène Ever Grande battue |
| Trio du Lac (Uxie, Mesprit, Azelf) | 4 200 | Sinnoh |
| Dialga / Palkia (Galaxie) | 4 500 | Sinnoh |
| Giratina | — | après avoir vaincu Cyrus |

Le seuil de 2 500 de la quête Hoenn est redondant : le déblocage de la région exige déjà 3 500.

### 13.2 Étapes

| Quête | Grind | Dresseurs | Légendaire |
|---|---|---|---|
| Oiseaux (×3, parallèles) | 10 combats dans la zone de l'oiseau | Lorelei / Lt. Surge / Blaine | Articuno Nv 54, Zapdos et Moltres Nv 50 (★3) |
| Mewtwo | 20 Rockets Kanto + 3 Rapports Sylphe + 15 combats au Manoir | Giovanni | Mewtwo Nv 70 (★5) |
| Bêtes Sacrées | 30 Rockets Johto + 15 combats au QG | Petrel, Ariana | une Bête au choix, Nv 60 (★3) |
| Lugia | 20 combats marins + 5 Argent'Ailes + 15 combats aux Îles Tourbillon | Eusine | Lugia Nv 70 (★4) |
| Ho-Oh | 20 combats ruraux + 5 Arcenci'Ailes + 15 combats à la Tour Carillon | Filles Kimono | Ho-Oh Nv 70 (★5) |
| Magma / Aqua | 20 membres + 12 combats au QG | Tabitha → Maxie / Matt → Archie | Groudon / Kyogre Nv 70 (★4) |
| Deoxys | 20 dresseurs Hoenn + 3 Météores + 10 combats au Laboratoire | Directeur du Laboratoire | Deoxys (statMult 1,5) |
| Galaxie | 20 membres + 12 combats au Pilier Axial | Mars + Jupiter, Cyrus | Dialga ou Palkia Nv 72 (★3) |
| Giratina | 10 combats à la Grotte Retour | Saturne | Giratina Nv 72 (★3) |
| Trio du Lac | 8 combats aux Rives du Lac | — | Nv 50 (★2) |

### 13.3 Combat et capture

- Les légendaires sont **boostés** : `statMult` de 1,3 (Trio du Lac) à 1,9 (Mewtwo), 1,5 à 1,6 pour les Bêtes
  et les Oiseaux, 1,7 à 1,8 pour Lugia, Ho-Oh, Groudon, Kyogre et Dialga/Palkia.
- Le joueur peut envoyer des **agents affaiblir** l'adversaire : −22 % (victoire) ou −9 % (défaite) de stats par
  tentative, cumulable jusqu'à −60 %. Une défaite d'agent coûte 3 d'énergie (prison 1 h à zéro).
- Après la victoire du boss, **jet de capture** : `catchBase + 0,5 × affaiblissement`, plafonné à 95 %.
  `catchBase` : 0,50 (Oiseaux, Bêtes), 0,45 (Dialga/Palkia, Lac, Deoxys), 0,42 (Giratina), 0,40 (Groudon/Kyogre),
  0,35 (Lugia), 0,30 (Ho-Oh, Mewtwo). Un échec (« s'échappe ») se rejoue gratuitement, sans objet.
  Ho-Oh et Mewtwo non affaiblis : environ 3 combats gagnés pour une capture ; à −60 %, 60 %.
- **Rejouer** après capture (pour un doublon) consomme un objet : Plume Sacrée (1 % de chance, 5 zones), Rapport
  Sylphe (3 % + 1-5 % sur un Rocket), Cristal Bête (1,5 %), Argent'Aile / Arcenci'Aile (2 % chacune), Sigle Magma
  / Sceau Aqua (1,5 %), Météore (0,5 %).
- Les ailes servent aussi au **Permis Tourbillon / Carillon** (50 pièces chacun) : le besoin total est donc de
  55 ailes de chaque type pour les débloquer toutes.

### 13.4 Écarts constatés

1. **Titres chromatiques inaccessibles [vérifié dans le code].** Les captures de quête forcent `shiny = false`
   dans Kanto, Johto, Hoenn et Deoxys ; seule Sinnoh applique 2 % (`MISSION_REWARD_SHINY_RATE`). Articuno, Zapdos,
   Moltres n'existent dans aucun pool sauvage : leurs titres « Voile de Givre », « Éclair Doré », « Cendres de
   Phénix » et la collection « Triumvirat Céleste » ne peuvent donc pas être obtenus. Mewtwo, Lugia, Ho-Oh, les Bêtes
   et Celebi apparaissent dans des pools de zones spéciales [à confirmer en jeu]. Mew passe par un œuf d'événement
   (1 % de chroma).
2. **Incohérence entre régions :** Sinnoh peut donner un légendaire chromatique, pas les autres.
3. **Légendaires de niveau et de ★ fixes** (Nv 50-72, ★2 à ★5, nature aléatoire) : un légendaire de quête est donc
   souvent inférieur à un ★5 sauvage ; pas de moyen de le « re-roller » sans objet de rejeu.
4. **Les champs `power` (3 500 à 6 000)** sont affichés dans les trackers mais ne bloquent plus rien ; leur
   sens est trompeur pour le joueur.
5. **Choix des Bêtes Sacrées :** le joueur n'en choisit qu'une pour la quête ; les deux autres passent par la zone
   sauvage ou le rejeu (le Cristal Bête relance la Bête déjà choisie). La collection « Maître des Bêtes » dépend
   donc de la chance.
6. **Équilibrage de rejeu :** les objets de rejeu sont rares (0,5 à 3 %), mais rien ne limite le nombre de
   doublons légendaires qu'ils produisent, qui se revendent à un prix de base de 5 000 ₽ × multiplicateur ★.

### 13.5 Décisions proposées

(a) Rendre les chromas de quête possibles (par exemple 2 % partout, comme Sinnoh, ou le taux de base) ou retirer les
titres impossibles ; (b) harmoniser les seuils de réputation ; (c) retirer ou renommer le champ `power` ; (d) décider
si les doublons de légendaires doivent rester vendables.

### 13.6 Correctif appliqué le 5 octobre (taux de chasse inchangé)

Découverte en préparant le correctif : **les objets de quête ne tombaient jamais.** Les événements « objet »
(Argent'Aile, Arcenci'Aile, Météore, Plume Sacrée, Rapport Sylphe de zone, Cristal Bête, Fragment Temporel, Onde
Distorsion, Cristal du Lac) ne figurent pas dans `ACTIVE_EVENT_IDS` (`zoneSystem.js`, seuls 4 événements y sont) et
leur champ `chance` n'est de toute façon jamais lu. Lugia, Ho-Oh et Deoxys, ainsi que les Permis Tourbillon /
Carillon, ne pouvaient donc pas être terminés (seuls le Rapport Sylphe sur un Rocket, et les Sigles Magma/Aqua,
avaient une autre source).

- **Capture garantie** après la victoire (`rollQuestCapture`) : plus de « s'échappe » ni de `catchBase`. L'affaiblissement
  agit désormais sur la qualité.
- **Potentiel en fourchette** (`rollQuestPotential`) : plancher ★3 (le ★ de base s'il est plus haut), plafond ★5.
  Sans affaiblissement 60 / 30 / 10 % ; à −60 % : 30 / 30 / 40 %. Mewtwo, Ho-Oh et Deoxys (★5) restent ★5.
- **Chroma de quête à 2 %** partout (`finalizeQuestPokemon`, comme Sinnoh) ; notification dédiée. Les titres
  chromatiques d'Articuno, Zapdos et Moltres deviennent atteignables. **Le taux de chasse en zone (0,5 %) n'a aucune
  pitié et n'a pas bougé.**
- **Drops d'objets de quête** (`modules/systems/questDrops.js`) : tirés à chaque victoire de combat dans leurs zones,
  avec les `chance` / `minRep` / `zoneIds` des données, et **pitié** (drop garanti au tirage qui suit ⌈1,5 ÷ chance⌉
  ratés : 75 pour les ailes, 150 pour la Plume, 100 pour les Sigles…). La pitié couvre aussi le Rapport Sylphe sur
  Rocket et les Sigles Magma / Aqua. Compteurs dans `state.dropPity` (schéma 21).
- Météore : 0,5 % → 2 % (3 requis pour Deoxys) ; Permis Tourbillon / Carillon : 50 → 15 ailes.
- Garde-fou : `tools/test-quest-rewards.mjs`.
