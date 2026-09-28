'use strict';

// Ejecuta las migraciones de migrations/ contra la base de datos indicada
// en DATABASE_URL y congela la clasificación de la primera edición.
// Es lo mismo que hace el servidor al arrancar; este script permite migrar
// a mano (p. ej. contra producción) ANTES de desplegar el código nuevo.
//
// Uso: DATABASE_URL='postgres://...' node scripts/migrate.js
//
// IMPORTANTE: contra producción, haz SIEMPRE un backup antes:
//   DATABASE_URL='postgres://...' ./scripts/backup.sh

const path = require('path');
const { createPgStore } = require('../lib/db');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: define DATABASE_URL.');
  process.exit(1);
}

const store = createPgStore({
  connectionString: process.env.DATABASE_URL,
  // Las bases gestionadas de Render requieren SSL; en local no suele hacer falta.
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
  migrationsDir: path.join(__dirname, '..', 'migrations'),
});

store
  .init()
  .then(async () => {
    const { rows } = await store.pool.query(`
      SELECT ed.slug,
             (SELECT count(*) FROM equipos e WHERE e.edicion_id = ed.id) AS equipos,
             (SELECT count(*) FROM partidos p WHERE p.edicion_id = ed.id) AS partidos,
             (SELECT count(*) FROM partidos p WHERE p.edicion_id = ed.id AND p.home_goals IS NOT NULL) AS con_resultado,
             (SELECT count(*) FROM goleadores g WHERE g.edicion_id = ed.id) AS goleadores
      FROM ediciones ed ORDER BY ed.id`);
    console.log('\nResumen por edición:');
    for (const r of rows) {
      console.log(`  ${r.slug}: ${r.equipos} equipos, ${r.partidos} partidos (${r.con_resultado} con resultado), ${r.goleadores} goleadores`);
    }
    await store.pool.end();
    console.log('\nMigración completada.');
  })
  .catch((err) => {
    console.error('Error al migrar:', err);
    process.exit(1);
  });
