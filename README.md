# Paleto Garage — Registre interne

Site de gestion pour remplacer le tableur : registre global, fiches employés
avec facturation en direct, charges, primes et partenaires. Connexion via
Discord, données synchronisées en temps réel entre tous les utilisateurs
connectés (Supabase Realtime).

## 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New project** (gratuit).
2. Une fois créé, ouvre **SQL Editor** → colle le contenu de `sql/schema.sql`
   → **Run**. Ça crée toutes les tables, vues, sécurités (RLS) et les grades
   de départ.
3. Va dans **Project Settings → API** : note l'**URL** et la clé
   **anon public**, tu en auras besoin à l'étape 3.

## 2. Configurer la connexion Discord

1. Va sur le [portail développeur Discord](https://discord.com/developers/applications)
   → **New Application** → nomme-la "Paleto Garage".
2. Onglet **OAuth2** → note le **Client ID** et le **Client Secret**.
3. Dans Supabase : **Authentication → Providers → Discord** → active-le,
   colle le Client ID / Secret.
4. Supabase t'affiche une **Redirect URL** (du type
   `https://xxxxx.supabase.co/auth/v1/callback`) : copie-la dans Discord,
   onglet OAuth2 → **Redirects**.

## 3. Lancer le site en local

```bash
cp .env.local.example .env.local
# remplis NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) → connecte-toi avec
Discord. Une fiche employé est créée automatiquement à la première
connexion, avec le rôle `employe` (accès limité).

## 4. Nommer le premier compte "Direction"

Par sécurité, **aucun compte n'a accès au registre par défaut** — même après
connexion Discord réussie. Tant qu'un compte n'est pas validé par la
Direction, il atterrit sur un écran "en attente" et ne voit aucune donnée
(RLS appliquée côté base de données, pas juste côté site).

Pour débloquer le tout premier compte (le tien) :

1. Connecte-toi une première fois avec Discord sur le site (tu tomberas sur
   l'écran "en attente", c'est normal).
2. Dans Supabase → **SQL Editor**, lance :
   ```sql
   update profiles
   set role = 'direction', valide = true,
       grade_id = (select id from grades where nom = 'Patron')
   where discord_username = 'TonPseudoDiscord';
   ```
3. Recharge le site : tu as maintenant tous les droits.

Ensuite, **tu n'as plus jamais besoin de retoucher à Supabase directement** :
chaque nouvelle personne qui se connecte avec Discord apparaît dans une file
**"Comptes en attente de validation"** en haut de la page **Employés**. Tu
choisis son grade et cliques sur **Valider** (ou **Refuser** pour supprimer
la demande) — c'est ce qui empêche n'importe qui de se créer un accès juste
en se connectant avec Discord.

## 5. Mettre le site en ligne (Vercel)

1. Pousse ce dossier sur un dépôt GitHub.
2. Sur [vercel.com](https://vercel.com) → **New Project** → importe le repo.
3. Ajoute les mêmes variables d'environnement que dans `.env.local`.
4. Déploie. Une fois en ligne, ajoute l'URL Vercel dans Discord (OAuth2 →
   Redirects) et dans Supabase (**Authentication → URL Configuration →
   Redirect URLs**), au format `https://ton-site.vercel.app/auth/callback`.

## Structure des rôles

| Rôle        | Accès |
|-------------|-------|
| `direction` | Tout voir et modifier (grades, employés, charges, primes, partenaires) |
| `cadre`     | Facturer pour l'équipe, ajouter des charges/contrats |
| `employe`   | Voir le registre, facturer sur sa propre fiche |

## Ajuster à ton fonctionnement réel

- **Grades et pourcentages** : table `grades` dans Supabase, ou directement
  depuis le site (Direction uniquement, à venir dans une page dédiée —
  pour l'instant, modifiable via le Table Editor Supabase).
- **Prix des prestations** (Déplacement, Chaîne, Réparation...) : table
  `services`.
- **Formules du registre global** (C.A Répa/Net, Coût réel Customs...) :
  vue `v_dashboard` dans `sql/schema.sql`. J'ai reconstitué la logique à
  partir de tes captures d'écran, dis-moi si un calcul ne correspond pas
  exactement à ta compta actuelle et je l'ajuste.

## Nouvelles pages

- **Administration** (`/admin`, Direction uniquement) : modifier les grades
  (salaires fixes ou %), les prestations facturables (prix, catégorie) et
  les partenaires, directement depuis le site — plus besoin de Supabase au
  quotidien.
- **Contrats** (`/contrats`) : upload de vrais fichiers (PDF, image...) liés
  à un employé ou un partenaire, stockés dans Supabase Storage. Un panneau
  dédié apparaît aussi directement sur la fiche de chaque employé. Lecture
  pour tous les comptes validés, ajout pour cadre/direction, suppression
  pour la Direction.
- **Historique** (`/historique`) : la Direction peut "clôturer" une période
  (semaine ou mois) pour garder une photo des totaux du registre à ce
  moment-là, et comparer dans le temps. Boutons d'export CSV pour les
  employés, factures et charges (avec filtre par date).

Si tu avais déjà exécuté `sql/schema.sql` avant cette mise à jour, lance en
plus **`sql/migration_02_historique_contrats.sql`** puis
**`sql/migration_03_realtime.sql`** dans le SQL Editor Supabase (une seule
fois chacun) — le premier ajoute l'historique et le stockage des contrats,
le second **active le temps réel** (sans lui, les compteurs ne
s'actualisent pas en direct entre plusieurs utilisateurs, même si le code
du site est correct).

## Facturation "Montant Custom"

Le formulaire reprend la logique de ton ancien tableur : **prix du panier
Customs → % de remise → prix à facturer**, calculé automatiquement. La
remise peut venir d'un partenaire sous contrat (menu déroulant, alimenté
par la remise enregistrée sur la page Partenaires/Admin) ou être saisie
librement pour une promo ponctuelle. C'est ce montant final, déjà remisé,
qui est enregistré comme facture.

Chaque ligne de l'historique de facturation (sur la fiche employé) a
maintenant un bouton de suppression individuel — utile si un employé s'est
trompé et doit refaire une facture, sans devoir annuler tout ce qui a été
saisi après.

## Ce qui reste à affiner avec toi

Dis-moi ce qui doit être précisé ou ajouté en priorité — par exemple des
graphiques d'évolution sur la page Historique, ou une vue "par employé" des
contrats sur la page Contrats.
