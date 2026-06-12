# Widget Kanban — LaSuite.coop

![Version](https://img.shields.io/badge/version-1.0.0-271B79?style=for-the-badge)
![Grist](https://img.shields.io/badge/Built%20for-Grist-16B7C7?style=for-the-badge)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Online-B9FFB7?style=for-the-badge&logo=github&logoColor=black)
![Langue](https://img.shields.io/badge/Langue-FR%20%7C%20EN-271B79?style=for-the-badge)

> Un widget Kanban visuel et personnalisable pour **Grist**, aux couleurs de **LaSuite.coop**.
> Glissez-déposez vos cartes, filtrez par statut ou priorité, et adaptez l'affichage à votre table — sans toucher au code.

---

## 🇫🇷 Version française

---

## Table des matières

1. [C'est quoi ce widget ?](#1-cest-quoi-ce-widget-)
2. [Ce que vous pouvez faire](#2-ce-que-vous-pouvez-faire)
3. [Ce dont vous avez besoin avant de commencer](#3-ce-dont-vous-avez-besoin-avant-de-commencer)
4. [Préparer votre table Grist](#4-préparer-votre-table-grist)
5. [Déployer le widget sur GitHub Pages](#5-déployer-le-widget-sur-github-pages)
6. [Installer le widget dans Grist](#6-installer-le-widget-dans-grist)
7. [Utiliser les filtres](#7-utiliser-les-filtres)
8. [Configurer les rôles utilisateurs](#8-configurer-les-rôles-utilisateurs)
9. [Mettre à jour le widget](#9-mettre-à-jour-le-widget)
10. [Problèmes fréquents](#10-problèmes-fréquents)
11. [Questions fréquentes](#11-questions-fréquentes)
12. [Structure des fichiers](#12-structure-des-fichiers)
13. [Crédits](#13-crédits)

---

## 1. C'est quoi ce widget ?

Un **widget Kanban** est un tableau visuel avec des colonnes et des cartes qu'on peut déplacer de colonne en colonne par glisser-déposer. Pensez à Trello ou à un tableau de post-its physique.

Ce widget s'installe dans **Grist** (le tableur de LaSuite.coop) et se connecte directement à vos données. Quand vous déplacez une carte, la valeur change automatiquement dans votre table Grist.

**La particularité de ce widget :**
- Il s'adapte à **n'importe quelle table** Grist — pas besoin de modifier le code
- Les colonnes Kanban se créent automatiquement depuis vos colonnes de type *Choice*
- Tout ce que vous voulez changer (titres, couleurs, colonnes) se modifie **directement dans Grist**, sans toucher au code

---

## 2. Ce que vous pouvez faire

| Fonctionnalité | Description |
|---|---|
| 🃏 **Cartes** | Chaque ligne de votre table devient une carte |
| ↔️ **Glisser-déposer** | Déplacez une carte pour changer son statut |
| 🏷️ **Badge priorité** | Urgent / High / Medium / Low affiché sur chaque carte |
| 👤 **Avatar** | Initiales de la personne assignée avec couleur unique |
| 📅 **Date automatique** | La date se remplit quand vous déplacez une carte |
| 🔽 **Colonnes réductibles** | Cliquez sur ⇄ pour réduire une colonne |
| 🔍 **Choisir la source** | Choisissez quelle colonne Choice crée les colonnes Kanban |
| 👥 **Regrouper par** | Regroupez les cartes par une 2e colonne (ex: par priorité) |
| 👁️ **Afficher/masquer colonnes** | Masquez les colonnes que vous ne voulez pas voir |
| 📋 **Afficher/masquer champs** | Choisissez quels champs apparaissent sur les cartes |
| 📆 **Filtre date** | Masquez les cartes dont la date est passée |
| 🔒 **Rôles** | Admin et Responsable peuvent créer/supprimer — pas les Testeurs |
| 🗑️ **Supprimer une carte** | Menu ··· sur la carte → Supprimer |

---

## 3. Ce dont vous avez besoin avant de commencer

- ✅ Un compte **Grist** (sur [grist.lasuite.coop](https://grist.lasuite.coop) ou autre instance)
- ✅ Un compte **GitHub** gratuit ([github.com](https://github.com))
- ✅ Les 5 fichiers du widget (dans ce dossier)

> **Pas de compétences techniques requises.** Ce guide suppose que vous ne savez pas coder.

---

## 4. Préparer votre table Grist

Le widget fonctionne avec **n'importe quelle table**, mais elle doit contenir **au minimum une colonne de type Choice**. C'est cette colonne qui crée les colonnes du Kanban.

### Structure minimale recommandée

| Colonne | Type dans Grist | Obligatoire ? | Rôle |
|---|---|---|---|
| `Titre` ou `Nom` | Texte | ✅ Oui | Texte affiché en titre de carte |
| `Statut` | **Choice** | ✅ Oui | Crée les colonnes du Kanban |
| `Priorite` | Choice | ⬜ Optionnel | Badge coloré Urgent/High/Medium/Low |
| `Testeur` ou `Assigné` | Référence ou Texte | ⬜ Optionnel | Avatar initiales en bas de carte |
| `Date_en_cours` | DateTime | ⬜ Optionnel | Se remplit au glisser-déposer |
| `Date_termine` | DateTime | ⬜ Optionnel | Se remplit au glisser-déposer |
| `Date_archive` | DateTime | ⬜ Optionnel | Se remplit au glisser-déposer |
| `Date_annule` | DateTime | ⬜ Optionnel | Se remplit au glisser-déposer |

### Configurer la colonne Statut

1. Cliquez sur l'en-tête de la colonne `Statut`
2. Dans le panneau de droite, vérifiez que le type est **Choix** (Choice)
3. Ajoutez vos valeurs — par exemple : `À tester`, `En cours`, `Terminé`, `Archivé`, `Annulé`
4. Attribuez des couleurs à chaque valeur → elles apparaîtront comme couleur de colonne dans le Kanban

> 💡 Pour un projet générique : `Backlog`, `À faire`, `En cours`, `Review`, `Terminé`

### Configurer la colonne Priorite (optionnel)

Créez une colonne **Choice** nommée `Priorite` avec ces valeurs **exactes** (respectez la casse) :
`Urgent` · `High` · `Medium` · `Low`

### Configurer les dates automatiques (optionnel)

Les colonnes de dates suivantes se remplissent **automatiquement** quand une carte est déplacée dans la colonne correspondante.

> ⚠️ Les noms doivent être écrits **exactement** comme ci-dessous :

| Nom de la colonne | Se remplit quand la carte arrive dans... |
|---|---|
| `Date_en_cours` | la colonne `En cours` |
| `Date_termine` | la colonne `Terminé` |
| `Date_archive` | la colonne `Archivé` |
| `Date_annule` | la colonne `Annulé` |

> 💡 Si vos statuts ont des noms différents, la date ne se remplira pas automatiquement mais vous pouvez la saisir manuellement.

---

## 5. Déployer le widget sur GitHub Pages

Le widget doit être hébergé sur un serveur web pour que Grist puisse y accéder. **GitHub Pages** est gratuit et ne nécessite aucune compétence technique.

### Étape 1 — Créer un compte GitHub

Rendez-vous sur [github.com](https://github.com) et créez un compte gratuit.

### Étape 2 — Créer un nouveau dépôt

1. Cliquez sur le bouton vert **New** (ou le **+** en haut à droite → *New repository*)
2. Donnez un nom : par exemple `kanban-lasuite`
3. Choisissez **Public** ← obligatoire pour GitHub Pages gratuit
4. Cochez **Add a README file**
5. Cliquez sur **Create repository**

### Étape 3 — Uploader les 5 fichiers

1. Dans votre dépôt, cliquez sur **Add file → Upload files**
2. Glissez-déposez ces 5 fichiers en même temps :
   - `index.html` · `widget.js` · `widget.css` · `render.js` · `config.js`
3. Cliquez sur **Commit changes** (bouton vert en bas)

### Étape 4 — Activer GitHub Pages

1. Cliquez sur l'onglet **Settings** en haut de votre dépôt
2. Dans le menu gauche, cliquez sur **Pages**
3. Sous *Build and deployment* → **Source** → choisissez **Deploy from a branch**
4. Sous **Branch** → choisissez `main` → `/ (root)` → cliquez **Save**
5. Attendez 1 à 2 minutes puis rafraîchissez la page

Une bannière verte apparaît avec votre URL :
```
https://votre-compte.github.io/kanban-lasuite/
```

> 📌 Notez cette URL — vous en aurez besoin dans Grist.

---

## 6. Installer le widget dans Grist

### Étape 1 — Ajouter une vue personnalisée

1. Dans votre document Grist, cliquez sur **Ajouter une vue à la page**
2. Choisissez **Personnalisée** (colonne gauche)
3. Choisissez votre table source (colonne du milieu)
4. Cliquez sur **Ajouter à la Page**

### Étape 2 — Coller l'URL du widget

Une fenêtre s'ouvre. Dans le champ **URL du widget**, collez votre URL GitHub Pages :
```
https://votre-compte.github.io/kanban-lasuite/
```
Cliquez sur **Ajouter un widget**.

### Étape 3 — Définir le niveau d'accès

Dans le panneau de droite, sous **Niveau d'accès**, choisissez **Accès complet au document**.

> ⚠️ Sans accès complet, le glisser-déposer et l'ajout de cartes ne fonctionneront pas.

### Étape 4 (optionnel) — Ajouter une fiche liée

Pour pouvoir consulter et modifier le détail d'une carte en cliquant dessus :

1. Ajoutez une nouvelle vue **Fiche** sur la même page, avec la même table source
2. Dans le panneau de droite de la vue Fiche → **Données source** → **Sélectionner par** → choisissez la section Kanban

Résultat : cliquer sur une carte dans le Kanban affiche automatiquement sa fiche complète.

---

## 7. Utiliser les filtres

La barre de filtres en haut du Kanban contient 5 contrôles :

### 🔍 Choisir une source
Sélectionnez quelle colonne **Choice** de votre table crée les colonnes du Kanban.
- Exemple : `Statut` → colonnes "À tester", "En cours", "Terminé"...
- Exemple : `Priorite` → colonnes "Urgent", "High", "Medium", "Low"

### 👥 Regrouper par
Sélectionnez une 2e colonne pour organiser les cartes à l'intérieur de chaque colonne en accordéons.
- Exemple : source = `Statut` + regrouper par = `Priorite` → dans chaque colonne, les cartes sont groupées par priorité
- Cliquez sur l'en-tête d'un groupe pour l'ouvrir ou le fermer

### 👁️ Afficher les colonnes
Cochez/décochez les valeurs à afficher comme colonnes.
- Décocher une valeur masque la colonne sans supprimer les données
- La recocher la réaffiche immédiatement

### 📋 Afficher les champs
Choisissez quels champs apparaissent sur les cartes.
- **Afficher tous** : tous les champs de la table sont visibles
- Décochez les champs inutiles pour des cartes plus légères

### 📆 Filtre date
1. Choisissez une colonne date dans le menu déroulant
2. Cochez **Masquer les cartes dont la date est passée** pour ne voir que les cartes actuelles ou futures

---

## 8. Configurer les rôles utilisateurs

Le widget peut afficher ou masquer le bouton **Ajouter une carte** selon le rôle de l'utilisateur connecté.

### Prérequis

Votre document Grist doit contenir une table nommée **Utilisateurs** avec ces colonnes :

| Colonne | Type | Description |
|---|---|---|
| `Email` | Texte | L'adresse email — doit correspondre **exactement** à l'email de connexion Grist |
| `Role` | Choice | Valeurs possibles : `Admin`, `Responsable`, `Testeur` |

### Comportement selon le rôle

| Rôle | Peut ajouter une carte | Peut supprimer une carte |
|---|---|---|
| `Admin` | ✅ Oui | ✅ Oui |
| `Responsable` | ✅ Oui | ✅ Oui |
| `Testeur` | ❌ Non | ❌ Non |

> 💡 Si un utilisateur n'est pas dans la table, le bouton n'apparaît pas.

---

## 9. Mettre à jour le widget

Quand vous voulez modifier un fichier (couleurs, textes, logique...) :

1. Allez dans votre dépôt GitHub
2. Cliquez sur le fichier à modifier (ex: `widget.css`)
3. Cliquez sur l'icône **crayon** en haut à droite (Edit file)
4. Modifiez ou remplacez le contenu (Ctrl+A pour tout sélectionner → coller le nouveau fichier)
5. Cliquez sur **Commit changes**
6. Attendez 1 à 2 minutes
7. Dans Grist, rechargez avec **Ctrl+Maj+R** (Windows) ou **Cmd+Maj+R** (Mac)

> 💡 Si les changements ne s'affichent pas, le cache navigateur est peut-être obsolète. Le rechargement forcé le vide.

---

## 10. Problèmes fréquents

### ❓ Le Kanban affiche "Choisissez une source"
**Cause :** Aucune colonne Choice sélectionnée.
**Solution :** Cliquez sur **Choisir une source** dans la barre de filtres et sélectionnez votre colonne `Statut`.

### ❓ Les colonnes affichent de mauvaises valeurs (d'une autre table)
**Cause :** Le widget lit les données d'une autre table.
**Solution :** Dans le panneau de droite de Grist, vérifiez que **Données source** pointe bien vers la bonne table.

### ❓ Le glisser-déposer ne fonctionne pas
**Cause :** Niveau d'accès insuffisant.
**Solution :** Passez le **Niveau d'accès** à **Accès complet au document** dans le panneau de droite.

### ❓ Le bouton "Ajouter une carte" n'apparaît pas
**Cause 1 :** Votre email n'est pas dans la table Utilisateurs.
**Cause 2 :** Votre rôle est `Testeur`.
**Solution :** Vérifiez la table Utilisateurs — email exact + rôle `Admin` ou `Responsable`.

### ❓ La date ne se remplit pas automatiquement
**Cause :** Le nom de la colonne ne correspond pas exactement.
**Solution :** Vérifiez que vos colonnes s'appellent exactement : `Date_en_cours`, `Date_termine`, `Date_archive`, `Date_annule`.

### ❓ Le widget affiche une page blanche ou ne charge pas
**Cause :** GitHub Pages n'a pas fini de se déployer, ou cache navigateur.
**Solution :** Attendez 2 minutes après un Commit, puis rechargez avec **Ctrl+Maj+R**.

---

## 11. Questions fréquentes

**Puis-je changer les couleurs ?**
Oui — ouvrez `widget.css` dans GitHub et modifiez les variables dans la section `:root` (lignes commençant par `--ls-`).

**Puis-je utiliser le widget avec n'importe quelle table ?**
Oui — le widget détecte automatiquement toutes les colonnes. Choisissez la colonne source via *Choisir une source*.

**Pourquoi le dépôt doit-il être Public ?**
GitHub Pages est gratuit uniquement pour les dépôts publics. Seul le code du widget est visible — vos données Grist restent privées sur votre serveur.

**Puis-je avoir plusieurs Kanban sur la même page Grist ?**
Oui — ajoutez plusieurs vues personnalisées avec la même URL, sur des tables différentes.

**Le widget fonctionne-t-il sur mobile ?**
L'affichage fonctionne sur mobile mais le glisser-déposer est optimisé pour les écrans larges.

**Que se passe-t-il si je supprime une valeur Choice dans Grist ?**
Les cartes qui avaient cette valeur disparaissent du Kanban (mais restent dans votre table). Pour les retrouver, modifiez leur statut dans la table.

---

## 12. Structure des fichiers

```
kanban-lasuite/
├── index.html    → Point d'entrée : charge les scripts
├── widget.js     → Logique principale : Grist, rendu, drag & drop, filtres
├── widget.css    → Charte LaSuite : couleurs, police Barlow, mise en page
├── render.js     → Rendu des valeurs Grist (Choice, Référence, Date, Bool)
├── config.js     → Panneau de configuration et options persistées
└── README.md     → Ce fichier
```

| Je veux... | Fichier à modifier |
|---|---|
| Changer les couleurs | `widget.css` → section `:root` |
| Changer la taille des textes | `widget.css` → propriétés `font-size` |
| Modifier la logique des filtres | `widget.js` |
| Changer le rendu des dates | `render.js` |
| Modifier le panneau de config | `config.js` |

---

## 13. Crédits

Widget développé pour **LaSuite.coop**, inspiré et construit à partir de :
- **Varamil** — architecture multi-fichiers, SortableJS, couleurs Choice
- **Élodie Gateau** — logique des filtres (source, regroupement, colonnes, champs, date)
- **Éric Couillard (MTES)** — suppression avec confirmation (RemoveRecord)

Technologies : [Grist Plugin API](https://docs.getgrist.com/) · [SortableJS](https://sortablejs.github.io/Sortable/) · [Barlow](https://fonts.google.com/specimen/Barlow)

---
---

# Widget Kanban — LaSuite.coop (English)

> A visual and customizable Kanban widget for **Grist**, styled with the **LaSuite.coop** brand.
> Drag and drop your cards, filter by status or priority, and adapt the display to your table — without touching any code.

---

## Table of Contents

1. [What is this widget?](#1-what-is-this-widget)
2. [What you can do](#2-what-you-can-do)
3. [What you need before starting](#3-what-you-need-before-starting)
4. [Prepare your Grist table](#4-prepare-your-grist-table)
5. [Deploy the widget to GitHub Pages](#5-deploy-the-widget-to-github-pages)
6. [Install the widget in Grist](#6-install-the-widget-in-grist)
7. [Using the filters](#7-using-the-filters)
8. [Configuring user roles](#8-configuring-user-roles)
9. [Updating the widget](#9-updating-the-widget)
10. [Common issues](#10-common-issues)
11. [Frequently asked questions](#11-frequently-asked-questions)
12. [File structure](#12-file-structure)

---

## 1. What is this widget?

A **Kanban widget** is a visual board with columns and cards that can be moved between columns by drag and drop. Think of Trello or a physical sticky note board.

This widget installs inside **Grist** and connects directly to your data. When you move a card, the value automatically updates in your Grist table.

**What makes this widget special:**
- It adapts to **any Grist table** — no code changes needed
- Kanban columns are created automatically from your Choice columns
- Everything you want to change (titles, colors, columns) is modified **directly in Grist**, without touching the code

---

## 2. What you can do

| Feature | Description |
|---|---|
| 🃏 **Cards** | Each row in your table becomes a card |
| ↔️ **Drag and drop** | Move a card to change its status |
| 🏷️ **Priority badge** | Urgent / High / Medium / Low shown on each card |
| 👤 **Avatar** | Assignee initials with a unique color |
| 📅 **Automatic date** | Date fills automatically when you drag a card |
| 🔽 **Collapsible columns** | Click ⇄ to collapse a column |
| 🔍 **Choose source** | Choose which Choice column creates the Kanban columns |
| 👥 **Group by** | Group cards by a 2nd column (e.g. by priority) |
| 👁️ **Show/hide columns** | Hide columns you don't need |
| 📋 **Show/hide fields** | Choose which fields appear on cards |
| 📆 **Date filter** | Hide cards whose date is in the past |
| 🔒 **Roles** | Admin and Manager can create/delete — not Testers |
| 🗑️ **Delete a card** | ··· menu on the card → Delete |

---

## 3. What you need before starting

- ✅ A **Grist** account
- ✅ A free **GitHub** account ([github.com](https://github.com))
- ✅ The 5 widget files

> **No technical skills required.**

---

## 4. Prepare your Grist table

Your table needs **at least one Choice column** to create Kanban columns.

### Minimum recommended structure

| Column | Grist type | Required? | Role |
|---|---|---|---|
| `Title` or `Name` | Text | ✅ Yes | Card title |
| `Status` | **Choice** | ✅ Yes | Creates Kanban columns |
| `Priority` | Choice | ⬜ Optional | Urgent/High/Medium/Low badge |
| `Assignee` | Reference or Text | ⬜ Optional | Avatar initials |
| `Date_en_cours` | DateTime | ⬜ Optional | Auto-fills when card moved to "En cours" |
| `Date_termine` | DateTime | ⬜ Optional | Auto-fills when card moved to "Terminé" |
| `Date_archive` | DateTime | ⬜ Optional | Auto-fills when card moved to "Archivé" |
| `Date_annule` | DateTime | ⬜ Optional | Auto-fills when card moved to "Annulé" |

> ⚠️ **Column names must be exact** for auto-dating to work.

### Configure the Priority column (optional)

Create a **Choice** column named `Priority` with these **exact values**:
`Urgent` · `High` · `Medium` · `Low`

---

## 5. Deploy the widget to GitHub Pages

### Step 1 — Create a GitHub account
Go to [github.com](https://github.com) and sign up for free.

### Step 2 — Create a new repository
1. Click **New** → name it (e.g. `kanban-lasuite`) → choose **Public** → **Create repository**

### Step 3 — Upload the 5 files
1. Click **Add file → Upload files**
2. Drop all 5 files: `index.html` · `widget.js` · `widget.css` · `render.js` · `config.js`
3. Click **Commit changes**

### Step 4 — Enable GitHub Pages
1. Go to **Settings → Pages**
2. Source: **Deploy from a branch** → Branch: `main` → `/ (root)` → **Save**
3. Wait 1–2 minutes. Your URL appears:

```
https://your-account.github.io/kanban-lasuite/
```

---

## 6. Install the widget in Grist

1. Click **Add view to page** → **Custom** → select your table → **Add to page**
2. In the widget gallery, paste your GitHub Pages URL in the **Widget URL** field → **Add widget**
3. Set **Access level** to **Full document access**
4. The Kanban appears with your columns

### Optional — Add a linked detail card

1. Add a **Card** view on the same page with the same table
2. In its right panel → **Data source** → **Link section to** → select the Kanban section
3. Clicking a Kanban card now opens its full detail view

---

## 7. Using the filters

| Filter | What it does |
|---|---|
| **Choose source** | Selects which Choice column creates the Kanban columns |
| **Group by** | Groups cards inside each column by a 2nd Choice column (accordion) |
| **Show columns** | Check/uncheck which column values are visible |
| **Show fields** | Check/uncheck which fields appear on cards |
| **Date filter** | Pick a date column; optionally hide past cards |

---

## 8. Configuring user roles

Your Grist document needs a table named **Utilisateurs** with:

| Column | Type | Notes |
|---|---|---|
| `Email` | Text | Must **exactly** match the user's Grist login email |
| `Role` | Choice | `Admin`, `Responsable`, or `Testeur` |

| Role | Can add cards | Can delete cards |
|---|---|---|
| `Admin` | ✅ Yes | ✅ Yes |
| `Responsable` | ✅ Yes | ✅ Yes |
| `Testeur` | ❌ No | ❌ No |

---

## 9. Updating the widget

1. Go to your GitHub repository
2. Click the file → pencil icon (Edit)
3. Select all → paste the new content → **Commit changes**
4. Wait 1–2 minutes
5. In Grist, force-reload: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)

---

## 10. Common issues

| Problem | Cause | Solution |
|---|---|---|
| "Choose a source" shown | No source selected | Click *Choose source* → select `Status` |
| Wrong column values | Widget reads wrong table | Check *Data source* in Grist right panel |
| Drag and drop broken | Access level too low | Set to **Full document access** |
| Add button missing | User not in Users table or role = Testeur | Check Users table email and role |
| Dates not auto-filling | Column names don't match exactly | Use: `Date_en_cours`, `Date_termine`, `Date_archive`, `Date_annule` |
| Changes not showing | Browser cache | Force reload with Ctrl+Shift+R |
| White page | GitHub Pages still deploying | Wait 2 min after commit, then reload |

---

## 11. Frequently asked questions

**Can I change the colors?**
Open `widget.css` in GitHub → modify variables in the `:root` section (lines starting with `--ls-`).

**Can I use this with any table structure?**
Yes — the widget auto-detects all columns. Choose the source column via *Choose source*.

**Why does the repository need to be Public?**
GitHub Pages is free only for public repos. Your Grist data stays private — only the widget code is visible.

**Can I have multiple Kanban boards on the same Grist page?**
Yes — add multiple custom views with the same URL, pointing to different tables.

**Does it work on mobile?**
Display works on mobile but drag and drop is optimized for wider screens.

**What happens if I delete a Choice value in Grist?**
Cards with that value disappear from the Kanban but remain in your table. Edit their status to make them reappear.

---

## 12. File structure

```
kanban-lasuite/
├── index.html    → Entry point: loads scripts
├── widget.js     → Main logic: Grist, rendering, drag & drop, filters
├── widget.css    → LaSuite brand: colors, Barlow font, layout
├── render.js     → Grist value rendering (Choice, Reference, Date, Bool)
├── config.js     → Configuration panel and persisted options
└── README.md     → This file
```

| I want to... | File to modify |
|---|---|
| Change colors | `widget.css` → `:root` section |
| Change text sizes | `widget.css` → `font-size` properties |
| Modify filter logic | `widget.js` |
| Change date display | `render.js` |
| Modify config panel | `config.js` |

---

*Widget developed for LaSuite.coop — built on the work of Varamil, Élodie Gateau, and Éric Couillard.*
