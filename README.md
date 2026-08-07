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


## Système de permissions (par grade)

Les droits ne dépendent plus de 3 catégories génériques mais du **grade
réel** de la personne. Quand la Direction valide un compte (ou change son
grade depuis la page Employés), le niveau d'accès est déduit automatiquement :

| Grade | Accès |
|---|---|
| **Patron / Co-Patron** | Tout, y compris Administration |
| **DRH** | Accès de base (registre, employés) + création/suppression des **contrats** |
| **Gérant** | Accès de base + gestion des **partenaires** et des **charges** (ajout/suppression) |
| **Chef d'équipe** | Accès de base + les fiches de **tous les mécanos** (en plus de la sienne) |
| **Mécano** (tous niveaux) | **Uniquement sa propre fiche** — aucun accès au reste du site |
| **Gouv** *(compte externe, à valider via la case "Compte Gouv")* | **Uniquement le total des dépenses**, rien d'autre |

Ces règles sont appliquées **au niveau de la base de données** (RLS), pas
seulement sur les pages du site — même une requête directe à l'API ne peut
pas les contourner.

⚠️ **Étape obligatoire** : lance **`sql/migration_04_permissions_banque.sql`**
dans le SQL Editor Supabase (une seule fois) pour activer tout ça — en plus
des migrations précédentes si tu ne les avais pas encore lancées :
`migration_02_historique_contrats.sql`, puis `migration_03_realtime.sql`,
puis `migration_04_permissions_banque.sql`, puis
`migration_05_security_hardening.sql`, puis `migration_06_acces_avances.sql`,
puis `migration_07_correctifs_registre.sql`, dans cet ordre.

## Correctifs registre global / primes / tri employés

- **Bug "0 employé(s)" corrigé** : le registre global renvoyait 0 partout
  tant qu'aucune facture n'existait, à cause d'une jointure mal placée
  dans le calcul. Réparé — le nombre d'employés, les salaires et le
  bénéfice net s'affichent maintenant correctement dès la première
  connexion, même sans aucune facture.
- Retiré la case "Primes versées" du registre global (gardé uniquement
  "Prime prévue cette semaine").
- Simplifié l'onglet **Primes** : plus de "montant versé" à saisir, juste
  le montant maximum de chaque semaine, calculé automatiquement.
- La page **Employés** trie maintenant par grade (même ordre que la page
  Administration), plutôt que par ordre alphabétique.

## Mise à jour : accès élargis, transfert, primes auto, logs

**Permissions**
- **Mécano** : voit maintenant aussi le Registre global et les Partenaires
  (lecture seule), en plus de sa fiche.
- **Chef d'équipe** : voit tout le monde dans la liste Employés, mais ne
  peut ouvrir que sa propre fiche et celles des Mécanos (stagiaire,
  mécano, confirmé).

**Transfert de facture** : sur la fiche employé, chaque ligne de
l'historique a un bouton ⇄ pour transférer cette facture à quelqu'un
d'autre (utile si deux employés se partagent un même client).

**Primes automatiques** : la page Primes affiche désormais tout seule les
dimanches du mois en cours (75 000$, 175 000$ le dernier), sans jamais
avoir besoin de créer une ligne à la main. La Direction peut éditer le
montant versé pour chaque semaine.

**Registre global** :
- Case "Charges" = somme de Kits/Nourriture + Matières premières +
  Publicité + Autre, mise à jour automatiquement.
- Les Impôts sont sortis de cette case (affichés à part), mais restent
  déduits du bénéfice net.
- Le salaire d'un employé **absent** n'est plus compté dans le bénéfice
  net (ni dans le total des dépenses affiché à la page Gouv).
- Nouvelle case "Prime prévue cette semaine".
- Top 3 C.A Global, visible par la Direction.

**Logs** (`/logs`, Direction uniquement) : historique en direct de toutes
les créations/modifications/suppressions sur le site (fiches, factures,
charges, primes, partenaires, contrats, banque...), avec le nom de la
personne responsable.

**Responsive** : le menu latéral devient un menu mobile (☰) sur petit
écran.

**Temps réel étendu** : Registre global, Employés, Charges, Partenaires,
Primes, Banque et Logs se mettent maintenant à jour en direct pour tout le
monde connecté, comme c'était déjà le cas sur la fiche employé.

### Un point à vérifier avec toi

Dans l'onglet Charges, j'ai retiré "Impôts" de la liste des catégories
qu'on peut choisir en ajoutant une charge (ta demande), mais je n'ai pas
supprimé la catégorie elle-même — les impôts déjà enregistrés restent
visibles et continuent d'être déduits du bénéfice net. Dis-moi si tu
veux gérer les impôts autrement (une page dédiée, par exemple).

`migration_05` corrige des avertissements du "linter" de sécurité intégré
à Supabase (Database → Advisors) : le `search_path` des fonctions n'était
pas figé, et certaines fonctions internes étaient inutilement exposées en
API publique. Aucun impact sur le fonctionnement du site, c'est du
durcissement pur.

Un dernier point signalé par ce linter n'est pas un fichier SQL mais un
réglage à activer toi-même dans Supabase : **Authentication → Sign In /
Providers → Password → active "Leaked password protection"**. On ne s'en
sert pas directement (connexion Discord uniquement), mais c'est gratuit et
recommandé de le laisser activé.

Cette dernière migration corrige aussi un bug de sécurité présent depuis le
début : les vues du registre (`v_employees_full`, `v_dashboard`...)
contournaient les règles d'accès et laissaient techniquement n'importe quel
compte validé tout voir. C'est réparé.

## Ajuster à ton fonctionnement réel

- **Grades et pourcentages** : page **Administration** (Direction), ou
  directement table `grades` dans Supabase.
- **Prix des prestations** (Déplacement, Chaîne, Réparation...) : page
  Administration, ou table `services`.
- **Formules du registre global** (C.A Répa/Net, Coût réel Customs...) :
  vue `v_dashboard` dans `sql/schema.sql`. Dis-moi si un calcul ne
  correspond pas exactement à ta compta actuelle et je l'ajuste.

## Pages du site

- **Registre global** (`/dashboard`) : C.A, charges, bénéfice net.
- **Employés** (`/employes`) : liste, validation des nouveaux comptes,
  changement de grade.
- **Partenaires** (`/partenaires`) : remises et avantages, éditable par
  Direction/Gérant.
- **Contrats** (`/contrats`) : upload de vrais fichiers liés à un employé
  ou un partenaire (Supabase Storage), éditable par Direction/DRH. Chacun
  voit aussi son propre contrat directement sur sa fiche.
- **Charges** (`/charges`) : ajout et suppression, réservés à
  Direction/Gérant.
- **Primes** (`/primes`) : suivi de l'enveloppe hebdomadaire.
- **Banque** (`/banque`) : solde de l'entreprise, dépôts/retraits (ajout
  réservé à la Direction).
- **Historique** (`/historique`) : clôtures de période + exports CSV.
- **Administration** (`/admin`, Direction uniquement) : grades, prestations
  facturables, partenaires.
- **Dépenses totales** (`/gouv`) : page minimaliste pour les comptes
  externes (LSPD, Gouvernement...), un seul chiffre.

## Facturation "Montant Custom"

Le formulaire reprend la logique de ton ancien tableur : **prix du panier
Customs → % de remise → prix à facturer**, calculé automatiquement. La
remise peut venir d'un partenaire sous contrat (menu déroulant) ou être
saisie librement pour une promo ponctuelle. C'est ce montant final, déjà
remisé, qui est enregistré comme facture.

Chaque ligne de l'historique de facturation (sur la fiche employé) a un
bouton de suppression individuel — utile si un employé s'est trompé et doit
refaire une facture.

## Ce qui reste à affiner avec toi

Dis-moi ce qui doit être précisé ou ajouté en priorité.
