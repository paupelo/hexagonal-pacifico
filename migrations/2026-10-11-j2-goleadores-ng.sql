-- Goleadores de New Generation en el 2-5 contra La10 West (J2), que habían
-- quedado pendientes: Abiel y Ernesto Apolayo. Idempotente: solo inserta si
-- New Generation aún no tiene ningún goleador registrado en ese partido
-- (los de La10 West ya existen y no se tocan).

INSERT INTO goleadores (player, team, goals, edicion_id, partido_id, equipo_id)
SELECT v.player, q.nombre, 1, e.id, p.id, q.id
FROM (VALUES ('Abiel'), ('Ernesto Apolayo')) AS v(player)
JOIN ediciones e ON e.slug = '2026-oct-nov'
JOIN partidos  p ON p.edicion_id = e.id AND p.match_key = 'j2-3'
JOIN equipos   q ON q.edicion_id = e.id AND q.nombre = 'New Generation'
WHERE NOT EXISTS (
  SELECT 1 FROM goleadores g WHERE g.partido_id = p.id AND g.equipo_id = q.id
);
