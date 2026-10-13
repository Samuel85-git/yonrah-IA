# Ressources tierces

## Personnage 2B

- Fichier : `public/models/2b.glb`.
- Titre de la publication : **2B nier automata**.
- Auteur de la publication : **Cyber** (`calibreefe20`).
- Publication : https://sketchfab.com/3d-models/2b-nier-automata-d3e553bc325f4e0bb211f37a16f5ee12
- Licence annoncée par la publication : [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
- Licence vérifiée le 13 octobre 2026 via l’API publique Sketchfab : `https://api.sketchfab.com/v3/models/d3e553bc325f4e0bb211f37a16f5ee12`, champs `license.slug=by`, `license.label=CC Attribution`, `isDownloadable=true`.
- Fichier obtenu dans la distribution Objaverse : https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-106/d3e553bc325f4e0bb211f37a16f5ee12.glb
- Adaptations dans l’application : normalisation de l’échelle, éclairage, adaptation des mouvements, poses supplémentaires, repositionnement du bandeau au niveau des yeux et cadrage. Le GLB source reste intact.
- L’attribution est également affichée dans l’application.

2B, YoRHa et NieR:Automata appartiennent à leurs ayants droit, notamment Square Enix / PlatinumGames. La licence de la publication communautaire ne transfère pas les droits sur le personnage. Cette application compagnon est une création de fan non officielle.

## Mouvements

Les mouvements sont créés par le moteur procédural de cette application (`src/motion.ts`), directement pour le squelette de 2B. Les anciens clips Xbot/Mixamo ne sont plus utilisés ni distribués. Ces mouvements ne sont pas extraits du jeu NieR:Automata et ne sont pas ses animations officielles.

## Identité et contexte

Le prompt est une rédaction originale, fondée sur la [présentation officielle du jeu et de ses personnages par PlatinumGames](https://www.platinumgames.com/works/nier-automata). Les révélations du scénario sont isolées par une préférence sans spoilers activée par défaut. L’application ne reproduit pas de longs dialogues du jeu.

## Image Pets

`public/assets/2b-sprites.png` et son avatar proviennent du pet existant `pet_6ac22a9b89e081918889c6abb13d6635`, réutilisé à la demande de son propriétaire. Le pet enregistré n’a pas été modifié. L’image du pet est conservée dans les sources ; le personnage de la scène utilise maintenant le GLB riggé.

## Bibliothèques

React, Vite, Three.js, React Three Fiber, Drei, idb, Lucide et les outils associés conservent leurs licences dans leurs paquets. Les icônes de l’application sont générées pour ce projet. Les polices DM Sans et Manrope, sous SIL Open Font License, sont chargées en option avec un fallback système.
