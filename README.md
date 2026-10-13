# 2B — Compagnon interactif

Application web statique en français. Three.js est embarqué dans `dist/vendor` : aucun CDN JavaScript n’est nécessaire au fonctionnement. La police possède un fallback système.

## Fonctionnement

- Le sprite original du pet `pet_6ac22a9b89e081918889c6abb13d6635` est utilisé sans modifier le pet enregistré.
- Scène WebGL 3D avec un personnage en sprite (billboard), caméra mobile, ombre, anneaux et particules. Ce n’est pas un modèle 3D volumétrique de 2B.
- Animations au toucher et boutons : salut, saut, concentration, attente de réponse et erreur.
- Chat OpenAI, OpenRouter ou API compatible OpenAI, envoyé directement depuis le navigateur. La destination personnalisée doit fournir CORS.
- Le mode découverte utilise des réponses préécrites explicitement identifiées. Il n’appelle pas d’IA.
- Historique et préférences dans localStorage. Clé API uniquement en mémoire, jamais enregistrée ni exportée. Après un rechargement, il faut la saisir à nouveau.
- Lecture vocale via le navigateur, export JSON de la conversation et nouvelle conversation.

## Exécuter localement

```sh
python -m http.server 8080 --directory dist
```

Ouvrir `http://localhost:8080`. Pour OpenAI, fournir une clé API avec facturation (un abonnement ChatGPT n’inclut pas l’API). Pour OpenRouter, fournir une clé et un modèle accessible. Les appels aux fournisseurs sont facturés par leurs services. Aucune connexion IA réelle n’a été vérifiée sans clé utilisateur.

## Déploiement

La configuration Sites se trouve dans `.openai/hosting.json` et publie `dist/`. Le site est privé. Aucun secret n’est nécessaire au déploiement.

## Licences

Three.js est distribué sous licence MIT, incluse dans `dist/vendor/LICENSE.txt`. Le personnage 2B est réutilisé à la demande du propriétaire depuis son pet existant. YoRHa et 2B sont des références à NieR:Automata ; l’application n’est pas affiliée à son éditeur.
