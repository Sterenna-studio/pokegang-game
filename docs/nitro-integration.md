# Intégration Nitro / Gwen Ha Star

Ce document décrit la stratégie d'intégration entre **PokéGang** et **Nitro**, le hub d'identité partagée des applications Sterenna.

---

## Rôles

### Nitro

Nitro (`nitro.sterenna.fr`) est le hub d'authentification et de profil commun aux applications Sterenna :

- `/` — portail principal
- `/star/` — espace utilisateur Star
- `/shared/` — modules JS partagés (Supabase client, auth, profil, guards…)

Les applications hébergées **sous `/`** (comme Botanica sur `/botanica/`) peuvent partager la session Supabase directement via `localStorage` car elles sont sur le même origine.

### Le dossier `/shared`

Les fichiers suivants sont des **ES modules** exportant des fonctions réutilisables :

| Fichier | Rôle |
|---|---|
| `supabase-client.js` | Exporte l'instance Supabase initialisée (`supabase`) |
| `auth.js` | Helpers auth (getSession, signIn, signOut…) |
| `profile.js` | Lecture/écriture du profil utilisateur |
| `guards.js` | Vérifications de session (redirection si non connecté) |
| `session-ui.js` | Composants UI de session (avatar, menu…) |

---

## Pourquoi PokéGang est différent de Botanica

Botanica est monté sous `nitro.sterenna.fr/botanica/` — même origine que Nitro. La session Supabase stockée dans `localStorage` est partagée automatiquement.

**PokéGang** est hébergé sur `pokegang.sterenna.fr` — **un sous-domaine différent**. Les navigateurs modernes isolent `localStorage` par origine (`scheme + host + port`). Conséquence :

- Un utilisateur connecté à `nitro.sterenna.fr` n'est **pas** automatiquement reconnu par PokéGang.
- `supabase.auth.getSession()` appelé depuis `pokegang.sterenna.fr` lit le localStorage de `pokegang.sterenna.fr`, qui est vide si l'utilisateur s'est connecté uniquement sur `nitro.sterenna.fr`.

---

## Limites du partage automatique de session

| Contexte | Partage automatique ? |
|---|---|
| Botanica (`nitro.sterenna.fr/botanica/`) | ✅ Oui — même origine |
| PokéGang (`pokegang.sterenna.fr`) | ❌ Non — origins différentes |
| Cookie de session (httpOnly, domain=`.sterenna.fr`) | ✅ Possible — nécessite backend Nitro |
| SSO via token URL (`?token=...`) | ✅ Possible — à implémenter |
| `postMessage` cross-origin | ✅ Possible — nécessite iframe Nitro |

La couche d'intégration actuelle (bridge Nitro) prépare le terrain pour ces mécanismes sans les implémenter.

---

## Architecture du bridge (état actuel)

```
modules/nitro/
  nitro-supabase.js   — charge le client Supabase depuis /shared/supabase-client.js
  nitro-auth.js       — session/user, redirect login
  nitro-profile.js    — profil utilisateur (shared module ou token metadata)
  nitro-bridge.js     — état centralisé + fonctions de liaison de compte
```

### Flux d'initialisation

```
renderCompteTab()
  └─ _appendNitroSection(tab)
       └─ initNitroBridge()
            ├─ getNitroSupabase()          ← dynamic import depuis nitro.sterenna.fr
            ├─ getNitroUser()              ← supabase.auth.getSession()
            └─ getNitroProfile()           ← shared/profile.js ou token metadata
```

### États possibles

| État | Description | UI |
|---|---|---|
| `available: false` | Module partagé inaccessible (CORS, réseau) | Message discret |
| `available: true, connected: false` | Module OK mais session vide sur ce domaine | Bouton de connexion |
| `available: true, connected: true` | Utilisateur Nitro détecté | Pseudo + lien Star |

---

## Tables Supabase à créer

Ces tables ne sont pas encore créées. Les fonctions de liaison échouent proprement si elles n'existent pas.

### `pokegang_account_links`

Lien entre un compte Nitro et un profil PokéGang.

```sql
create table pokegang_account_links (
  id               uuid primary key default gen_random_uuid(),
  nitro_user_id    uuid not null references auth.users(id) on delete cascade,
  pokegang_profile_id  text,          -- identifiant interne PokéGang (ex: gang name + lbToken)
  save_slot        text default 'v6', -- 'v6' | 'v6.s2' | 'v6.s3'
  linked_at        timestamptz default now(),
  last_sync_at     timestamptz,

  unique (nitro_user_id, save_slot)
);

-- RLS : l'utilisateur ne peut lire/modifier que son propre lien
alter table pokegang_account_links enable row level security;

create policy "own link" on pokegang_account_links
  using (auth.uid() = nitro_user_id)
  with check (auth.uid() = nitro_user_id);
```

### `pokegang_cloud_saves`

Sauvegarde cloud liée à un compte Nitro (alternative ou complément à `pokegang_saves`).

```sql
create table pokegang_cloud_saves (
  id            uuid primary key default gen_random_uuid(),
  nitro_user_id uuid not null references auth.users(id) on delete cascade,
  save_slot     text default 'v6',
  state         jsonb not null,
  saved_at      timestamptz default now(),
  schema_ver    int,

  unique (nitro_user_id, save_slot)
);

alter table pokegang_cloud_saves enable row level security;

create policy "own save" on pokegang_cloud_saves
  using (auth.uid() = nitro_user_id)
  with check (auth.uid() = nitro_user_id);
```

### `pokegang_rewards`

Récompenses liées à l'identité Nitro (succès, items débloqués via Star…).

```sql
create table pokegang_rewards (
  id            uuid primary key default gen_random_uuid(),
  nitro_user_id uuid not null references auth.users(id) on delete cascade,
  reward_key    text not null,      -- ex: 'star_badge', 'early_adopter'
  granted_at    timestamptz default now(),
  metadata      jsonb,

  unique (nitro_user_id, reward_key)
);

alter table pokegang_rewards enable row level security;

create policy "own rewards" on pokegang_rewards
  using (auth.uid() = nitro_user_id);
```

---

## Prochaines étapes

1. **SSO token** — Nitro génère un short-lived token après connexion et redirige vers `pokegang.sterenna.fr?nitro_token=...`. PokéGang l'échange contre une session Supabase.
2. **Liaison DB** — activer `linkCurrentSaveToNitro()` avec écriture dans `pokegang_account_links`.
3. **Cloud save Nitro** — utiliser `pokegang_cloud_saves` comme couche de sauvegarde alternative synchronisée avec l'identité Nitro.
4. **Récompenses cross-app** — débloquer des items PokéGang en fonction du niveau Star.

---

## Sécurité

- Ne jamais commiter `config.js`, `.env`, `service_role` key, JWT secret, ou database password.
- La clé `anon` Supabase peut être publique côté front, mais doit idéalement venir des modules Nitro shared (déjà dans `supabase-client.js`), pas être dupliquée dans PokéGang.
- Toutes les tables doivent avoir RLS activé avec des politiques `auth.uid() = user_id`.
