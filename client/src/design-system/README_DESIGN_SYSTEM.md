# Inferno Domini — Design System

## Palette

| Token                  | Hex       | Usage                         |
|------------------------|-----------|-------------------------------|
| `--color-bg-deep`      | `#0A0A0F` | Fond le plus sombre           |
| `--color-bg-base`      | `#111118` | Fond des panneaux             |
| `--color-bg-surface`   | `#1A1A24` | Surfaces élevées              |
| `--color-blood`        | `#8B1A1A` | Accent principal (rouge sang) |
| `--color-gold`         | `#C9A84C` | Accent secondaire (or ancien) |
| `--color-infernal`     | `#6B2FA0` | Violet démoniaque             |
| `--color-iron`         | `#B0592A` | Fer Maudit (ressource)        |
| `--color-essence`      | `#6E44AA` | Essence Démoniaque (ressource)|
| `--color-souls`        | `#3CA66B` | Âmes Corrompues (ressource)   |
| `--color-text-primary` | `#F0E6D2` | Texte parchemin               |

## Typographie

| Usage     | Font stack                                | Tailles       |
|-----------|-------------------------------------------|---------------|
| Display   | MedievalSharp, Cinzel, Georgia, serif     | 2xl — 4xl     |
| Body      | Inter, Segoe UI, system-ui, sans-serif    | sm — lg       |
| Mono      | JetBrains Mono, Fira Code, monospace      | xs — sm       |

Contraste texte : `#F0E6D2` sur `#1A1A24` = **12.8:1** (WCAG AAA).

## Composants SVG (`components.svg`)

Utilisation en React :

```jsx
<svg><use href="/design-system/components.svg#icon-iron" /></svg>
```

| Symbol ID        | Description                        |
|------------------|------------------------------------|
| `icon-iron`      | Enclume + flammes (Fer Maudit)     |
| `icon-essence`   | Oeil tourbillonnant (Essence)      |
| `icon-souls`     | Crâne rayonnant (Âmes Corrompues)  |
| `hex-tile`       | Hexagone de carte (Pandémonium)    |
| `shield-frame`   | Blason / cadre faction             |
| `btn-infernal`   | Bouton UI infernal                 |

Tous les SVG utilisent des animations CSS/SMIL légères (flammes, pulsations, rotations). Les filtres SVG lourds sont désactivés sur mobile.
