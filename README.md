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

Le personnage utilise quatre poses semi-réalistes générées pour cette application : repos, salut de la main, posture attentive et déplacement. L’image principale est `public/assets/2b-cinematic.png` ; les trois nouvelles poses sont regroupées dans `public/assets/2b-poses.png`. Chaque pose est découpée selon sa transparence puis affichée sur une surface WebGL subdivisée avec de courtes transitions.

La respiration, les épaules, la tête, les cheveux et la robe sont animés par déformations locales et ressorts amortis. La pose de déplacement ajoute des pas alternés modérés, entraînant la robe. La caméra offre une légère parallaxe ; les poses illustrées représentent principalement l’avant du personnage.

**Bouger** ouvre le panneau de déplacement et lance un petit trajet. Les flèches permettent d’aller à gauche/droite, de reculer ou d’approcher. Un toucher dans une zone libre choisit une destination lorsque ce panneau est ouvert. Le mouvement accélère et ralentit, reste dans les limites de l’écran et s’arrête à destination. La profondeur change la taille du personnage, sa position et son ombre au sol. Arrêter interrompt le trajet ; Recentrer remet 2B au centre. Les boutons Repos, Salut et À l’écoute choisissent les poses sans effacer le chat.

Le déplacement est une mise en scène semi-3D de poses 2,5D, avec des mouvements de jambes limités par les illustrations. La robe utilise des ressorts procéduraux, sans simulation complète de tissu ou collisions. Les réactions au toucher continuent de se superposer au dialogue et à la réflexion. Les glissements changent légèrement l’angle et ne déclenchent pas de contact.

Avec la réduction des mouvements, une destination choisie est appliquée directement et les animations sont désactivées. Sans WebGL, un portrait statique conserve l’accès au chat.

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
