-- Corrección del resultado de la J1: Deportivo Amarillo 3-0 New Generation
-- (se había registrado 2-0). Solo toca el marcador erróneo, así que es
-- idempotente y no pisa correcciones posteriores del admin.

UPDATE partidos SET home_goals = 3
  WHERE match_key = 'j1-2'
    AND edicion_id = (SELECT id FROM ediciones WHERE slug = '2026-oct-nov')
    AND home_goals = 2 AND away_goals = 0;
