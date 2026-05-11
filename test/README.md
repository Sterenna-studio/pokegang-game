# Pokegang UI prototypes — red/black direction

Ce dossier contient plusieurs directions de proto UI inspirées par la densité et la lisibilité de certains dashboards de jeux navigateur, mais réinterprétées pour Pokegang.

## Objectif

- explorer plusieurs hiérarchies visuelles sans copier une UI existante
- rester aligné avec les besoins réels de Pokegang : zones, agents, marché, PC, gang, missions, logs
- tester une DA Pokegang rouge / noir / centre de commandement criminel
- préparer une future intégration progressive dans le jeu réel

## Fichiers

- `proto-direction-1-command-center.html`
  - sidebar gauche + centre opérationnel + panneau de logs/agents à droite
  - vision la plus équilibrée et la plus proche d'un dashboard de jeu exploitable

- `proto-direction-2-dense-dashboard.html`
  - version plus compacte, plus "gestion" et plus chiffrée
  - bonne base si Pokegang assume davantage l'idle manager

- `proto-direction-3-terminal-warfare.html`
  - vision plus radicale, plus rouge/noir, plus QG/guerre de territoire
  - utile pour pousser l'identité visuelle et la fantasy gang

- `static-ui-proto.html`
  - synthèse plus jouable / crédible
  - version desktop-first pensée comme proto de direction principale

- `proto.css`
  - base visuelle partagée

## Notes

Les protos restent statiques et n'essaient pas de brancher le runtime actuel. En revanche ils réutilisent :

- le vocabulaire réel du jeu (`Zones`, `PC`, `Agents`, `Marché`, `Gang`, `Missions`, `Évts`, `Compte`)
- la logique d'un top bar avec argent / réputation / captures / zones
- l'idée de zones actives, agents assignés, logs, alertes, boss, occupation et progression

## Ce qu'il faut observer

- lisibilité globale
- vitesse de lecture
- sensation de contrôle territorial
- clarté des métriques importantes
- place du feed / log / alertes
- capacité de l'UI à supporter le vrai gameplay de Pokegang
