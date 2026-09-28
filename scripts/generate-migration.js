'use strict';

// Genera migrations/2026-09-28-multi-edicion.sql a partir de data/ediciones.js.
// Uso: node scripts/generate-migration.js
// El SQL generado es IDEMPOTENTE: puede ejecutarse tantas veces como se quiera
// sin duplicar datos ni pisar nada escrito por el admin.

const fs = require('fs');
const path = require('path');
const { EDICIONES, LEGACY_RESULTS, LEGACY_SCORERS, LEGACY_CARDS, SLUG_ARCHIVADA } = require('../data/ediciones');

const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'NULL' : Number(v));

const out = [];
out.push(`-- Migración multi-edición del Hexagonal Panamá Pacífico.
-- Generada por scripts/generate-migration.js a partir de data/ediciones.js.
-- IDEMPOTENTE y NO DESTRUCTIVA: no borra ni renombra nada; las tablas legadas
-- (resultados, goleadores, tarjetas) se conservan y sus datos se COPIAN al
-- nuevo modelo. Puede ejecutarse varias veces sin efectos secundarios.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tablas legadas (por si la base de datos es nueva y no existen aún).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resultados (
  match_id   TEXT PRIMARY KEY,
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS goleadores (
  id       SERIAL PRIMARY KEY,
  player   TEXT NOT NULL,
  team     TEXT NOT NULL,
  goals    INTEGER NOT NULL DEFAULT 0,
  match_id TEXT
);
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS match_id TEXT;
CREATE TABLE IF NOT EXISTS tarjetas (
  id     SERIAL PRIMARY KEY,
  player TEXT NOT NULL,
  team   TEXT NOT NULL,
  type   TEXT NOT NULL CHECK (type IN ('amarilla', 'roja'))
);

-- ---------------------------------------------------------------------------
-- 2. Nuevo modelo multi-edición.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ediciones (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL,
  nombre_corto TEXT,
  slug         TEXT NOT NULL UNIQUE,
  fecha_inicio DATE,
  fecha_fin    DATE,
  activa       BOOLEAN NOT NULL DEFAULT FALSE,
  archivada    BOOLEAN NOT NULL DEFAULT FALSE,
  info         JSONB
);

CREATE TABLE IF NOT EXISTS equipos (
  id             SERIAL PRIMARY KEY,
  edicion_id     INTEGER NOT NULL REFERENCES ediciones(id),
  nombre         TEXT NOT NULL,
  logo_url       TEXT,
  posicion_final INTEGER,
  UNIQUE (edicion_id, nombre)
);

CREATE TABLE IF NOT EXISTS jornadas (
  id         SERIAL PRIMARY KEY,
  edicion_id INTEGER NOT NULL REFERENCES ediciones(id),
  orden      INTEGER NOT NULL,
  label      TEXT NOT NULL,
  fecha      TEXT,
  tipo       TEXT NOT NULL DEFAULT 'liga' CHECK (tipo IN ('liga', 'semifinal', 'final', 'descanso')),
  nota       TEXT,
  UNIQUE (edicion_id, orden)
);

CREATE TABLE IF NOT EXISTS partidos (
  id             SERIAL PRIMARY KEY,
  edicion_id     INTEGER NOT NULL REFERENCES ediciones(id),
  jornada_id     INTEGER NOT NULL REFERENCES jornadas(id),
  match_key      TEXT NOT NULL,
  hora           TEXT,
  home_equipo_id INTEGER REFERENCES equipos(id),
  away_equipo_id INTEGER REFERENCES equipos(id),
  home_label     TEXT,
  away_label     TEXT,
  home_goals     INTEGER,
  away_goals     INTEGER,
  penales_home   INTEGER,
  penales_away   INTEGER,
  UNIQUE (edicion_id, match_key)
);

-- Escudos subidos desde el panel de admin (se sirven en /api/logos/:id).
CREATE TABLE IF NOT EXISTS logos (
  id   SERIAL PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL
);

-- edicion_id en TODAS las tablas de datos (las legadas incluidas).
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS edicion_id INTEGER REFERENCES ediciones(id);
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS partido_id INTEGER REFERENCES partidos(id);
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS equipo_id  INTEGER REFERENCES equipos(id);
ALTER TABLE tarjetas   ADD COLUMN IF NOT EXISTS edicion_id INTEGER REFERENCES ediciones(id);
ALTER TABLE tarjetas   ADD COLUMN IF NOT EXISTS equipo_id  INTEGER REFERENCES equipos(id);
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS edicion_id INTEGER REFERENCES ediciones(id);
`);

// ---------------------------------------------------------------------------
// 3. Seeds legados de la primera edición (solo insertan lo que falte).
// ---------------------------------------------------------------------------
out.push('-- ---------------------------------------------------------------------------');
out.push('-- 3. Seeds legados de la primera edición (idempotentes, no pisan al admin).');
out.push('-- ---------------------------------------------------------------------------');
for (const r of LEGACY_RESULTS) {
  out.push(
    `INSERT INTO resultados (match_id, home_goals, away_goals) VALUES (${q(r.match_id)}, ${n(r.home_goals)}, ${n(r.away_goals)}) ON CONFLICT (match_id) DO NOTHING;`
  );
}
const legacyMatches = [...new Set(LEGACY_SCORERS.map((s) => s.match_id))];
for (const matchId of legacyMatches) {
  const rows = LEGACY_SCORERS.filter((s) => s.match_id === matchId)
    .map((s) => `(${q(s.player)}, ${q(s.team)}, ${n(s.goals)}, ${q(s.match_id)})`)
    .join(',\n         ');
  out.push(`INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ${rows}) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = ${q(matchId)});`);
}
for (const c of LEGACY_CARDS) {
  out.push(`INSERT INTO tarjetas (player, team, type)
  SELECT ${q(c.player)}, ${q(c.team)}, ${q(c.type)}
  WHERE NOT EXISTS (SELECT 1 FROM tarjetas WHERE player = ${q(c.player)} AND team = ${q(c.team)} AND type = ${q(c.type)});`);
}

// ---------------------------------------------------------------------------
// 4. Ediciones, equipos, jornadas y partidos.
// ---------------------------------------------------------------------------
out.push('');
out.push('-- ---------------------------------------------------------------------------');
out.push('-- 4. Ediciones, equipos, jornadas y partidos.');
out.push('-- ---------------------------------------------------------------------------');
for (const ed of EDICIONES) {
  const eid = `(SELECT id FROM ediciones WHERE slug = ${q(ed.slug)})`;
  out.push(`
-- Edición ${ed.nombre}
INSERT INTO ediciones (nombre, nombre_corto, slug, fecha_inicio, fecha_fin, activa, archivada, info)
  SELECT ${q(ed.nombre)}, ${q(ed.nombreCorto)}, ${q(ed.slug)}, ${q(ed.fechaInicio)}, ${q(ed.fechaFin)}, ${ed.activa}, ${ed.archivada}, ${q(JSON.stringify(ed.info))}::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM ediciones WHERE slug = ${q(ed.slug)});`);

  for (const t of ed.equipos) {
    out.push(`INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT ${eid}, ${q(t.nombre)}, ${q(t.logo)}
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = ${eid} AND nombre = ${q(t.nombre)});`);
  }

  for (const j of ed.jornadas) {
    out.push(`INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT ${eid}, ${j.orden}, ${q(j.label)}, ${q(j.fecha)}, ${q(j.tipo)}, ${q(j.nota || null)}
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = ${eid} AND orden = ${j.orden});`);
    for (const p of j.partidos) {
      const homeId = p.home ? `(SELECT id FROM equipos WHERE edicion_id = ${eid} AND nombre = ${q(p.home)})` : 'NULL';
      const awayId = p.away ? `(SELECT id FROM equipos WHERE edicion_id = ${eid} AND nombre = ${q(p.away)})` : 'NULL';
      out.push(`INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT ${eid}, (SELECT id FROM jornadas WHERE edicion_id = ${eid} AND orden = ${j.orden}), ${q(p.key)}, ${q(p.hora)}, ${homeId}, ${awayId}, ${q(p.homeLabel || null)}, ${q(p.awayLabel || null)}
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = ${eid} AND match_key = ${q(p.key)});`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Copia de los datos legados hacia la edición archivada.
// ---------------------------------------------------------------------------
const OLD = `(SELECT id FROM ediciones WHERE slug = ${q(SLUG_ARCHIVADA)})`;
out.push(`
-- ---------------------------------------------------------------------------
-- 5. Asignar TODOS los registros legados a la edición ${SLUG_ARCHIVADA}
--    y copiar los marcadores a partidos. Solo toca filas aún sin asignar.
-- ---------------------------------------------------------------------------
UPDATE resultados SET edicion_id = ${OLD} WHERE edicion_id IS NULL;

UPDATE partidos p SET home_goals = r.home_goals, away_goals = r.away_goals
  FROM resultados r
  WHERE p.edicion_id = ${OLD}
    AND r.match_id = p.match_key
    AND p.home_goals IS NULL AND p.away_goals IS NULL;

UPDATE goleadores g SET
    edicion_id = ${OLD},
    partido_id = (SELECT p.id FROM partidos p WHERE p.edicion_id = ${OLD} AND p.match_key = g.match_id),
    equipo_id  = (SELECT e.id FROM equipos  e WHERE e.edicion_id = ${OLD} AND e.nombre   = g.team)
  WHERE g.edicion_id IS NULL;

UPDATE tarjetas t SET
    edicion_id = ${OLD},
    equipo_id  = (SELECT e.id FROM equipos e WHERE e.edicion_id = ${OLD} AND e.nombre = t.team)
  WHERE t.edicion_id IS NULL;

COMMIT;
`);

const dest = path.join(__dirname, '..', 'migrations', '2026-09-28-multi-edicion.sql');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out.join('\n') + '\n');
console.log('Migración generada en', dest);
