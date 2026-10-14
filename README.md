# YoRHa · 2B Companion

Application compagnon **installable (PWA)** en français : avatar cinématique 2,5D animé, mouvements de robe et de cheveux, interface en verre translucide et chat OpenAI / OpenRouter. Application de fan non officielle, sans affiliation à Square Enix ou PlatinumGames.

## Stack

React 19, TypeScript, Vite 8, Three.js, React Three Fiber, Drei, IndexedDB (`idb`), Web Crypto et service worker Workbox. Conteneur Docker multi-stage, serveur Nginx non privilégié, GitHub Actions et publication préparée vers GitHub Container Registry.

## Démarrage

```sh
npm ci
npm run dev
```

Ouvrir l’URL affichée par Vite. Node.js 24 LTS recommandé.

```sh
npm test
npm run build
npm run preview
```

## Avec Docker

```sh
docker compose up --build -d
```

Ouvrir `http://localhost:8080`. Le conteneur tourne sans droits root, en lecture seule, avec un répertoire temporaire en mémoire. Aucune clé utilisateur n’est incluse dans l’image ou le dépôt. La PWA et Web Crypto exigent HTTPS ou localhost. Pour un serveur distant, placer le conteneur derrière un proxy HTTPS avec contrôle d’accès adapté à une application privée.

Pour les environnements utilisant un certificat de proxy, le Dockerfile accepte un certificat public via un montage BuildKit facultatif, sans l’intégrer à l’image :

```sh
docker build --secret id=proxy_ca,src=/chemin/ca-certificates.crt -t yorha-2b-companion .
```

## GitHub Container Registry

Le workflow `.github/workflows/container.yml` exécute tests et build, puis construit et publie l’image :

```text
ghcr.io/samuel85-git/yonrah-ia:latest
ghcr.io/samuel85-git/yonrah-ia:<commit>
```

Le workflow utilise le `GITHUB_TOKEN` de GitHub Actions avec `packages: write`. Le registre et ses droits d’accès doivent être autorisés sur le compte ou l’organisation. Le dépôt [Samuel85-git/yonrah-IA](https://github.com/Samuel85-git/yonrah-IA) est privé. La visibilité du package se contrôle dans les paramètres GitHub Packages. L’image n’existe dans GHCR qu’après un premier workflow réussi ; le workflow préparé ne prouve pas une publication réussie.

## 2B et les animations

Le personnage a été remplacé par une nouvelle illustration semi-réaliste haute définition, générée spécialement pour cette application à partir des références fournies par l’utilisateur. Elle est affichée sur une surface WebGL subdivisée en 2,5D. Le visage, les matières de la robe et les cheveux sont entièrement renouvelés ; l’ancien GLB n’est plus utilisé.

La caméra reste frontale, avec une petite profondeur et une parallaxe au glissement. Ce rendu n’offre pas de rotation à 360° : une image de face ne contient pas les vues arrière du personnage. Le moteur déforme localement le maillage pour la respiration, les mouvements de tête et d’épaules, les changements de posture et les réactions au toucher. Les pieds restent ancrés au sol.

La robe et les cheveux suivent des ressorts amortis qui réagissent aux gestes puis reviennent progressivement au repos. Il s’agit de mouvements secondaires procéduraux, pas d’une simulation complète de tissu avec couture et collisions. Le salut est une reconnaissance discrète de la tête ; Bouger déclenche un changement d’appui, sans tenter une marche volumétrique à partir de l’image de face.

Les réactions au toucher restent superposées à l’activité en cours : elles n’interrompent pas la réflexion ou le dialogue. Les contacts sont temporisés et les glissements de caméra ne sont pas des contacts. La préférence système de réduction des mouvements est respectée. Sans WebGL, un portrait statique permet de conserver l’accès au chat.

Ces mouvements ne sont pas les animations officielles de NieR:Automata. La voix optionnelle reste celle du navigateur, sans synchronisation labiale complète.

## Identité et prompt système

`src/persona.ts` contient une identité originale : YoRHa No.2 Type B, androïde de combat calme et disciplinée, Pod 042, partenaire 9S, et sollicitude discrète. Sans spoilers par défaut. L’option autorisant les révélations ajoute son rôle réel et le passé de YoRHa. Les préférences de l’utilisateur complètent la personnalité sans remplacer son identité. Le prompt est consultable dans les paramètres.

## Chat et mémoire

1. Ouvrir **Paramètres**.
2. Choisir OpenAI, OpenRouter ou une API compatible OpenAI.
3. Fournir la clé et le modèle, puis enregistrer.

La facturation API OpenAI est distincte d’un abonnement ChatGPT. Une API externe doit accepter les appels du navigateur via CORS. Les requêtes vont **directement du navigateur au fournisseur choisi**, jamais à GitHub ou au serveur Nginx. Le mode découverte est clairement identifié comme des réponses préécrites, sans IA.

- Les clés sont conservées par fournisseur dans IndexedDB, chiffrées avec AES-GCM et un nonce aléatoire. La CryptoKey de l’appareil est non extractible et reste dans IndexedDB. Le chiffrement des données au repos n’empêche pas un script malveillant exécuté sur la même origine de demander un déchiffrement ; cette application n’est pas un coffre-fort matériel.
- Les discussions, préférences et notes restent dans ce navigateur sur cet appareil, y compris après rechargement ou fermeture. Elles ne sont pas synchronisées entre appareils.
- Les notes du panneau **Mémoire** sont incluses dans les nouvelles requêtes, ainsi que les messages de la conversation active. Le contexte est plafonné à environ 60 000 caractères ; le panneau signale quand les anciens messages restent archivés mais ne sont plus transmis.
- L’export JSON comprend les discussions et les notes, **jamais les clés**. Les conversations peuvent être supprimées individuellement. Le bouton poubelle de la clé la supprime immédiatement de l’appareil.
- Les données de la première version sont reprises sur la même origine. Changer de domaine, de navigateur ou vider les données du site ne transfère pas cette mémoire.

## Installation et hors ligne

Utiliser le bouton Installer ou le menu du navigateur (« Installer l’application » / « Ajouter à l’écran d’accueil »). La prise en charge dépend du navigateur. Le service worker conserve les assets, y compris l’avatar, pour retrouver la scène et la mémoire hors ligne après le premier chargement. Le chat IA nécessite toujours Internet. Sur Sites privé, l’authentification de la plateforme peut limiter un premier accès ou une réouverture hors ligne.

## Validation

Tests Vitest : persistance et chiffrement de la clé, suppression, reprise de l’ancien historique, conversations actives, prompt canonique et notes, destination des appels, erreurs d’authentification, validation HTTPS et limitation du contexte. Les appels IA sont vérifiés avec des réponses simulées ; une vraie clé et des crédits sont nécessaires pour une conversation réelle.

Voir [THIRD_PARTY.md](THIRD_PARTY.md) pour les licences et les attributions de l’avatar et des mouvements.
