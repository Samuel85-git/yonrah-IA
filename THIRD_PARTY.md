# Ressources tierces

## Avatar cinématique 2B

`public/assets/2b-cinematic.png` et l’atlas `public/assets/2b-poses.png` sont des illustrations générées pour cette application à partir des références de 2B fournies par l’utilisateur. Elles ne reprennent pas le fichier de l’illustrateur ni ses inscriptions. Le rendu semi-réaliste est animé sur une surface WebGL en 2,5D ; il ne s’agit pas d’un modèle 3D officiel reconstruit depuis le jeu.

2B, YoRHa et NieR:Automata appartiennent à leurs ayants droit, notamment Square Enix / PlatinumGames. Cette application compagnon est une création de fan non officielle.

## Emblème YoRHa

`public/icons/yorha-emblem.svg` est une vectorisation de l’emblème YoRHa provenant de [zcode-canvas](https://github.com/Kevinzzz6/zcode-canvas/blob/main/themes/yorha/emblem.svg). Le [NOTICE du projet source](https://github.com/Kevinzzz6/zcode-canvas/blob/main/NOTICE.md) précise que l’emblème de NieR:Automata est exclu de sa licence MIT. Les droits du symbole restent ceux de ses ayants droit ; il est utilisé ici dans cette application de fan. Les icônes `yorha-192.png` et `yorha-512.png` sont des rendus de ce SVG sur un fond clair.

## Ancien modèle

Le GLB de Cyber (`calibreefe20`), [2B nier automata](https://sketchfab.com/3d-models/2b-nier-automata-d3e553bc325f4e0bb211f37a16f5ee12), sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), était utilisé dans les versions précédentes. Il n’est plus distribué dans la version cinématique ; son historique et ses crédits restent dans Git.

## Mouvements

Les mouvements de la nouvelle version sont créés par `src/cinematic-motion.ts` et le moteur 2,5D de l’application : respiration, réactions, changements d’appui et oscillations amorties de la robe et des cheveux. Aucune animation officielle de NieR:Automata ni clip Xbot/Mixamo n’est distribué.

## Identité et contexte

Le prompt est une rédaction originale, fondée sur la [présentation officielle du jeu et de ses personnages par PlatinumGames](https://www.platinumgames.com/works/nier-automata). Les révélations du scénario sont isolées par une préférence sans spoilers activée par défaut. L’application ne reproduit pas de longs dialogues du jeu.

## Image Pets

`public/assets/2b-sprites.png` et son avatar proviennent du pet existant `pet_6ac22a9b89e081918889c6abb13d6635`, réutilisé à la demande de son propriétaire. Le pet enregistré n’a pas été modifié. L’image du pet est conservée dans les sources ; le personnage de la scène et le portrait du chat utilisent maintenant la nouvelle illustration cinématique.

## Bibliothèques

React, Vite, Three.js, React Three Fiber, Drei, idb, Lucide et les outils associés conservent leurs licences dans leurs paquets. Les icônes de l’application sont générées pour ce projet. Les polices DM Sans et Manrope, sous SIL Open Font License, sont chargées en option avec un fallback système.
