'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { Pool } = require('pg');

// --------------------------------------------------------------------------
// Carga sencilla de variables de entorno desde un archivo .env (solo local).
// En Render las variables se inyectan automáticamente y este archivo no existe.
// --------------------------------------------------------------------------
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
})();

const PORT = process.env.PORT || 3000;
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// Si no hay DATABASE_URL usamos un almacén EN MEMORIA (solo para previsualizar
// la web en local). Los datos no se persisten al reiniciar. En Render siempre
// hay DATABASE_URL, así que allí se usa PostgreSQL real.
const USE_MEMORY = !process.env.DATABASE_URL;

if (USE_MEMORY) {
  console.warn(
    '[AVISO] No hay DATABASE_URL: usando almacén EN MEMORIA (modo preview local, los datos no se guardan).'
  );
  // Para poder probar el panel de admin en local sin configurar nada.
  if (!ADMIN_PASSWORD) {
    ADMIN_PASSWORD = 'admin';
    console.warn('[AVISO] ADMIN_PASSWORD no definida: se usa "admin" en modo preview local.');
  }
}
if (!ADMIN_PASSWORD) {
  console.warn(
    '[AVISO] No se ha definido ADMIN_PASSWORD. El panel de admin quedará bloqueado.'
  );
}

// --------------------------------------------------------------------------
// DATOS FIJOS DEL TORNEO (no se guardan en la BD)
// --------------------------------------------------------------------------
const TOURNAMENT = {
  name: 'Pentagonal Panamá Pacífico',
  venue: 'Sport Park, Panamá Pacífico',
  startDate: 'Domingo 12 de julio de 2026',
  fee: '350 USD',
  payment: {
    account: '04-72-00-733927-2',
    bank: 'Banco General',
    type: 'Ahorros',
    holder: 'Panama Pacífico FC',
  },
};

const TEAMS = [
  'Panamá Pacífico Residentes FC',
  'Cludsa FC',
  'Deportivo Amarillo',
  'Hermandad FC',
  'New Generation PPFC',
];

// Escudo de cada equipo (rutas dentro de public/).
const TEAM_BADGES = {
  'Panamá Pacífico Residentes FC': '/escudos/panama-pacifico.jpeg',
  'Cludsa FC': '/escudos/cludsa.jpeg',
  'Deportivo Amarillo': '/escudos/deportivo-amarillo.png',
  'Hermandad FC': '/escudos/hermandad.jpeg',
  'New Generation PPFC': '/escudos/new-generation.jpeg',
};

// El calendario es FIJO. En la BD solo se guardan los resultados (por match id).
// Con 5 equipos hay 2 partidos por jornada y un equipo descansa (rest).
const SCHEDULE = [
  {
    round: 1,
    label: 'Jornada 1',
    date: 'Domingo 12 de julio de 2026',
    type: 'liga',
    rest: 'New Generation PPFC',
    matches: [
      { id: 'j1-1', time: '7:30', home: 'Panamá Pacífico Residentes FC', away: 'Hermandad FC' },
      { id: 'j1-2', time: '9:00', home: 'Cludsa FC', away: 'Deportivo Amarillo' },
    ],
  },
  {
    round: 2,
    label: 'Jornada 2',
    date: 'Domingo 19 de julio de 2026',
    type: 'liga',
    rest: 'Hermandad FC',
    matches: [
      { id: 'j2-1', time: '7:30', home: 'New Generation PPFC', away: 'Deportivo Amarillo' },
      { id: 'j2-2', time: '9:00', home: 'Panamá Pacífico Residentes FC', away: 'Cludsa FC' },
    ],
  },
  {
    round: 3,
    label: 'Jornada 3',
    date: 'Domingo 26 de julio de 2026',
    type: 'liga',
    rest: 'Deportivo Amarillo',
    matches: [
      { id: 'j3-1', time: '7:30', home: 'Hermandad FC', away: 'Cludsa FC' },
      { id: 'j3-2', time: '9:00', home: 'New Generation PPFC', away: 'Panamá Pacífico Residentes FC' },
    ],
  },
  {
    round: 4,
    label: 'Jornada 4',
    date: 'Domingo 2 de agosto de 2026',
    type: 'liga',
    rest: 'Cludsa FC',
    matches: [
      { id: 'j4-1', time: '7:30', home: 'Deportivo Amarillo', away: 'Panamá Pacífico Residentes FC' },
      { id: 'j4-2', time: '9:00', home: 'Hermandad FC', away: 'New Generation PPFC' },
    ],
  },
  {
    round: 5,
    label: 'Jornada 5',
    date: 'Domingo 9 de agosto de 2026',
    type: 'liga',
    rest: 'Panamá Pacífico Residentes FC',
    matches: [
      { id: 'j5-1', time: '7:30', home: 'Cludsa FC', away: 'New Generation PPFC' },
      { id: 'j5-2', time: '9:00', home: 'Deportivo Amarillo', away: 'Hermandad FC' },
    ],
  },
  {
    round: 6,
    label: 'Semifinales',
    date: 'Domingo 16 de agosto de 2026',
    type: 'semifinal',
    matches: [
      { id: 'sf-1', time: '7:30', home: '1º clasificado', away: '4º clasificado' },
      { id: 'sf-2', time: '9:00', home: '2º clasificado', away: '3º clasificado' },
    ],
  },
  {
    round: 7,
    label: 'Final',
    date: 'Domingo 23 de agosto de 2026',
    type: 'final',
    matches: [
      { id: 'final', time: '8:00', home: 'Ganador Semifinal 1', away: 'Ganador Semifinal 2' },
    ],
  },
];

// Solo los partidos de liga (jornadas 1-5) cuentan para la clasificación.
const LEAGUE_MATCHES = SCHEDULE.filter((r) => r.type === 'liga').flatMap((r) => r.matches);

// --------------------------------------------------------------------------
// Capa de datos: dos implementaciones con la misma interfaz.
//   - pgStore: PostgreSQL real (producción / local con DATABASE_URL).
//   - memoryStore: almacén en memoria (preview local sin base de datos).
// --------------------------------------------------------------------------
function createPgStore() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // En producción (Render) las bases gestionadas requieren SSL.
    ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false,
  });
  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS resultados (
          match_id   TEXT PRIMARY KEY,
          home_goals INTEGER NOT NULL,
          away_goals INTEGER NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS goleadores (
          id     SERIAL PRIMARY KEY,
          player TEXT NOT NULL,
          team   TEXT NOT NULL,
          goals  INTEGER NOT NULL DEFAULT 0
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tarjetas (
          id     SERIAL PRIMARY KEY,
          player TEXT NOT NULL,
          team   TEXT NOT NULL,
          type   TEXT NOT NULL CHECK (type IN ('amarilla', 'roja'))
        );
      `);
      console.log('[DB] Tablas verificadas/creadas correctamente (PostgreSQL).');
    },
    async getResults() {
      return (await pool.query('SELECT match_id, home_goals, away_goals FROM resultados')).rows;
    },
    async getScorers() {
      return (await pool.query(
        'SELECT id, player, team, goals FROM goleadores ORDER BY goals DESC, player ASC'
      )).rows;
    },
    async getCards() {
      return (await pool.query('SELECT id, player, team, type FROM tarjetas ORDER BY id DESC')).rows;
    },
    async upsertResult(matchId, hg, ag) {
      await pool.query(
        `INSERT INTO resultados (match_id, home_goals, away_goals, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (match_id)
         DO UPDATE SET home_goals = $2, away_goals = $3, updated_at = NOW()`,
        [matchId, hg, ag]
      );
    },
    async deleteResult(matchId) {
      await pool.query('DELETE FROM resultados WHERE match_id = $1', [matchId]);
    },
    async addScorer(player, team, goals) {
      const { rows } = await pool.query(
        'INSERT INTO goleadores (player, team, goals) VALUES ($1, $2, $3) RETURNING id',
        [player, team, goals]
      );
      return rows[0].id;
    },
    async updateScorer(id, player, team, goals) {
      await pool.query('UPDATE goleadores SET player = $1, team = $2, goals = $3 WHERE id = $4', [
        player, team, goals, id,
      ]);
    },
    async deleteScorer(id) {
      await pool.query('DELETE FROM goleadores WHERE id = $1', [id]);
    },
    async addCard(player, team, type) {
      const { rows } = await pool.query(
        'INSERT INTO tarjetas (player, team, type) VALUES ($1, $2, $3) RETURNING id',
        [player, team, type]
      );
      return rows[0].id;
    },
    async deleteCard(id) {
      await pool.query('DELETE FROM tarjetas WHERE id = $1', [id]);
    },
  };
}

function createMemoryStore() {
  let results = []; // { match_id, home_goals, away_goals }
  let scorers = []; // { id, player, team, goals }
  let cards = []; //   { id, player, team, type }
  let seq = 1;
  const sameId = (a, b) => String(a) === String(b);
  return {
    async init() {
      console.log('[DB] Almacén en memoria listo (modo preview).');
    },
    async getResults() {
      return results.map((r) => ({ ...r }));
    },
    async getScorers() {
      return [...scorers].sort(
        (a, b) => b.goals - a.goals || a.player.localeCompare(b.player)
      );
    },
    async getCards() {
      return [...cards].sort((a, b) => b.id - a.id);
    },
    async upsertResult(matchId, hg, ag) {
      const existing = results.find((r) => r.match_id === matchId);
      if (existing) {
        existing.home_goals = hg;
        existing.away_goals = ag;
      } else {
        results.push({ match_id: matchId, home_goals: hg, away_goals: ag });
      }
    },
    async deleteResult(matchId) {
      results = results.filter((r) => r.match_id !== matchId);
    },
    async addScorer(player, team, goals) {
      const id = seq++;
      scorers.push({ id, player, team, goals });
      return id;
    },
    async updateScorer(id, player, team, goals) {
      const s = scorers.find((x) => sameId(x.id, id));
      if (s) Object.assign(s, { player, team, goals });
    },
    async deleteScorer(id) {
      scorers = scorers.filter((x) => !sameId(x.id, id));
    },
    async addCard(player, team, type) {
      const id = seq++;
      cards.push({ id, player, team, type });
      return id;
    },
    async deleteCard(id) {
      cards = cards.filter((x) => !sameId(x.id, id));
    },
  };
}

const store = USE_MEMORY ? createMemoryStore() : createPgStore();

async function initDb() {
  await store.init();
}

// --------------------------------------------------------------------------
// Cálculo de la clasificación
// --------------------------------------------------------------------------
function computeStandings(results, cards) {
  const resultByMatch = new Map(results.map((r) => [r.match_id, r]));

  // Tarjetas rojas por equipo (criterio fair play).
  const redCards = {};
  for (const t of TEAMS) redCards[t] = 0;
  for (const c of cards) {
    if (c.type === 'roja' && redCards[c.team] !== undefined) redCards[c.team] += 1;
  }

  // Estructura base por equipo.
  const table = {};
  for (const t of TEAMS) {
    table[t] = {
      team: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0,
      red: redCards[t],
    };
  }

  // Procesar partidos de liga con resultado.
  for (const m of LEAGUE_MATCHES) {
    const r = resultByMatch.get(m.id);
    if (!r) continue;
    const hg = r.home_goals;
    const ag = r.away_goals;
    const home = table[m.home];
    const away = table[m.away];
    if (!home || !away) continue;

    home.pj++; away.pj++;
    home.gf += hg; home.gc += ag;
    away.gf += ag; away.gc += hg;

    if (hg > ag) { home.g++; home.pts += 3; away.p++; }
    else if (hg < ag) { away.g++; away.pts += 3; home.p++; }
    else { home.e++; away.e++; home.pts += 1; away.pts += 1; }
  }

  for (const t of TEAMS) table[t].dg = table[t].gf - table[t].gc;

  // Head-to-head: puntos obtenidos solo en los partidos entre el subconjunto dado.
  function headToHeadPoints(group) {
    const set = new Set(group.map((x) => x.team));
    const pts = {};
    for (const t of group) pts[t.team] = 0;
    for (const m of LEAGUE_MATCHES) {
      if (!set.has(m.home) || !set.has(m.away)) continue;
      const r = resultByMatch.get(m.id);
      if (!r) continue;
      if (r.home_goals > r.away_goals) pts[m.home] += 3;
      else if (r.home_goals < r.away_goals) pts[m.away] += 3;
      else { pts[m.home] += 1; pts[m.away] += 1; }
    }
    return pts;
  }

  let arr = TEAMS.map((t) => table[t]);

  // Ordenar por puntos y resolver empates por grupos.
  arr.sort((a, b) => b.pts - a.pts);

  // Reagrupar por puntos iguales y aplicar criterios dentro de cada grupo.
  const ordered = [];
  let i = 0;
  while (i < arr.length) {
    let j = i;
    while (j < arr.length && arr[j].pts === arr[i].pts) j++;
    const group = arr.slice(i, j);

    if (group.length === 1) {
      ordered.push(group[0]);
    } else {
      const h2h = headToHeadPoints(group);
      group.sort((a, b) => {
        if (h2h[b.team] !== h2h[a.team]) return h2h[b.team] - h2h[a.team]; // 1) head-to-head
        if (b.dg !== a.dg) return b.dg - a.dg;                              // 2) diferencia de goles
        if (b.gf !== a.gf) return b.gf - a.gf;                              // 3) goles a favor
        if (a.red !== b.red) return a.red - b.red;                          // 4) fair play (menos rojas)
        return a.team.localeCompare(b.team, 'es');                          // 5) orden alfabético
      });
      ordered.push(...group);
    }
    i = j;
  }

  return ordered.map((row, idx) => ({ ...row, pos: idx + 1 }));
}

// --------------------------------------------------------------------------
// App Express
// --------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticación para rutas de escritura.
function requireAdmin(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// --- Login ---
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD no está configurada en el servidor.' });
  }
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

// --- Lectura pública: todos los datos del torneo ---
app.get('/api/data', async (req, res) => {
  try {
    const [results, scorers, cards] = await Promise.all([
      store.getResults(),
      store.getScorers(),
      store.getCards(),
    ]);
    const standings = computeStandings(results, cards);
    res.json({
      tournament: TOURNAMENT,
      teams: TEAMS,
      badges: TEAM_BADGES,
      schedule: SCHEDULE,
      results,
      scorers,
      cards,
      standings,
    });
  } catch (err) {
    console.error('Error en /api/data:', err);
    res.status(500).json({ error: 'Error al obtener los datos' });
  }
});

// --- Escritura: guardar / actualizar resultado de un partido ---
app.post('/api/results', requireAdmin, async (req, res) => {
  try {
    const { matchId, homeGoals, awayGoals } = req.body || {};
    const validIds = SCHEDULE.flatMap((r) => r.matches.map((m) => m.id));
    if (!validIds.includes(matchId)) {
      return res.status(400).json({ error: 'matchId inválido' });
    }
    const hg = Number(homeGoals);
    const ag = Number(awayGoals);
    if (!Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0) {
      return res.status(400).json({ error: 'Marcador inválido' });
    }
    await store.upsertResult(matchId, hg, ag);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando resultado:', err);
    res.status(500).json({ error: 'Error al guardar el resultado' });
  }
});

// --- Escritura: borrar resultado de un partido ---
app.delete('/api/results/:matchId', requireAdmin, async (req, res) => {
  try {
    await store.deleteResult(req.params.matchId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error borrando resultado:', err);
    res.status(500).json({ error: 'Error al borrar el resultado' });
  }
});

// --- Escritura: añadir goleador ---
app.post('/api/scorers', requireAdmin, async (req, res) => {
  try {
    const { player, team, goals } = req.body || {};
    const g = Number(goals);
    if (!player || !team || !TEAMS.includes(team) || !Number.isInteger(g) || g < 0) {
      return res.status(400).json({ error: 'Datos de goleador inválidos' });
    }
    const id = await store.addScorer(String(player).trim(), team, g);
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo goleador:', err);
    res.status(500).json({ error: 'Error al añadir el goleador' });
  }
});

// --- Escritura: actualizar goleador ---
app.put('/api/scorers/:id', requireAdmin, async (req, res) => {
  try {
    const { player, team, goals } = req.body || {};
    const g = Number(goals);
    if (!player || !team || !TEAMS.includes(team) || !Number.isInteger(g) || g < 0) {
      return res.status(400).json({ error: 'Datos de goleador inválidos' });
    }
    await store.updateScorer(req.params.id, String(player).trim(), team, g);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error actualizando goleador:', err);
    res.status(500).json({ error: 'Error al actualizar el goleador' });
  }
});

// --- Escritura: borrar goleador ---
app.delete('/api/scorers/:id', requireAdmin, async (req, res) => {
  try {
    await store.deleteScorer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error borrando goleador:', err);
    res.status(500).json({ error: 'Error al borrar el goleador' });
  }
});

// --- Escritura: añadir tarjeta ---
app.post('/api/cards', requireAdmin, async (req, res) => {
  try {
    const { player, team, type } = req.body || {};
    if (!player || !team || !TEAMS.includes(team) || !['amarilla', 'roja'].includes(type)) {
      return res.status(400).json({ error: 'Datos de tarjeta inválidos' });
    }
    const id = await store.addCard(String(player).trim(), team, type);
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo tarjeta:', err);
    res.status(500).json({ error: 'Error al añadir la tarjeta' });
  }
});

// --- Escritura: borrar tarjeta ---
app.delete('/api/cards/:id', requireAdmin, async (req, res) => {
  try {
    await store.deleteCard(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error borrando tarjeta:', err);
    res.status(500).json({ error: 'Error al borrar la tarjeta' });
  }
});

// Cualquier otra ruta sirve el frontend (SPA simple).
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------------------------------------------------------------------
// Arranque
// --------------------------------------------------------------------------
function start() {
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Servidor escuchando en http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('No se pudo inicializar la base de datos:', err);
      // Arrancamos igualmente para poder servir el frontend, aunque la API fallará.
      app.listen(PORT, () => {
        console.log(`Servidor escuchando en http://localhost:${PORT} (sin BD)`);
      });
    });
}

// Solo arranca el servidor si el archivo se ejecuta directamente
// (permite importarlo en tests sin abrir conexiones ni puertos).
if (require.main === module) {
  start();
}

module.exports = { app, computeStandings, TEAMS, SCHEDULE, LEAGUE_MATCHES, TOURNAMENT };
