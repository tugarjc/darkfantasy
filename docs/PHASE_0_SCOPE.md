# Inferno Domini — Scope Phase 0 : Prototype UI

## Objectif

Livrer un prototype fonctionnel navigable (React + SVG) qui prouve le design system, les écrans principaux et l'authentification. Aucune logique serveur de jeu n'est implémentée en Phase 0.

---

## INCLUS

### Infrastructure
- [x] Repo Git initialisé, `.gitignore`, `.env.example`
- [x] Docker Compose : PostgreSQL 16, Redis 7, serveur Node, client Vite
- [x] Migration SQL initiale (schéma complet : 18+ tables, enums, fonctions)
- [x] Dockerfiles serveur et client

### Design System
- [x] Tokens CSS : palette (noir/rouge sang/or/violet), typographie, espacements
- [x] 6 composants SVG de base : icônes ressources (Fer, Essence, Âmes), hexagone carte, blason, bouton infernal
- [x] Animations SVG légères (flammes, pulsations, rotations)
- [x] Documentation design system

### Frontend (squelette)
- [ ] Routing React Router : `/`, `/login`, `/register`, `/play`
- [ ] Landing page dark fantasy (hero SVG, CTA)
- [ ] Écran de connexion / inscription (formulaires, validation client)
- [ ] Vue Cercle Infernal : affichage SVG des bâtiments, compteurs ressources, timers
- [ ] Zustand store initial (auth, ressources mock)

### Backend (minimal)
- [ ] Express health endpoint (`/api/health`)
- [ ] Auth endpoints : register, login, refresh, logout (JWT + bcrypt)
- [ ] Connexion PostgreSQL + Redis vérifiée au boot
- [ ] Socket.io prêt (connexion/déconnexion loggées)

### Outils
- [x] Tableur de simulation d'équilibrage (HTML interactif, 30 jours)

---

## EXCLU (reporté aux phases suivantes)

| Fonctionnalité                          | Phase cible |
|-----------------------------------------|-------------|
| Production de ressources (lazy eval)    | Phase 1     |
| Construction de bâtiments (files, timers) | Phase 1   |
| Entraînement d'unités                   | Phase 1     |
| Carte hexagonale interactive            | Phase 2     |
| Déplacement de légions & pathfinding    | Phase 2     |
| Système de combat (résolution serveur)  | Phase 2     |
| Espionnage                              | Phase 2     |
| Arbre de recherches                     | Phase 3     |
| Système de héros                        | Phase 3     |
| Marché démoniaque                       | Phase 3     |
| Colonisation multi-Cercle               | Phase 3     |
| Alliances / Pactes / Forteresse         | Phase 4     |
| Chat (mondial, alliance, privé)         | Phase 4     |
| Événements mondiaux (Failles, Invasions)| Phase 5     |
| Monétisation / Reliques store           | Phase 5     |
| Audio / SFX                             | Phase 6     |
| i18n (anglais, allemand, espagnol)      | Phase 6     |
| PWA / Service Worker                    | Phase 6     |
| Anti-bot / Anti-multicompte             | Phase 7     |
| Panel administrateur                    | Phase 7     |

---

## Critères de validation Phase 0

1. `docker compose up` lance les 4 services sans erreur
2. La migration SQL s'applique automatiquement
3. La landing page s'affiche avec le design system appliqué
4. Un utilisateur peut s'inscrire et se connecter
5. La vue Cercle affiche les composants SVG avec les compteurs de ressources (données mock)
6. Le tableur de simulation produit des résultats cohérents avec les formules du GDD
