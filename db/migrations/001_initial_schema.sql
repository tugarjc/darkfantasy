-- Inferno Domini — Initial Schema Migration
-- Version: 0.1.0

BEGIN;

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE faction_type AS ENUM (
  'none', 'legion_cendres', 'ordre_vide', 'pacte_chaines', 'culte_sang'
);

CREATE TYPE building_type AS ENUM (
  'forge_damnes',          -- Fer Maudit production
  'sanctuaire_neant',      -- Essence Démoniaque production
  'puits_ames',            -- Âmes Corrompues production
  'serre_tenebres',        -- Bonus all production
  'mur_ames',              -- Défense passive
  'tour_chaos',            -- Défense canons
  'portail_invocation',    -- Défenseurs auto
  'bouclier_infernal',     -- Réduction pertes
  'crypte_souterraine',    -- Ressources protégées
  'caserne_damnes',        -- Unités terrestres
  'antre_betes',           -- Unités aériennes
  'forge_ames_liees',      -- Équipement légions
  'autel_sacrifice',       -- Héros
  'bibliotheque_obscure',  -- Recherche
  'tour_vigie',            -- Détection
  'marche_demoniaque',     -- Commerce
  'palais_infernal',       -- Légions max + colonisation
  'entrepot_damnes'        -- Stockage
);

CREATE TYPE unit_type AS ENUM (
  -- Terrestres
  'squelette_soldat', 'diablotin', 'golem_cendres', 'seigneur_guerre', 'gardien_abime',
  -- Aériennes
  'imp_volant', 'drake_ombres', 'liche_aerienne', 'dragon_abyssal',
  -- Spécial (Arcanes Légendaires)
  'archidemon'
);

CREATE TYPE research_type AS ENUM (
  -- Forge Infernale (Production)
  'metallurgie_maudite', 'extraction_essence', 'recolte_ames',
  'entrepot_etendu', 'economie_guerre',
  -- Arts Martiaux (Combat)
  'armes_maudites', 'armure_damnes', 'sorcellerie_aerienne',
  'tactiques_infernales', 'blindage_runique',
  -- Propulsion (Mobilité)
  'vitesse_infernale', 'navigation_plans', 'portails_temporaires',
  -- Occultisme (Spécial)
  'espionnage_occulte', 'contre_espionnage', 'colonisation_rapide',
  'maitrise_failles',
  -- Arcanes Légendaires (Endgame)
  'teleportation_infernale', 'bouclier_absolu', 'vision_pandemonium',
  'portail_permanent', 'invocation_primordiale', 'economie_absolue',
  'drain_dimensionnel'
);

CREATE TYPE hero_type AS ENUM (
  'maledictus', 'volcana', 'skareth', 'noctis', 'ignara', 'kharos'
);

CREATE TYPE mission_type AS ENUM (
  'attaque', 'espionnage', 'transport', 'colonisation', 'farming', 'defense_alliee'
);

CREATE TYPE legion_status AS ENUM (
  'en_route', 'combat', 'retour', 'rappel', 'arrivee'
);

CREATE TYPE admin_role AS ENUM (
  'superadmin', 'admin', 'moderator', 'support'
);

CREATE TYPE diplomacy_status AS ENUM (
  'neutralite', 'guerre', 'paix', 'alliance_militaire'
);

CREATE TYPE server_type AS ENUM (
  'standard', 'rapide', 'saisonnier', 'evenement'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Serveurs de jeu
CREATE TABLE servers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(64) NOT NULL UNIQUE,
  type          server_type NOT NULL DEFAULT 'standard',
  speed         REAL NOT NULL DEFAULT 1.0,
  is_open       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Joueurs
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id       UUID NOT NULL REFERENCES servers(id),
  username        VARCHAR(32) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  faction         faction_type NOT NULL DEFAULT 'none',
  alliance_id     UUID,  -- FK ajoutée après création alliances
  score           BIGINT NOT NULL DEFAULT 0,
  victory_points  BIGINT NOT NULL DEFAULT 0,
  relics          INT NOT NULL DEFAULT 0,
  is_premium      BOOLEAN NOT NULL DEFAULT false,
  is_banned       BOOLEAN NOT NULL DEFAULT false,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, username),
  UNIQUE (server_id, email)
);

-- Cercles Infernaux (bases)
CREATE TABLE circles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name          VARCHAR(64) NOT NULL,
  coord_q       INT NOT NULL,  -- coordonnée hexagonale axiale q
  coord_r       INT NOT NULL,  -- coordonnée hexagonale axiale r
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, coord_q, coord_r)
);

CREATE INDEX idx_circles_coords ON circles(coord_q, coord_r);

-- Ressources par Cercle (lazy evaluation)
CREATE TABLE resources (
  circle_id       UUID PRIMARY KEY REFERENCES circles(id) ON DELETE CASCADE,
  iron            DOUBLE PRECISION NOT NULL DEFAULT 500,
  essence         DOUBLE PRECISION NOT NULL DEFAULT 300,
  souls           DOUBLE PRECISION NOT NULL DEFAULT 0,
  iron_rate       DOUBLE PRECISION NOT NULL DEFAULT 30,    -- par heure
  essence_rate    DOUBLE PRECISION NOT NULL DEFAULT 20,
  souls_rate      DOUBLE PRECISION NOT NULL DEFAULT 0,
  iron_cap        DOUBLE PRECISION NOT NULL DEFAULT 10000,
  essence_cap     DOUBLE PRECISION NOT NULL DEFAULT 10000,
  souls_cap       DOUBLE PRECISION NOT NULL DEFAULT 5000,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bâtiments
CREATE TABLE buildings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id       UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  type            building_type NOT NULL,
  level           INT NOT NULL DEFAULT 0,
  upgrade_end     TIMESTAMPTZ,  -- NULL = pas en construction
  UNIQUE (circle_id, type)
);

-- Unités
CREATE TABLE units (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id   UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  type        unit_type NOT NULL,
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE (circle_id, type)
);

-- Légions (armées en mouvement)
CREATE TABLE legions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id       UUID NOT NULL REFERENCES players(id),
  from_circle_id  UUID NOT NULL REFERENCES circles(id),
  to_coord_q      INT NOT NULL,
  to_coord_r      INT NOT NULL,
  composition     JSONB NOT NULL DEFAULT '{}',  -- {"squelette_soldat": 100, ...}
  mission         mission_type NOT NULL,
  status          legion_status NOT NULL DEFAULT 'en_route',
  hero_id         UUID,  -- FK ajoutée après création heroes
  depart_time     TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrival_time    TIMESTAMPTZ NOT NULL,
  return_time     TIMESTAMPTZ,
  loot            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recherches
CREATE TABLE researches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type            research_type NOT NULL,
  level           INT NOT NULL DEFAULT 0,
  research_end    TIMESTAMPTZ,  -- NULL = pas en cours
  UNIQUE (player_id, type)
);

-- Héros
CREATE TABLE heroes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type        hero_type NOT NULL,
  level       INT NOT NULL DEFAULT 1,
  xp          INT NOT NULL DEFAULT 0,
  is_deployed BOOLEAN NOT NULL DEFAULT false,
  is_dead     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (player_id, type)
);

-- FK héros sur légions
ALTER TABLE legions
  ADD CONSTRAINT fk_legions_hero
  FOREIGN KEY (hero_id) REFERENCES heroes(id) ON DELETE SET NULL;

-- Alliances (Pactes Démoniaques)
CREATE TABLE alliances (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id   UUID NOT NULL REFERENCES servers(id),
  name        VARCHAR(64) NOT NULL,
  tag         VARCHAR(8) NOT NULL,
  leader_id   UUID NOT NULL REFERENCES players(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, name),
  UNIQUE (server_id, tag)
);

-- FK alliance sur players
ALTER TABLE players
  ADD CONSTRAINT fk_players_alliance
  FOREIGN KEY (alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;

-- Membres d'alliance
CREATE TABLE alliance_members (
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role        VARCHAR(16) NOT NULL DEFAULT 'member', -- leader, officer, member
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (alliance_id, player_id)
);

-- Relations diplomatiques
CREATE TABLE diplomacy (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alliance_a    UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  alliance_b    UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  status        diplomacy_status NOT NULL DEFAULT 'neutralite',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (alliance_a < alliance_b),
  UNIQUE (alliance_a, alliance_b)
);

-- Recherches d'alliance
CREATE TABLE alliance_researches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alliance_id     UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  type            VARCHAR(64) NOT NULL,
  level           INT NOT NULL DEFAULT 0,
  contributions   JSONB NOT NULL DEFAULT '{}',
  UNIQUE (alliance_id, type)
);

-- Rapports de combat
CREATE TABLE battle_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attacker_id     UUID NOT NULL REFERENCES players(id),
  defender_id     UUID REFERENCES players(id),  -- NULL pour PvE
  circle_id       UUID REFERENCES circles(id),
  outcome         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_battle_reports_attacker ON battle_reports(attacker_id, created_at DESC);
CREATE INDEX idx_battle_reports_defender ON battle_reports(defender_id, created_at DESC);

-- Rapports d'espionnage
CREATE TABLE spy_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spy_player_id   UUID NOT NULL REFERENCES players(id),
  target_circle_id UUID NOT NULL REFERENCES circles(id),
  level           INT NOT NULL DEFAULT 0,
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marché
CREATE TABLE market_offers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id       UUID NOT NULL REFERENCES players(id),
  target_id       UUID,  -- NULL = offre publique
  resource_from   VARCHAR(16) NOT NULL,
  resource_to     VARCHAR(16) NOT NULL,
  amount          INT NOT NULL CHECK (amount > 0 AND amount <= 50000),
  ratio           REAL NOT NULL CHECK (ratio > 0),
  is_accepted     BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Événements mondiaux
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id   UUID NOT NULL REFERENCES servers(id),
  type        VARCHAR(32) NOT NULL,  -- faille, invasion, raid
  coord_q     INT,
  coord_r     INT,
  hp_max      INT NOT NULL DEFAULT 0,
  hp_remaining INT NOT NULL DEFAULT 0,
  data        JSONB NOT NULL DEFAULT '{}',
  start_time  TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time    TIMESTAMPTZ NOT NULL
);

-- Forteresse de Pacte
CREATE TABLE fortress (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id       UUID NOT NULL REFERENCES servers(id),
  alliance_id     UUID REFERENCES alliances(id) ON DELETE SET NULL,
  coord_q         INT NOT NULL,
  coord_r         INT NOT NULL,
  hp              INT NOT NULL DEFAULT 1000000,
  controlled_since TIMESTAMPTZ,
  is_under_construction BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id)
);

-- Audit logs (admin)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL,
  action      VARCHAR(64) NOT NULL,
  target      VARCHAR(255),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Missions journalières
CREATE TABLE daily_missions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  missions    JSONB NOT NULL DEFAULT '[]',
  completed   INT NOT NULL DEFAULT 0,
  UNIQUE (player_id, day)
);

-- Sessions (refresh tokens)
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  refresh_token   VARCHAR(512) NOT NULL,
  user_agent      TEXT,
  ip_address      INET,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_player ON sessions(player_id);

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

-- Calcul de distance hexagonale (coordonnées axiales)
CREATE OR REPLACE FUNCTION hex_distance(q1 INT, r1 INT, q2 INT, r2 INT)
RETURNS INT AS $$
BEGIN
  RETURN (ABS(q1 - q2) + ABS(q1 + r1 - q2 - r2) + ABS(r1 - r2)) / 2;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mise à jour lazy des ressources
CREATE OR REPLACE FUNCTION update_resources(p_circle_id UUID)
RETURNS void AS $$
DECLARE
  delta_hours DOUBLE PRECISION;
  r resources%ROWTYPE;
BEGIN
  SELECT * INTO r FROM resources WHERE circle_id = p_circle_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  delta_hours := EXTRACT(EPOCH FROM (now() - r.last_updated_at)) / 3600.0;

  UPDATE resources SET
    iron = LEAST(r.iron + r.iron_rate * delta_hours, r.iron_cap),
    essence = LEAST(r.essence + r.essence_rate * delta_hours, r.essence_cap),
    souls = LEAST(r.souls + r.souls_rate * delta_hours, r.souls_cap),
    last_updated_at = now()
  WHERE circle_id = p_circle_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
