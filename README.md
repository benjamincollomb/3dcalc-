# 3DCalc — Application Web

Calculateur d'impression 3D avec Firebase (Auth + Firestore) et hébergement GitHub Pages.

---

## 🚀 Mise en place (étape par étape)

### 1. Créer un compte Firebase (gratuit)

1. Aller sur [https://console.firebase.google.com](https://console.firebase.google.com)
2. Cliquer **"Ajouter un projet"**
3. Nom du projet : `3d-calc` (ou ce que vous voulez)
4. Désactiver Google Analytics (optionnel)
5. Cliquer **Créer le projet**

### 2. Activer Authentication

1. Dans le menu gauche → **Authentication** → **Commencer**
2. Onglet **Sign-in method** → Activer **E-mail/Mot de passe**
3. Sauvegarder

### 3. Activer Firestore

1. Dans le menu gauche → **Firestore Database** → **Créer une base de données**
2. Choisir **Mode production**
3. Région : `europe-west1` (Belgique, plus proche de la Suisse)
4. Cliquer **Activer**

#### Règles Firestore (important !)
Dans Firestore → onglet **Règles**, remplacer par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Cliquer **Publier**.

### 4. Obtenir la config Firebase

1. Dans la console Firebase → ⚙️ **Paramètres du projet** (icône engrenage)
2. Onglet **Général** → faire défiler vers le bas
3. Section **Vos applications** → cliquer **</>** (Web)
4. Donner un nom : `3DCalc Web`
5. **Ne pas** cocher "Firebase Hosting" (on utilise GitHub Pages)
6. Copier le bloc `firebaseConfig`

### 5. Coller la config dans index.html

Ouvrir `index.html` et remplacer cette section :

```js
const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};
```

Par votre config réelle, qui ressemble à :

```js
const firebaseConfig = {
  apiKey:            "AIzaSyC...",
  authDomain:        "mon-projet.firebaseapp.com",
  projectId:         "mon-projet",
  storageBucket:     "mon-projet.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

### 6. Créer un dépôt GitHub

1. Aller sur [https://github.com](https://github.com) → créer un compte si besoin
2. Cliquer **New repository**
3. Nom : `3d-calc` (ou ce que vous voulez)
4. Visibilité : **Public** (requis pour GitHub Pages gratuit)
5. Cliquer **Create repository**

### 7. Uploader les fichiers

#### Option A — Via l'interface web GitHub (le plus simple)
1. Sur votre dépôt, cliquer **Add file → Upload files**
2. Glisser-déposer tout le contenu du dossier `3d-calc/`
3. Cliquer **Commit changes**

> ⚠️ Uploader aussi le dossier `css/` et `js/` avec leurs fichiers !

#### Option B — Via Git (terminal)
```bash
cd 3d-calc
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE_NOM/3d-calc.git
git push -u origin main
```

### 8. Activer GitHub Pages

1. Sur votre dépôt GitHub → onglet **Settings**
2. Menu gauche → **Pages**
3. Source : **Deploy from a branch**
4. Branch : **main** / Folder : **/ (root)**
5. Cliquer **Save**

Après 1-2 minutes, votre site sera accessible à :
```
https://VOTRE_NOM_GITHUB.github.io/3d-calc/
```

### 9. Autoriser votre domaine dans Firebase

1. Console Firebase → **Authentication** → onglet **Settings**
2. Section **Domaines autorisés** → **Ajouter un domaine**
3. Ajouter : `VOTRE_NOM_GITHUB.github.io`

---

## 📁 Structure des fichiers

```
3d-calc/
├── index.html          ← Application principale
├── css/
│   └── style.css       ← Styles
├── js/
│   └── app.js          ← Logique application
└── README.md           ← Ce fichier
```

## 🔥 Structure Firestore

```
users/
  {uid}/
    bobines/
      {bobineId} → { id, marque, matiere, couleur, prix, diametre, poids, lien, rupture }
    archives/
      {archiveId} → { nom, client, typeMarge, margePct, temps, costElec, items[], prixArrondi, date, ... }
```

## ✨ Fonctionnalités

- **Login / Inscription** par email+mot de passe
- **Accueil** — dashboard avec stats et accès rapides
- **Nouveau devis** — calcul complet avec :
  - Coût électricité (W × h × CHF/kWh)
  - Coût fichier 3D amorti sur n impressions
  - Coût création 3D (h × tarif CHF/h)
  - Jusqu'à ∞ filaments (bobine + grammes)
  - Marges : AMI 20%, 7 ART 5%, CLIENT 40%, PERSO libre
  - Arrondi commercial au 0.10 CHF supérieur ↑
- **Bobines** — gestion du stock, ruptures cachées du calcul
- **Archives** — historique consultable, supprimable

## 🛡️ Sécurité

Chaque utilisateur ne voit **que ses propres données** grâce aux règles Firestore.

---

Made with Firebase + GitHub Pages · Suisse 🇨🇭
