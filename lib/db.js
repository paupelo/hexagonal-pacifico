'use strict';

// ---------------------------------------------------------------------------
// Capa de datos multi-edición: dos implementaciones con la misma interfaz.
//   - createPgStore: PostgreSQL real (producción en Render / local con DATABASE_URL).
//   - createMemoryStore: almacén en memoria para previsualizar en local sin BD.
// ---------------------------------------------------------------------------

const { EDICIONES, LEGACY_RESULTS, LEGACY_SCORERS, LEGACY_CARDS, SLUG_ARCHIVADA } = require('../data/ediciones');
const { computeStandings } = require('./clasificacion');

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------
function createPgStore({ connectionString, ssl, migrationsDir }) {
  const { Pool } = require('pg');
  const fs = require('fs');
  const path = require('path');
  const pool = new Pool({ connectionString, ssl });

  async function applyMigrations() {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      await pool.query(sql);
      console.log(`[DB] Migración aplicada (idempotente): ${f}`);
    }
  }

  // Congela la clasificación final de la primera edición con los criterios
  // ANTIGUOS (v1), para que el nuevo orden de desempates no la altere.
  async function freezeFirstEdition() {
    const { rows: eds } = await pool.query('SELECT id FROM ediciones WHERE slug = $1', [SLUG_ARCHIVADA]);
    if (!eds.length) return;
    const edicionId = eds[0].id;
    const { rows: pending } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM equipos WHERE edicion_id = $1 AND posicion_final IS NULL', [edicionId]
    );
    if (pending[0].n === 0) return;
    const equipos = (await pool.query('SELECT id, nombre, logo_url FROM equipos WHERE edicion_id = $1', [edicionId])).rows;
    const partidos = (await pool.query(
      `SELECT p.* FROM partidos p JOIN jornadas j ON j.id = p.jornada_id
       WHERE p.edicion_id = $1 AND j.tipo = 'liga'`, [edicionId]
    )).rows;
    const tarjetas = (await pool.query('SELECT type, equipo_id FROM tarjetas WHERE edicion_id = $1', [edicionId])).rows;
    const standings = computeStandings(equipos, partidos, { criterios: 'v1', tarjetas });
    for (const row of standings) {
      await pool.query('UPDATE equipos SET posicion_final = $1 WHERE id = $2', [row.pos, row.equipo_id]);
    }
    console.log(`[DB] Clasificación final de ${SLUG_ARCHIVADA} congelada (criterios v1).`);
  }

  return {
    kind: 'pg',
    pool,
    async init() {
      await applyMigrations();
      await freezeFirstEdition();
    },
    async getEdiciones() {
      return (await pool.query('SELECT * FROM ediciones ORDER BY fecha_inicio NULLS LAST, id')).rows;
    },
    async getEdicionBySlug(slug) {
      return (await pool.query('SELECT * FROM ediciones WHERE slug = $1', [slug])).rows[0] || null;
    },
    async getEdicionActiva() {
      return (await pool.query('SELECT * FROM ediciones WHERE activa = TRUE ORDER BY id DESC LIMIT 1')).rows[0] || null;
    },
    async getEquipos(edicionId) {
      return (await pool.query(
        'SELECT id, edicion_id, nombre, logo_url, posicion_final FROM equipos WHERE edicion_id = $1 ORDER BY nombre', [edicionId]
      )).rows;
    },
    async getEquipo(id) {
      return (await pool.query('SELECT * FROM equipos WHERE id = $1', [id])).rows[0] || null;
    },
    async getJornadas(edicionId) {
      return (await pool.query('SELECT * FROM jornadas WHERE edicion_id = $1 ORDER BY orden', [edicionId])).rows;
    },
    async getPartidos(edicionId) {
      return (await pool.query(
        `SELECT p.*, j.tipo AS jornada_tipo, j.orden AS jornada_orden, j.label AS jornada_label
         FROM partidos p JOIN jornadas j ON j.id = p.jornada_id
         WHERE p.edicion_id = $1 ORDER BY j.orden, p.hora, p.id`, [edicionId]
      )).rows;
    },
    async getPartido(id) {
      return (await pool.query('SELECT * FROM partidos WHERE id = $1', [id])).rows[0] || null;
    },
    async getGoleadores(edicionId) {
      return (await pool.query(
        `SELECT id, player, goals, partido_id, equipo_id, team AS legacy_team
         FROM goleadores WHERE edicion_id = $1 AND goals > 0 ORDER BY goals DESC, player`, [edicionId]
      )).rows;
    },
    async getGoleador(id) {
      return (await pool.query('SELECT * FROM goleadores WHERE id = $1', [id])).rows[0] || null;
    },
    async getTarjetas(edicionId) {
      return (await pool.query('SELECT id, player, type, equipo_id FROM tarjetas WHERE edicion_id = $1', [edicionId])).rows;
    },
    async setResultado(partidoId, hg, ag, ph, pa) {
      await pool.query(
        'UPDATE partidos SET home_goals = $1, away_goals = $2, penales_home = $3, penales_away = $4 WHERE id = $5',
        [hg, ag, ph, pa, partidoId]
      );
    },
    async clearResultado(partidoId) {
      await pool.query(
        'UPDATE partidos SET home_goals = NULL, away_goals = NULL, penales_home = NULL, penales_away = NULL WHERE id = $1',
        [partidoId]
      );
    },
    async addGoleador({ edicionId, partidoId, equipoId, equipoNombre, player, goals }) {
      const { rows } = await pool.query(
        `INSERT INTO goleadores (player, team, goals, edicion_id, partido_id, equipo_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [player, equipoNombre, goals, edicionId, partidoId, equipoId]
      );
      return rows[0].id;
    },
    async deleteGoleador(id) {
      await pool.query('DELETE FROM goleadores WHERE id = $1', [id]);
    },
    async updateEquipo(id, { nombre, logoUrl }) {
      await pool.query('UPDATE equipos SET nombre = $1, logo_url = $2 WHERE id = $3', [nombre, logoUrl, id]);
    },
    async addEquipo(edicionId, { nombre, logoUrl }) {
      const { rows } = await pool.query(
        'INSERT INTO equipos (edicion_id, nombre, logo_url) VALUES ($1, $2, $3) RETURNING id',
        [edicionId, nombre, logoUrl || null]
      );
      return rows[0].id;
    },
    async createEdicion({ nombre, nombreCorto, slug, fechaInicio, fechaFin, info }) {
      const { rows } = await pool.query(
        `INSERT INTO ediciones (nombre, nombre_corto, slug, fecha_inicio, fecha_fin, activa, archivada, info)
         VALUES ($1, $2, $3, $4, $5, FALSE, FALSE, $6) RETURNING id`,
        [nombre, nombreCorto || null, slug, fechaInicio || null, fechaFin || null, info ? JSON.stringify(info) : null]
      );
      return rows[0].id;
    },
    async activarEdicion(id) {
      await pool.query('UPDATE ediciones SET activa = FALSE WHERE activa = TRUE');
      await pool.query('UPDATE ediciones SET activa = TRUE, archivada = FALSE WHERE id = $1', [id]);
    },
    async archivarEdicion(id) {
      await pool.query('UPDATE ediciones SET archivada = TRUE, activa = FALSE WHERE id = $1', [id]);
    },
    async setPosicionesFinales(posiciones) {
      for (const { equipoId, pos } of posiciones) {
        await pool.query('UPDATE equipos SET posicion_final = $1 WHERE id = $2', [pos, equipoId]);
      }
    },
    async addJornada(edicionId, { orden, label, fecha, tipo, nota }) {
      const { rows } = await pool.query(
        `INSERT INTO jornadas (edicion_id, orden, label, fecha, tipo, nota)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [edicionId, orden, label, fecha || null, tipo || 'liga', nota || null]
      );
      return rows[0].id;
    },
    async addPartido(edicionId, jornadaId, { matchKey, hora, homeEquipoId, awayEquipoId, homeLabel, awayLabel }) {
      const { rows } = await pool.query(
        `INSERT INTO partidos (edicion_id, jornada_id, match_key, hora, home_equipo_id, away_equipo_id, home_label, away_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [edicionId, jornadaId, matchKey, hora || null, homeEquipoId || null, awayEquipoId || null, homeLabel || null, awayLabel || null]
      );
      return rows[0].id;
    },
    async addLogo(mime, dataBase64) {
      const { rows } = await pool.query('INSERT INTO logos (mime, data) VALUES ($1, $2) RETURNING id', [mime, dataBase64]);
      return rows[0].id;
    },
    async getLogo(id) {
      return (await pool.query('SELECT mime, data FROM logos WHERE id = $1', [id])).rows[0] || null;
    },
  };
}

// ---------------------------------------------------------------------------
// Memoria (preview local sin DATABASE_URL; nada se persiste)
// ---------------------------------------------------------------------------
function createMemoryStore() {
  let seq = 1;
  const nextId = () => seq++;
  const db = { ediciones: [], equipos: [], jornadas: [], partidos: [], goleadores: [], tarjetas: [], logos: [] };
  const sameId = (a, b) => String(a) === String(b);
  const find = (arr, id) => arr.find((x) => sameId(x.id, id)) || null;
  const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

  function seed() {
    for (const ed of EDICIONES) {
      const edicion = {
        id: nextId(), nombre: ed.nombre, nombre_corto: ed.nombreCorto, slug: ed.slug,
        fecha_inicio: ed.fechaInicio, fecha_fin: ed.fechaFin, activa: ed.activa, archivada: ed.archivada,
        info: ed.info,
      };
      db.ediciones.push(edicion);
      const equipoPorNombre = new Map();
      for (const t of ed.equipos) {
        const eq = { id: nextId(), edicion_id: edicion.id, nombre: t.nombre, logo_url: t.logo, posicion_final: null };
        db.equipos.push(eq);
        equipoPorNombre.set(t.nombre, eq);
      }
      for (const j of ed.jornadas) {
        const jornada = {
          id: nextId(), edicion_id: edicion.id, orden: j.orden, label: j.label,
          fecha: j.fecha, tipo: j.tipo, nota: j.nota || null,
        };
        db.jornadas.push(jornada);
        for (const p of j.partidos) {
          db.partidos.push({
            id: nextId(), edicion_id: edicion.id, jornada_id: jornada.id, match_key: p.key, hora: p.hora,
            home_equipo_id: p.home ? equipoPorNombre.get(p.home).id : null,
            away_equipo_id: p.away ? equipoPorNombre.get(p.away).id : null,
            home_label: p.homeLabel || null, away_label: p.awayLabel || null,
            home_goals: null, away_goals: null, penales_home: null, penales_away: null,
          });
        }
      }
      if (ed.slug === SLUG_ARCHIVADA) {
        for (const r of LEGACY_RESULTS) {
          const p = db.partidos.find((x) => x.edicion_id === edicion.id && x.match_key === r.match_id);
          if (p) { p.home_goals = r.home_goals; p.away_goals = r.away_goals; }
        }
        for (const s of LEGACY_SCORERS) {
          const p = db.partidos.find((x) => x.edicion_id === edicion.id && x.match_key === s.match_id);
          const eq = equipoPorNombre.get(s.team);
          db.goleadores.push({
            id: nextId(), edicion_id: edicion.id, partido_id: p ? p.id : null,
            equipo_id: eq ? eq.id : null, player: s.player, team: s.team, goals: s.goals,
          });
        }
        for (const c of LEGACY_CARDS) {
          const eq = equipoPorNombre.get(c.team);
          db.tarjetas.push({
            id: nextId(), edicion_id: edicion.id, equipo_id: eq ? eq.id : null,
            player: c.player, team: c.team, type: c.type,
          });
        }
        // Congelar la clasificación final con los criterios antiguos (v1).
        const equipos = db.equipos.filter((e) => e.edicion_id === edicion.id);
        const ligaIds = new Set(db.jornadas.filter((j) => j.edicion_id === edicion.id && j.tipo === 'liga').map((j) => j.id));
        const liga = db.partidos.filter((x) => ligaIds.has(x.jornada_id));
        const tarjetas = db.tarjetas.filter((t) => t.edicion_id === edicion.id);
        for (const row of computeStandings(equipos, liga, { criterios: 'v1', tarjetas })) {
          find(db.equipos, row.equipo_id).posicion_final = row.pos;
        }
      }
    }
  }

  return {
    kind: 'memory',
    async init() {
      seed();
      console.log('[DB] Almacén en memoria listo (modo preview local; los datos no se persisten).');
    },
    async getEdiciones() { return clone(db.ediciones); },
    async getEdicionBySlug(slug) { return clone(db.ediciones.find((e) => e.slug === slug) || null); },
    async getEdicionActiva() { return clone(db.ediciones.find((e) => e.activa) || null); },
    async getEquipos(edicionId) {
      return clone(db.equipos.filter((e) => sameId(e.edicion_id, edicionId)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    },
    async getEquipo(id) { return clone(find(db.equipos, id)); },
    async getJornadas(edicionId) {
      return clone(db.jornadas.filter((j) => sameId(j.edicion_id, edicionId)).sort((a, b) => a.orden - b.orden));
    },
    async getPartidos(edicionId) {
      const rows = db.partidos.filter((p) => sameId(p.edicion_id, edicionId)).map((p) => {
        const j = find(db.jornadas, p.jornada_id);
        return { ...p, jornada_tipo: j.tipo, jornada_orden: j.orden, jornada_label: j.label };
      });
      return clone(rows.sort((a, b) => a.jornada_orden - b.jornada_orden || String(a.hora).localeCompare(String(b.hora))));
    },
    async getPartido(id) { return clone(find(db.partidos, id)); },
    async getGoleadores(edicionId) {
      return clone(db.goleadores
        .filter((g) => sameId(g.edicion_id, edicionId) && g.goals > 0)
        .map((g) => ({ id: g.id, player: g.player, goals: g.goals, partido_id: g.partido_id, equipo_id: g.equipo_id, legacy_team: g.team || null }))
        .sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player, 'es')));
    },
    async getGoleador(id) { return clone(find(db.goleadores, id)); },
    async getTarjetas(edicionId) { return clone(db.tarjetas.filter((t) => sameId(t.edicion_id, edicionId))); },
    async setResultado(partidoId, hg, ag, ph, pa) {
      const p = find(db.partidos, partidoId);
      if (p) Object.assign(p, { home_goals: hg, away_goals: ag, penales_home: ph, penales_away: pa });
    },
    async clearResultado(partidoId) {
      const p = find(db.partidos, partidoId);
      if (p) Object.assign(p, { home_goals: null, away_goals: null, penales_home: null, penales_away: null });
    },
    async addGoleador({ edicionId, partidoId, equipoId, equipoNombre, player, goals }) {
      const id = nextId();
      db.goleadores.push({ id, edicion_id: edicionId, partido_id: partidoId, equipo_id: equipoId, player, team: equipoNombre, goals });
      return id;
    },
    async deleteGoleador(id) { db.goleadores = db.goleadores.filter((g) => !sameId(g.id, id)); },
    async updateEquipo(id, { nombre, logoUrl }) {
      const e = find(db.equipos, id);
      if (e) Object.assign(e, { nombre, logo_url: logoUrl });
    },
    async addEquipo(edicionId, { nombre, logoUrl }) {
      const id = nextId();
      db.equipos.push({ id, edicion_id: edicionId, nombre, logo_url: logoUrl || null, posicion_final: null });
      return id;
    },
    async createEdicion({ nombre, nombreCorto, slug, fechaInicio, fechaFin, info }) {
      const id = nextId();
      db.ediciones.push({
        id, nombre, nombre_corto: nombreCorto || null, slug, fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null, activa: false, archivada: false, info: info || null,
      });
      return id;
    },
    async activarEdicion(id) {
      for (const e of db.ediciones) e.activa = sameId(e.id, id);
      const e = find(db.ediciones, id);
      if (e) e.archivada = false;
    },
    async archivarEdicion(id) {
      const e = find(db.ediciones, id);
      if (e) { e.archivada = true; e.activa = false; }
    },
    async setPosicionesFinales(posiciones) {
      for (const { equipoId, pos } of posiciones) {
        const e = find(db.equipos, equipoId);
        if (e) e.posicion_final = pos;
      }
    },
    async addJornada(edicionId, { orden, label, fecha, tipo, nota }) {
      const id = nextId();
      db.jornadas.push({ id, edicion_id: edicionId, orden, label, fecha: fecha || null, tipo: tipo || 'liga', nota: nota || null });
      return id;
    },
    async addPartido(edicionId, jornadaId, { matchKey, hora, homeEquipoId, awayEquipoId, homeLabel, awayLabel }) {
      const id = nextId();
      db.partidos.push({
        id, edicion_id: edicionId, jornada_id: jornadaId, match_key: matchKey, hora: hora || null,
        home_equipo_id: homeEquipoId || null, away_equipo_id: awayEquipoId || null,
        home_label: homeLabel || null, away_label: awayLabel || null,
        home_goals: null, away_goals: null, penales_home: null, penales_away: null,
      });
      return id;
    },
    async addLogo(mime, dataBase64) {
      const id = nextId();
      db.logos.push({ id, mime, data: dataBase64 });
      return id;
    },
    async getLogo(id) { return clone(find(db.logos, id)); },
  };
}

module.exports = { createPgStore, createMemoryStore };
