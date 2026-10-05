-- Migración del modelo multi-edición del Hexagonal Panamá Pacífico.
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


-- Edición Hexagonal Panamá Pacífico – Octubre-Noviembre 2026
INSERT INTO ediciones (nombre, nombre_corto, slug, fecha_inicio, fecha_fin, activa, archivada, info)
  SELECT 'Hexagonal Panamá Pacífico – Octubre-Noviembre 2026', 'Octubre-Noviembre 2026', '2026-oct-nov', '2026-10-04', '2026-11-29', true, false, '{"sede":"Sport Park, Panamá Pacífico (cancha F11)","dias":"Domingos por la mañana","turnos":["Turno 1 · 7:00 – 8:00","Turno 2 · 8:15 – 9:15","Turno 3 · 9:30 – 10:30"],"formato":["Liguilla todos contra todos a una sola vuelta: 5 jornadas, 3 partidos por jornada, 15 partidos.","Clasifican los 4 primeros a semifinales: 1º vs 4º y 2º vs 3º.","Final entre los ganadores de las semifinales. No hay partido por el tercer puesto.","Sin partidos el 1 y el 8 de noviembre (Fiestas Patrias).","En caso de empate en semifinales o final, el partido se decide por penaltis."],"desempate":["Puntos (victoria 3, empate 1, derrota 0)","Diferencia de goles","Goles a favor","Enfrentamiento directo","Tarjetas rojas: en caso de persistir el empate, se clasificará por delante el equipo con menos expulsiones acumuladas en el torneo (roja directa o doble amarilla)."],"disciplina":["Tarjeta roja directa: el jugador es expulsado del partido y cumplirá un partido de suspensión, que será el siguiente encuentro que dispute su equipo.","Doble amarilla: el jugador es expulsado del partido en curso, pero no acarrea suspensión adicional; podrá jugar el siguiente encuentro."]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM ediciones WHERE slug = '2026-oct-nov');
-- El bloque de normas (info) lo gobierna el código: se actualiza siempre.
UPDATE ediciones SET info = '{"sede":"Sport Park, Panamá Pacífico (cancha F11)","dias":"Domingos por la mañana","turnos":["Turno 1 · 7:00 – 8:00","Turno 2 · 8:15 – 9:15","Turno 3 · 9:30 – 10:30"],"formato":["Liguilla todos contra todos a una sola vuelta: 5 jornadas, 3 partidos por jornada, 15 partidos.","Clasifican los 4 primeros a semifinales: 1º vs 4º y 2º vs 3º.","Final entre los ganadores de las semifinales. No hay partido por el tercer puesto.","Sin partidos el 1 y el 8 de noviembre (Fiestas Patrias).","En caso de empate en semifinales o final, el partido se decide por penaltis."],"desempate":["Puntos (victoria 3, empate 1, derrota 0)","Diferencia de goles","Goles a favor","Enfrentamiento directo","Tarjetas rojas: en caso de persistir el empate, se clasificará por delante el equipo con menos expulsiones acumuladas en el torneo (roja directa o doble amarilla)."],"disciplina":["Tarjeta roja directa: el jugador es expulsado del partido y cumplirá un partido de suspensión, que será el siguiente encuentro que dispute su equipo.","Doble amarilla: el jugador es expulsado del partido en curso, pero no acarrea suspensión adicional; podrá jugar el siguiente encuentro."]}'::jsonb WHERE slug = '2026-oct-nov';
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
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1), 'j1-2', '7:00', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Deportivo Amarillo'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'New Generation'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-2');
UPDATE partidos SET home_goals = 3, away_goals = 0
  WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-2'
    AND home_goals IS NULL AND away_goals IS NULL;
INSERT INTO goleadores (player, team, goals, edicion_id, partido_id, equipo_id)
  SELECT v.player, v.team, v.goals, (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-2'),
         (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = v.team)
  FROM (VALUES ('Omar Anderson', 'Deportivo Amarillo', 1),
          ('Robinson Zarco', 'Deportivo Amarillo', 1),
          ('Ricardo Dubois', 'Deportivo Amarillo', 1)) AS v(player, team, goals)
  WHERE NOT EXISTS (
    SELECT 1 FROM goleadores WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND partido_id = (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-2')
  );
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1), 'j1-1', '8:15', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Panamá Pacífico Residentes'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1');
UPDATE partidos SET home_goals = 1, away_goals = 0
  WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1'
    AND home_goals IS NULL AND away_goals IS NULL;
INSERT INTO goleadores (player, team, goals, edicion_id, partido_id, equipo_id)
  SELECT v.player, v.team, v.goals, (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1'),
         (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = v.team)
  FROM (VALUES ('Iñigo Lanz', 'Panamá Pacífico Residentes', 1)) AS v(player, team, goals)
  WHERE NOT EXISTS (
    SELECT 1 FROM goleadores WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND partido_id = (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1')
  );
INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM jornadas WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND orden = 1), 'j1-3', '9:30', (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Baviera FC'), (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'Cludsa FC'), NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-3');
UPDATE partidos SET home_goals = 3, away_goals = 2
  WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-3'
    AND home_goals IS NULL AND away_goals IS NULL;
INSERT INTO goleadores (player, team, goals, edicion_id, partido_id, equipo_id)
  SELECT v.player, v.team, v.goals, (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-3'),
         (SELECT id FROM equipos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = v.team)
  FROM (VALUES ('Felipe Olivardia', 'Baviera FC', 2),
          ('Blas Garrido', 'Baviera FC', 1),
          ('Julio Jackson', 'Cludsa FC', 2)) AS v(player, team, goals)
  WHERE NOT EXISTS (
    SELECT 1 FROM goleadores WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND partido_id = (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-3')
  );
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
INSERT INTO expulsiones (edicion_id, partido_id, equipo_id, jugador, tipo)
  SELECT (SELECT id FROM ediciones WHERE slug = '2026-oct-nov'), (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1'), (SELECT id FROM equipos  WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC'), NULL, 'doble-amarilla'
  WHERE NOT EXISTS (
    SELECT 1 FROM expulsiones
    WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND partido_id = (SELECT id FROM partidos WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND match_key = 'j1-1') AND equipo_id = (SELECT id FROM equipos  WHERE edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov') AND nombre = 'La10 West FC') AND tipo = 'doble-amarilla'
  );

COMMIT;
