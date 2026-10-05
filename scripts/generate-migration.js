'use strict';

// Genera migrations/2026-09-28-multi-edicion.sql a partir de data/ediciones.js.
// Uso: node scripts/generate-migration.js
// El SQL generado es IDEMPOTENTE: puede ejecutarse tantas veces como se quiera
// sin duplicar datos ni pisar nada escrito por el admin.

const fs = require('fs');
const path = require('path');
const { EDICIONES } = require('../data/ediciones');

const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

const out = [];
out.push(`-- Migración del modelo multi-edición del Hexagonal Panamá Pacífico.
-- Generada por scripts/generate-migration.js a partir de data/ediciones.js.
-- IDEMPOTENTE: puede ejecutarse varias veces sin duplicar nada.
--
-- Nota: si la base de datos tiene las tablas de la primera edición del
-- torneo (resultados, goleadores con esquema antiguo, tarjetas), esas tablas
-- y sus filas se limpian con scripts/purge-primera-edicion.js; esta migración
-- no las usa ni las toca (solo amplía goleadores con las columnas nuevas).

BEGIN;

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

-- Goleadores: en una base nueva se crea directamente con el esquema actual;
-- si la tabla ya existía (esquema de la primera edición del torneo), los
-- ALTER de debajo le añaden las columnas que faltan.
CREATE TABLE IF NOT EXISTS goleadores (
  id     SERIAL PRIMARY KEY,
  player TEXT NOT NULL,
  team   TEXT,
  goals  INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS edicion_id INTEGER REFERENCES ediciones(id);
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS partido_id INTEGER REFERENCES partidos(id);
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS equipo_id  INTEGER REFERENCES equipos(id);

-- Escudos subidos desde el panel de admin (se sirven en /api/logos/:id).
CREATE TABLE IF NOT EXISTS logos (
  id   SERIAL PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL
);

-- Expulsiones por equipo y partido, distinguiendo roja directa de doble
-- amarilla. Cuentan para el 5º criterio de desempate de la clasificación.
CREATE TABLE IF NOT EXISTS expulsiones (
  id         SERIAL PRIMARY KEY,
  edicion_id INTEGER NOT NULL REFERENCES ediciones(id),
  partido_id INTEGER REFERENCES partidos(id),
  equipo_id  INTEGER NOT NULL REFERENCES equipos(id),
  jugador    TEXT,
  tipo       TEXT NOT NULL CHECK (tipo IN ('roja', 'doble-amarilla'))
);
`);

for (const ed of EDICIONES) {
  const eid = `(SELECT id FROM ediciones WHERE slug = ${q(ed.slug)})`;
  out.push(`
-- Edición ${ed.nombre}
INSERT INTO ediciones (nombre, nombre_corto, slug, fecha_inicio, fecha_fin, activa, archivada, info)
  SELECT ${q(ed.nombre)}, ${q(ed.nombreCorto)}, ${q(ed.slug)}, ${q(ed.fechaInicio)}, ${q(ed.fechaFin)}, ${ed.activa}, ${ed.archivada}, ${q(JSON.stringify(ed.info))}::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM ediciones WHERE slug = ${q(ed.slug)});
-- El bloque de normas (info) lo gobierna el código: se actualiza siempre.
UPDATE ediciones SET info = ${q(JSON.stringify(ed.info))}::jsonb WHERE slug = ${q(ed.slug)};`);

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
      if (p.resultado) {
        // Solo rellena marcadores vacíos: nunca pisa lo guardado por el admin.
        out.push(`UPDATE partidos SET home_goals = ${p.resultado.home}, away_goals = ${p.resultado.away}
  WHERE edicion_id = ${eid} AND match_key = ${q(p.key)}
    AND home_goals IS NULL AND away_goals IS NULL;`);
      }
      if (p.goleadores && p.goleadores.length) {
        // Los goleadores de un partido solo se siembran si ese partido aún no
        // tiene ninguno (no duplica en reinicios ni pisa lo que cargue el admin).
        const pid = `(SELECT id FROM partidos WHERE edicion_id = ${eid} AND match_key = ${q(p.key)})`;
        const values = p.goleadores
          .map((g) => `(${q(g.player)}, ${q(g.equipo)}, ${g.goals})`)
          .join(',\n          ');
        out.push(`INSERT INTO goleadores (player, team, goals, edicion_id, partido_id, equipo_id)
  SELECT v.player, v.team, v.goals, ${eid}, ${pid},
         (SELECT id FROM equipos WHERE edicion_id = ${eid} AND nombre = v.team)
  FROM (VALUES ${values}) AS v(player, team, goals)
  WHERE NOT EXISTS (
    SELECT 1 FROM goleadores WHERE edicion_id = ${eid} AND partido_id = ${pid}
  );`);
      }
    }
  }

  for (const x of ed.expulsiones || []) {
    const pid = `(SELECT id FROM partidos WHERE edicion_id = ${eid} AND match_key = ${q(x.partido)})`;
    const qid = `(SELECT id FROM equipos  WHERE edicion_id = ${eid} AND nombre = ${q(x.equipo)})`;
    out.push(`INSERT INTO expulsiones (edicion_id, partido_id, equipo_id, jugador, tipo)
  SELECT ${eid}, ${pid}, ${qid}, ${q(x.jugador || null)}, ${q(x.tipo)}
  WHERE NOT EXISTS (
    SELECT 1 FROM expulsiones
    WHERE edicion_id = ${eid} AND partido_id = ${pid} AND equipo_id = ${qid} AND tipo = ${q(x.tipo)}
  );`);
  }
}

out.push('\nCOMMIT;');

const dest = path.join(__dirname, '..', 'migrations', '2026-09-28-multi-edicion.sql');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out.join('\n') + '\n');
console.log('Migración generada en', dest);
