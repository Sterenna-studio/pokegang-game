# Runbook — Déploiement du durcissement leaderboard PokéGang

**Contexte :** le commit `62d4303` route les écritures du leaderboard via une Edge
Function (`pokegang-leaderboard-submit`) et révoque l'écriture directe. Le code est
sur `main` mais **inactif** tant que ces étapes ne sont pas exécutées.
**L'ordre est critique** : déployer la fonction AVANT de révoquer la RLS.

Fichiers concernés :
- `supabase/functions/pokegang-leaderboard-submit/index.ts` — la fonction
- `docs/supabase-schema.sql` — migration RLS (révocation des écritures directes)
- `supabase/config.toml` — `verify_jwt = false` pour cette fonction
- `modules/systems/cloudAccount.js` — client : POST vers la fonction

---

## Pré-requis

```bash
supabase --version                          # CLI installée
supabase login                              # si pas déjà fait
supabase link --project-ref <PROJECT_REF>   # lie le repo au projet
```

> `<PROJECT_REF>` = l'ID du projet, visible dans l'URL du dashboard :
> `https://supabase.com/dashboard/project/<PROJECT_REF>`

**Aucun secret à configurer.** La fonction lit `SUPABASE_URL`, `SUPABASE_ANON_KEY`
et `SUPABASE_SERVICE_ROLE_KEY` — ces trois variables sont **injectées
automatiquement** par la plateforme dans toute Edge Function. Ne pas les redéfinir.

---

## Étape 1 — Déployer la fonction (EN PREMIER)

```bash
supabase functions deploy pokegang-leaderboard-submit
supabase functions list      # vérifier qu'elle apparaît
```

`verify_jwt` est à `false` (défini dans `supabase/config.toml`) pour autoriser les
joueurs anonymes à soumettre leur score.

---

## Étape 2 — Tester la fonction AVANT de toucher la RLS

Tant que l'écriture directe est encore ouverte, on vérifie que la fonction écrit et
assainit correctement. Remplacer `<PROJECT_REF>` et `<ANON_KEY>` :

```bash
curl -i -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/pokegang-leaderboard-submit" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test_runbook_001",
    "gang_name": "XSS<img src=x onerror=alert(1)>Test",
    "boss_name": "Boss <script>alert(1)</script>",
    "boss_sprite": "red",
    "reputation": 12345,
    "dex_kanto_count": 999,
    "total_caught": 50
  }'
```

**Attendu :** `HTTP 200` + `{"ok":true,...}`.

Contrôler la ligne stockée (SQL Editor du dashboard) :

```sql
select token, gang_name, boss_name, boss_sprite, reputation, dex_kanto_count, is_anonymous
from public.pokegang_leaderboard
where token = 'test_runbook_001';
```

Validation de l'assainissement :

| Champ | Valeur attendue | Raison |
|---|---|---|
| `gang_name` | `XSSTest` | `<...>` retirés, tronqué 24c — **pas** de balise |
| `boss_name` | `Boss alert(1)` | balises retirées |
| `dex_kanto_count` | `151` | plafonné (pas 999) |
| `is_anonymous` | `true` | appel sans vrai JWT utilisateur |

Nettoyer la ligne de test si tout est bon :

```sql
delete from public.pokegang_leaderboard where token = 'test_runbook_001';
```

---

## Étape 3 — Appliquer la migration RLS (révoque l'écriture directe)

Exécuter **l'intégralité** de `docs/supabase-schema.sql` dans le **SQL Editor** du
dashboard (le fichier est idempotent — sûr à rejouer). La partie qui durcit le
leaderboard :

```sql
drop policy if exists "leaderboard_insert_public" on public.pokegang_leaderboard;
drop policy if exists "leaderboard_update_public" on public.pokegang_leaderboard;

revoke insert, update, delete on public.pokegang_leaderboard from anon, authenticated;
```

La policy `leaderboard_read_public` (lecture) est conservée. Le service role de la
fonction bypass la RLS — aucune policy d'écriture n'est nécessaire.

---

## Étape 4 — Vérifier que l'écriture directe est bloquée

Tenter une écriture directe en tant qu'anon (doit **échouer**) :

```bash
curl -i -X POST \
  "https://<PROJECT_REF>.supabase.co/rest/v1/pokegang_leaderboard" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{"token":"hack_direct_001","gang_name":"<img src=x onerror=alert(1)>","reputation":999999999}'
```

**Attendu :** `HTTP 401` ou `403`. **Surtout pas** `201`.

Re-tester la fonction (Étape 2) → doit **toujours** renvoyer `200`.
Vérifier que la lecture publique marche encore :

```bash
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/pokegang_leaderboard?select=gang_name,reputation&limit=3" \
  -H "apikey: <ANON_KEY>"
```

→ `HTTP 200` avec les lignes.

---

## Étape 5 — Validation in-game

Ouvrir le jeu, onglet **Classement** :
- une nouvelle ligne apparaît après quelques secondes (push throttlé à 1×/h, mais un
  changement de stats force le push) ;
- aucun nom n'exécute de script ; un nom contenant `<b>` s'affiche en texte brut.

---

## Récap des résultats attendus

| Test | Commande | Attendu |
|---|---|---|
| Fonction écrit | POST `/functions/v1/pokegang-leaderboard-submit` | `200 {"ok":true}` |
| Assainissement | `select` après POST | balises retirées, dex ≤ 151/493 |
| Écriture directe bloquée | POST `/rest/v1/pokegang_leaderboard` | `401/403` |
| Lecture publique OK | GET `/rest/v1/pokegang_leaderboard` | `200` + lignes |

---

## Rollback (si besoin)

Réautoriser temporairement l'écriture directe :

```sql
grant insert, update on public.pokegang_leaderboard to anon, authenticated;
create policy "leaderboard_insert_public" on public.pokegang_leaderboard
  for insert to anon, authenticated with check (true);
create policy "leaderboard_update_public" on public.pokegang_leaderboard
  for update to anon, authenticated using (true) with check (true);
```

> ⚠️ Le rollback réouvre le vecteur de pollution/XSS — à n'utiliser que le temps de
> diagnostiquer un problème de déploiement de la fonction.

---

## Points de vigilance

1. **Ne jamais lancer l'Étape 3 avant que l'Étape 2 soit verte.** Si la RLS est
   révoquée alors que la fonction n'écrit pas correctement, le leaderboard cesse de
   se mettre à jour (échec silencieux côté client, `catch` muet).
2. **Périmètre.** Ce durcissement neutralise le XSS stocké, borne les valeurs
   aberrantes et empêche l'usurpation de la ligne d'un autre compte authentifié. Ce
   **n'est pas** un anti-cheat de score complet : le jeu est 100% client, un client
   déterminé peut toujours rapporter des stats gonflées mais bien formées. Une
   vérification réelle des scores nécessiterait de déplacer la logique de jeu côté
   serveur.
