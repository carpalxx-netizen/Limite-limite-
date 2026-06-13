# Limite Limite — Le jeu

Jeu de cartes multijoueur en temps reel, inspire du jeu physique "Limite Limite" (facon Cards Against Humanity).

## 1. Configurer Supabase (base de donnees + temps reel)

1. Cree un compte gratuit sur supabase.com et cree un nouveau projet.
2. Une fois le projet cree, va dans **SQL Editor**.
3. Copie-colle le contenu du fichier `supabase_schema.sql` et execute-le (bouton "Run"). Ca cree toutes les tables, les regles de securite et active le temps reel.
4. Copie-colle ensuite le contenu de `supabase_seed.sql` et execute-le. Ca ajoute le jeu de cartes de base (190 questions + 100 reponses).
5. Va dans **Project Settings -> API**. Recupere :
   - **Project URL** (ex: https://xxxxx.supabase.co)
   - **anon public key**

## 2. Configurer les variables d'environnement

Cree un fichier `.env` a la racine du projet (copie `.env.example`) :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ta-cle-anon
```

## 3. Tester en local

```bash
npm install
npm run dev
```

## 4. Deployer sur Netlify

### Option A - via l'interface Netlify (le plus simple)

1. Pousse ce projet sur un repo GitHub.
2. Sur app.netlify.com, clique "Add new site" -> "Import an existing project".
3. Choisis ton repo GitHub.
4. Netlify detecte automatiquement `npm run build` et `dist` (grace a `netlify.toml`).
5. Avant de deployer, va dans **Site settings -> Environment variables** et ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploie !

### Option B - via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set VITE_SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "ta-cle-anon"
netlify deploy --prod
```

## 5. Utiliser l'admin cache

- Sur la page d'accueil, **tape 4 fois sur le logo "Limite Limite"**.
- Entre le code **6000**.
- Tu arrives sur le panneau d'administration : tu peux ajouter, masquer/afficher et supprimer des cartes (questions et reponses), dans le deck visible ou dans le deck cache "SBR".

## 6. Activer le deck cache "SBR" pendant une partie

- Dans une table de jeu, **tape 5 fois sur le logo** en haut a gauche.
- Entre le code **SBR**.
- Le deck cache est active pour cette table : les questions et reponses tirees viendront desormais du deck marque "SBR" dans l'admin (jusqu'a ce qu'on retape le code pour le desactiver).

## Regles du jeu

1. Chaque joueur recoit 7 cartes "reponse".
2. A chaque manche, un joueur est designe "juge" (a tour de role) et une carte "question" (avec un ou deux trous) est revelee.
3. Tous les autres joueurs choisissent une (ou deux) carte(s) de leur main pour completer la phrase, en secret.
4. Une fois que tout le monde a repondu, le juge decouvre les combinaisons et choisit la plus drole/la plus trash.
5. Le joueur gagnant marque un point. Manche suivante !

Bon jeu, et limite limite.
