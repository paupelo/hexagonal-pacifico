-- Purga de los datos de la PRIMERA edición del torneo (Julio-Agosto 2026).
-- El torneo arranca de cero con la edición Octubre-Noviembre 2026: se
-- eliminan las tablas legadas (resultados, tarjetas), las filas legadas de
-- goleadores y cualquier resto de la edición 2026-jul-ago en el modelo nuevo.
--
-- ATENCIÓN: esta migración es DESTRUCTIVA a propósito (decisión del
-- 2026-09-28) e idempotente: en una base ya purgada no hace nada.

BEGIN;

-- Restos de la edición 2026-jul-ago en el modelo multi-edición, si los hubiera.
DELETE FROM goleadores WHERE edicion_id IN (SELECT id FROM ediciones WHERE slug = '2026-jul-ago');
DELETE FROM partidos   WHERE edicion_id IN (SELECT id FROM ediciones WHERE slug = '2026-jul-ago');
DELETE FROM jornadas   WHERE edicion_id IN (SELECT id FROM ediciones WHERE slug = '2026-jul-ago');
DELETE FROM equipos    WHERE edicion_id IN (SELECT id FROM ediciones WHERE slug = '2026-jul-ago');
DELETE FROM ediciones  WHERE slug = '2026-jul-ago';

-- Goleadores legados (sin edición asignada) y su columna de la época.
DELETE FROM goleadores WHERE edicion_id IS NULL;
ALTER TABLE goleadores DROP COLUMN IF EXISTS match_id;

-- Tablas legadas de la primera edición.
DROP TABLE IF EXISTS resultados;
DROP TABLE IF EXISTS tarjetas;

COMMIT;
