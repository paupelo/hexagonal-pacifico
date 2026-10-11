-- Corrección de las expulsiones del Panamá Pacífico 4-3 Baviera (J2):
-- Panamá Pacífico tuvo 1 roja directa y 1 doble amarilla, no 2 rojas
-- directas. Convierte una de las dos rojas sembradas en doble amarilla.
-- Idempotente: solo actúa si ese partido+equipo aún no tiene ninguna
-- doble amarilla registrada. La roja de Baviera queda como estaba.

UPDATE expulsiones SET tipo = 'doble-amarilla'
WHERE id = (
  SELECT max(x.id)
  FROM expulsiones x
  JOIN ediciones e ON e.id = x.edicion_id AND e.slug = '2026-oct-nov'
  JOIN partidos  p ON p.id = x.partido_id AND p.match_key = 'j2-2'
  JOIN equipos   q ON q.id = x.equipo_id  AND q.nombre = 'Panamá Pacífico Residentes'
  WHERE x.tipo = 'roja'
)
AND NOT EXISTS (
  SELECT 1
  FROM expulsiones x2
  JOIN ediciones e2 ON e2.id = x2.edicion_id AND e2.slug = '2026-oct-nov'
  JOIN partidos  p2 ON p2.id = x2.partido_id AND p2.match_key = 'j2-2'
  JOIN equipos   q2 ON q2.id = x2.equipo_id  AND q2.nombre = 'Panamá Pacífico Residentes'
  WHERE x2.tipo = 'doble-amarilla'
);
