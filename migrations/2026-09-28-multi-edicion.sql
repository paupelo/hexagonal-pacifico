-- Migración multi-edición del Hexagonal Panamá Pacífico.
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

-- ---------------------------------------------------------------------------
-- 3. Seeds legados de la primera edición (idempotentes, no pisan al admin).
-- ---------------------------------------------------------------------------
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j1-1', 2, 2) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j1-2', 0, 4) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j2-1', 0, 3) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j2-2', 0, 3) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j2-3', 4, 1) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j3-1', 2, 1) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j3-2', 0, 4) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j4-1', 3, 1) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j4-2', 1, 0) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j5-1', 3, 0) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j5-2', 2, 2) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j5-3', 1, 5) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j6-1', 2, 0) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j6-2', 3, 1) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('j6-3', 1, 3) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('sf-1', 0, 2) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO resultados (match_id, home_goals, away_goals) VALUES ('sf-2', 1, 2) ON CONFLICT (match_id) DO NOTHING;
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Julián Dueñas', 'Panamá Pacífico Residentes FC', 1, 'j1-1'),
         ('Luis Stanziola', 'Panamá Pacífico Residentes FC', 1, 'j1-1'),
         ('Londres López', 'Hermandad FC', 1, 'j1-1'),
         ('Silvano Nicholson', 'Hermandad FC', 1, 'j1-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j1-1');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Gerardo Jiménez', 'Deportivo Amarillo', 1, 'j1-2'),
         ('José Pinnock', 'Deportivo Amarillo', 1, 'j1-2'),
         ('Octavio Maravilla', 'Deportivo Amarillo', 1, 'j1-2'),
         ('Ricardo Dubois', 'Deportivo Amarillo', 1, 'j1-2')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j1-2');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Rubén Córdoba', 'Cludsa FC', 1, 'j2-1'),
         ('Iansen Carrillo', 'Cludsa FC', 1, 'j2-1'),
         ('Julio Joyce', 'Cludsa FC', 1, 'j2-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j2-1');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Silvano Nicholson', 'Hermandad FC', 2, 'j2-2'),
         ('Federico Cotter', 'Hermandad FC', 1, 'j2-2')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j2-2');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Luis Rodríguez', 'New Generation PPFC', 2, 'j2-3'),
         ('Ricaurte Cárdenas', 'New Generation PPFC', 1, 'j2-3'),
         ('Alex Delgado', 'New Generation PPFC', 1, 'j2-3'),
         ('Héctor Carrillo', 'Futbirria Amigos', 1, 'j2-3')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j2-3');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Paulo Ramos', 'Panamá Pacífico Residentes FC', 1, 'j3-1'),
         ('Luis Stanziola', 'Panamá Pacífico Residentes FC', 1, 'j3-1'),
         ('Luis Rodríguez', 'New Generation PPFC', 1, 'j3-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j3-1');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Jonathan Botacio', 'Deportivo Amarillo', 2, 'j4-1'),
         ('Robinson Zarco', 'Deportivo Amarillo', 1, 'j4-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j4-1');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Silvano Nicholson', 'Hermandad FC', 1, 'j4-2')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j4-2');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Dinnick Salerno', 'Deportivo Amarillo', 1, 'j5-1'),
         ('Jonathan Botacio', 'Deportivo Amarillo', 1, 'j5-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j5-1');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Rodrigo Grattulini', 'Panamá Pacífico Residentes FC', 1, 'j5-2'),
         ('Julián Dueñas', 'Panamá Pacífico Residentes FC', 1, 'j5-2')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j5-2');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Nicolás Muñoz', 'Hermandad FC', 1, 'j6-1'),
         ('José Alcázar', 'Hermandad FC', 1, 'j6-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j6-1');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Ricardo Dubois', 'Deportivo Amarillo', 2, 'j6-3'),
         ('Jonathan Botacio', 'Deportivo Amarillo', 1, 'j6-3'),
         ('Jorge Geo', 'Panamá Pacífico Residentes FC', 1, 'j6-3')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'j6-3');
INSERT INTO goleadores (player, team, goals, match_id)
  SELECT * FROM (VALUES ('Jefferson García', 'Panamá Pacífico Residentes FC', 1, 'sf-1'),
         ('Jan Branicki', 'Panamá Pacífico Residentes FC', 1, 'sf-1')) AS v(player, team, goals, match_id)
  WHERE NOT EXISTS (SELECT 1 FROM goleadores WHERE match_id = 'sf-1');
INSERT INTO tarjetas (player, team, type)
  SELECT 'Jugador Hermandad (doble amarilla)', 'Hermandad FC', 'roja'
  WHERE NOT EXISTS (SELECT 1 FROM tarjetas WHERE player = 'Jugador Hermandad (doble amarilla)' AND team = 'Hermandad FC' AND type = 'roja');

-- ---------------------------------------------------------------------------
-- 4. Ediciones, equipos, jornadas y partidos.
-- ---------------------------------------------------------------------------

-- Edición Hexagonal Panamá Pacífico – Julio-Agosto 2026
INSERT INTO ediciones (nombre, nombre_corto, slug, fecha_inicio, fecha_fin, activa, archivada, info)
  SELECT 'Hexagonal Panamá Pacífico – Julio-Agosto 2026', 'Julio-Agosto 2026', '2026-jul-ago', '2026-07-12', '2026-08-30', false, true, '{"sede":"Sport Park, Panamá Pacífico","dias":"Domingos por la mañana","turnos":["Jornadas de 3 partidos: 7:00, 8:15 y 9:30","Jornadas de 2 partidos: 7:30 y 8:45"],"formato":["Liguilla todos contra todos a una sola vuelta: 6 equipos, 6 jornadas y 15 partidos.","Clasifican los 4 primeros a semifinales: 1º vs 4º y 2º vs 3º.","Final entre los ganadores de las semifinales."],"desempate":["Puntos (victoria 3, empate 1, derrota 0)","Enfrentamiento directo","Diferencia de goles","Goles a favor","Fair play (menos tarjetas rojas)","Orden alfabético"]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM ediciones WHERE slug = '2026-jul-ago');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 'Panamá Pacífico Residentes FC', '/escudos/panama-pacifico.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 'Cludsa FC', '/escudos/cludsa.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 'Deportivo Amarillo', '/escudos/escudo-amarillo-fc.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 'Hermandad FC', '/escudos/hermandad.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 'New Generation PPFC', '/escudos/new-generation.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'New Generation PPFC');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 'Futbirria Amigos', '/escudos/futbirria-amigos.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Futbirria Amigos');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 1, 'Jornada 1', 'Domingo 12 de julio de 2026', 'liga', 'Descansan: New Generation PPFC y Futbirria Amigos'
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 1);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 1), 'j1-1', '7:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j1-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 1), 'j1-2', '9:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j1-2');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 2, 'Jornada 2', 'Domingo 19 de julio de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 2);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 2), 'j2-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j2-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 2), 'j2-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j2-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 2), 'j2-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'New Generation PPFC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Futbirria Amigos'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j2-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 3, 'Jornada 3', 'Domingo 26 de julio de 2026', 'liga', 'Descansan: Deportivo Amarillo y Hermandad FC'
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 3);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 3), 'j3-1', '7:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'New Generation PPFC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j3-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 3), 'j3-2', '8:45', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Futbirria Amigos'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j3-2');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 4, 'Jornada 4', 'Domingo 2 de agosto de 2026', 'liga', 'Descansan: Panamá Pacífico Residentes FC y Cludsa FC'
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 4);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 4), 'j4-1', '7:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Futbirria Amigos'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j4-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 4), 'j4-2', '8:45', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'New Generation PPFC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j4-2');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 5, 'Jornada 5', 'Domingo 9 de agosto de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 5);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 5), 'j5-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'New Generation PPFC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j5-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 5), 'j5-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Futbirria Amigos'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j5-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 5), 'j5-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j5-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 6, 'Jornada 6', 'Domingo 16 de agosto de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 6);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 6), 'j6-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Futbirria Amigos'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j6-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 6), 'j6-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'New Generation PPFC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j6-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 6), 'j6-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'j6-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 7, 'Semifinales', 'Domingo 23 de agosto de 2026', 'semifinal', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 7);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 7), 'sf-1', '7:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Hermandad FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'sf-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 7), 'sf-2', '8:45', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'sf-2');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), 8, 'Final', 'Domingo 30 de agosto de 2026', 'final', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 8);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND orden = 8), 'final', '8:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Panamá Pacífico Residentes FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND match_key = 'final');

-- Edición Hexagonal Panamá Pacífico – Octubre-Noviembre 2026
INSERT INTO ediciones (nombre, nombre_corto, slug, fecha_inicio, fecha_fin, activa, archivada, info)
  SELECT 'Hexagonal Panamá Pacífico – Octubre-Noviembre 2026', 'Octubre-Noviembre 2026', '2026-oct-nov', '2026-10-04', '2026-11-29', true, false, '{"sede":"Sport Park, Panamá Pacífico (cancha F11)","dias":"Domingos por la mañana","turnos":["Turno 1 · 7:00 – 8:00","Turno 2 · 8:15 – 9:15","Turno 3 · 9:30 – 10:30"],"formato":["Liguilla todos contra todos a una sola vuelta: 5 jornadas, 3 partidos por jornada, 15 partidos.","Clasifican los 4 primeros a semifinales: 1º vs 4º y 2º vs 3º.","Final entre los ganadores de las semifinales. No hay partido por el tercer puesto.","Sin partidos el 1 y el 8 de noviembre (Fiestas Patrias).","En caso de empate en semifinales o final, el partido se decide por penaltis."],"desempate":["Puntos (victoria 3, empate 1, derrota 0)","Diferencia de goles","Goles a favor","Enfrentamiento directo","Orden alfabético"]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM ediciones WHERE slug = '2026-oct-nov');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 'Cludsa FC', '/escudos/cludsa.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 'Panamá Pacífico Residentes', '/escudos/panama-pacifico.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 'New Generation', '/escudos/new-generation.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 'La10 West FC', '/escudos/la10-west-fc.png'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 'Deportivo Amarillo', '/escudos/escudo-amarillo-fc.jpeg'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo');
INSERT INTO equipos (edicion_id, nombre, logo_url)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 'Baviera FC', '/escudos/baviera-fc.png'
  WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 1, 'Jornada 1', 'Domingo 4 de octubre de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1), 'j1-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1), 'j1-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1), 'j1-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 2, 'Jornada 2', 'Domingo 11 de octubre de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 2);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 2), 'j2-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j2-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 2), 'j2-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j2-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 2), 'j2-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j2-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 3, 'Jornada 3', 'Domingo 18 de octubre de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 3);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 3), 'j3-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j3-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 3), 'j3-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j3-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 3), 'j3-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j3-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 4, 'Jornada 4', 'Domingo 25 de octubre de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 4);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 4), 'j4-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j4-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 4), 'j4-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j4-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 4), 'j4-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j4-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 5, 'Fiestas Patrias', 'Domingos 1 y 8 de noviembre de 2026', 'descanso', 'Sin partidos por las Fiestas Patrias.'
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 5);
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 6, 'Jornada 5', 'Domingo 15 de noviembre de 2026', 'liga', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 6);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 6), 'j5-1', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j5-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 6), 'j5-2', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j5-2');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 6), 'j5-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j5-3');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 7, 'Semifinales', 'Domingo 22 de noviembre de 2026', 'semifinal', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 7);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 7), 'sf-1', '7:30', NULL, NULL, '1º clasificado', '4º clasificado'
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'sf-1');
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 7), 'sf-2', '8:45', NULL, NULL, '2º clasificado', '3º clasificado'
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'sf-2');
INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), 8, 'Final', 'Domingo 29 de noviembre de 2026', 'final', NULL
  WHERE NOT EXISTS (SELECT 1 FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 8);
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 8), 'final', '8:00', NULL, NULL, 'Ganador Semifinal 1', 'Ganador Semifinal 2'
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'final');

-- ---------------------------------------------------------------------------
-- 5. Asignar TODOS los registros legados a la edición 2026-jul-ago
--    y copiar los marcadores a partidos. Solo toca filas aún sin asignar.
-- ---------------------------------------------------------------------------
UPDATE resultados SET edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') WHERE edicion_id IS NULL;

UPDATE partidos p SET home_goals = r.home_goals, away_goals = r.away_goals
  FROM resultados r
  WHERE p.edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago')
    AND r.match_id = p.match_key
    AND p.home_goals IS NULL AND p.away_goals IS NULL;

UPDATE goleadores g SET
    edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'),
    partido_id = (SELECT p.id FROM partidos p WHERE p.edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND p.match_key = g.match_id),
    equipo_id  = (SELECT e.id FROM equipos  e WHERE e.edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND e.nombre   = g.team)
  WHERE g.edicion_id IS NULL;

UPDATE tarjetas t SET
    edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago'),
    equipo_id  = (SELECT e.id FROM equipos e WHERE e.edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-jul-ago') AND e.nombre = t.team)
  WHERE t.edicion_id IS NULL;

COMMIT;

