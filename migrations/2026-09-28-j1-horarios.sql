-- Jornada 1 de la edición 2026-oct-nov: Deportivo Amarillo vs New Generation
-- pasa al primer turno (7:00) y Panamá Pacífico Residentes vs La10 West FC al
-- segundo (8:15). Idempotente: deja siempre el mismo estado final.

BEGIN;

UPDATE partidos SET hora = '7:00'
  WHERE match_key = 'j1-2'
    AND edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov');

UPDATE partidos SET hora = '8:15'
  WHERE match_key = 'j1-1'
    AND edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov');

COMMIT;
