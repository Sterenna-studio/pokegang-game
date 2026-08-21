# Tester une branche sans toucher à la production

Deux previews distantes sont hébergées dans des répertoires séparés de
`~/pokegang`, la racine de production :

- web FR : <https://lab.sterenna.fr/pokegang-preview/>
- artefact itch EN : <https://lab.sterenna.fr/pokegang-itch-preview/>

Les deux dossiers ont un cache HTTP désactivé et une directive `noindex`. Ils
n'altèrent ni `pokegang.sterenna.fr`, ni sa sauvegarde navigateur. Les deux
previews partagent toutefois l'origine `lab.sterenna.fr` et donc son
`localStorage` : utiliser deux profils QA distincts, ou effacer les données du
site avant de passer de l'une à l'autre.

## Publier la branche courante

Depuis PowerShell :

```powershell
# Les deux variantes
.\tools\deploy-ovh-previews.ps1

# Une seule variante
.\tools\deploy-ovh-previews.ps1 -Target web
.\tools\deploy-ovh-previews.ps1 -Target itch
```

Le script transfère uniquement les huit entrées runtime. La variante itch est
toujours reconstruite avec `tools/build-itch.js` avant son transfert : anglais
par défaut, aucun `config.js`, puis validation du ZIP livré.

## Parcours QA minimal

1. Ouvrir la preview dans un profil navigateur QA vierge.
2. Confirmer FR sur la web et EN sur la variante itch.
3. Jouer l'onboarding complet sans fixture.
4. Recharger à chaque jalon important pour vérifier la reprise.
5. Refaire le parcours en vue mobile et avec un réseau ralenti.
6. Vérifier la console, les 404 et les requêtes GA4 attendues.

La preview web ne récupère volontairement pas les identifiants Supabase de
production : Nitro n'autorise actuellement que l'origine
`pokegang.sterenna.fr`. Pour tester le cloud, utiliser ultérieurement un projet
Supabase de staging plutôt que les données réelles.

## Dernier contrôle itch.io

La preview OVH valide exactement le contenu de `dist-itch/`, mais son hostname
reste `lab.sterenna.fr`. Elle ne reproduit donc pas le CDN, le hostname et
l'iframe d'itch.io. Avant publication publique :

1. créer une page itch.io QA séparée et privée ;
2. y envoyer `dist-itch.zip` comme build HTML jouable dans le navigateur ;
3. conserver la page privée pendant le test de l'iframe desktop/mobile ;
4. publier le même ZIP validé sur la page publique, sans le reconstruire.

Un canal Butler sur le projet public n'est pas utilisé pour ce test : une page
QA séparée évite qu'un upload de validation devienne immédiatement accessible
aux joueurs.
