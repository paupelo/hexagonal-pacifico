'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');

const { createPgStore, createMemoryStore } = require('./lib/db');
const { computeStandings } = require('./lib/clasificacion');

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
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const USE_MEMORY = !process.env.DATABASE_URL;

let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
let ARCHIVE_PASSWORD = process.env.ARCHIVE_PASSWORD || '';

if (USE_MEMORY) {
  console.warn('[AVISO] No hay DATABASE_URL: usando almacén EN MEMORIA (modo preview local, los datos no se guardan).');
  if (!ADMIN_PASSWORD) {
    ADMIN_PASSWORD = 'admin';
    console.warn('[AVISO] ADMIN_PASSWORD no definida: se usa "admin" en modo preview local.');
  }
  if (!ARCHIVE_PASSWORD) {
    ARCHIVE_PASSWORD = 'archivo';
    console.warn('[AVISO] ARCHIVE_PASSWORD no definida: se usa "archivo" en modo preview local.');
  }
}
if (!ADMIN_PASSWORD) console.warn('[AVISO] ADMIN_PASSWORD no definida: el panel de admin quedará bloqueado.');
if (!ARCHIVE_PASSWORD) console.warn('[AVISO] ARCHIVE_PASSWORD no definida: las ediciones archivadas quedarán bloqueadas.');

const store = USE_MEMORY
  ? createMemoryStore()
  : createPgStore({
      connectionString: process.env.DATABASE_URL,
      ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false,
      migrationsDir: path.join(__dirname, 'migrations'),
    });

// --------------------------------------------------------------------------
// Construcción del payload de una edición (vista pública y archivada)
// --------------------------------------------------------------------------
function partidoJugado(p) {
  return p.home_goals !== null && p.home_goals !== undefined &&
         p.away_goals !== null && p.away_goals !== undefined;
}

// Ganador de una eliminatoria: por goles y, si hay empate, por penaltis.
function ganadorId(p) {
  if (!partidoJugado(p)) return null;
  if (p.home_goals > p.away_goals) return p.home_equipo_id;
  if (p.home_goals < p.away_goals) return p.away_equipo_id;
  if (p.penales_home !== null && p.penales_away !== null && p.penales_home !== p.penales_away) {
    return p.penales_home > p.penales_away ? p.home_equipo_id : p.away_equipo_id;
  }
  return null;
}

async function buildEdicionPayload(edicion) {
  const [equipos, jornadas, partidos, goleadores, expulsiones] = await Promise.all([
    store.getEquipos(edicion.id),
    store.getJornadas(edicion.id),
    store.getPartidos(edicion.id),
    store.getGoleadores(edicion.id),
    store.getExpulsiones(edicion.id),
  ]);

  const equiposById = new Map(equipos.map((e) => [e.id, e]));
  const partidoByKey = new Map(partidos.map((p) => [p.match_key, p]));
  const liga = partidos.filter((p) => p.jornada_tipo === 'liga');
  const ligaCompleta = liga.length > 0 && liga.every(partidoJugado);

  // Clasificación: cálculo con los criterios vigentes; si la edición tiene la
  // posición final congelada (ediciones archivadas), ese orden manda.
  let clasificacion = computeStandings(equipos, liga, expulsiones);
  const congelada = equipos.length > 0 && equipos.every((e) => e.posicion_final);
  if (congelada) {
    const posByEquipo = new Map(equipos.map((e) => [e.id, e.posicion_final]));
    clasificacion = clasificacion
      .slice()
      .sort((a, b) => posByEquipo.get(a.equipo_id) - posByEquipo.get(b.equipo_id))
      .map((row, idx) => ({ ...row, pos: idx + 1 }));
  }

  // Cruces de eliminatorias: se resuelven cuando hay datos (liga completa
  // para las semis; semifinal decidida para la final).
  function resolveLado(p, lado) {
    const equipoId = p[`${lado}_equipo_id`];
    if (equipoId && equiposById.has(equipoId)) {
      const e = equiposById.get(equipoId);
      return { equipo_id: e.id, nombre: e.nombre, logo_url: e.logo_url || null };
    }
    const label = p[`${lado}_label`] || '—';
    let m = label.match(/(\d+)º/);
    if (m && ligaCompleta) {
      const row = clasificacion[Number(m[1]) - 1];
      if (row) return { equipo_id: row.equipo_id, nombre: row.nombre, logo_url: row.logo_url };
    }
    m = label.match(/semifinal\s*(\d+)/i);
    if (m) {
      const sf = partidoByKey.get(`sf-${m[1]}`);
      if (sf) {
        // La semifinal puede tener a su vez lados por resolver (1º, 4º...).
        const resueltaHome = resolveLado(sf, 'home');
        const resueltaAway = resolveLado(sf, 'away');
        const gid = ganadorId({ ...sf, home_equipo_id: resueltaHome.equipo_id || null, away_equipo_id: resueltaAway.equipo_id || null });
        if (gid && equiposById.has(gid)) {
          const e = equiposById.get(gid);
          return { equipo_id: e.id, nombre: e.nombre, logo_url: e.logo_url || null };
        }
      }
    }
    return { equipo_id: null, nombre: null, logo_url: null, placeholder: label.match(/(\d+)º/) ? `${label.match(/(\d+)º/)[1]}º` : label };
  }

  const jornadasPayload = jornadas.map((j) => ({
    orden: j.orden,
    label: j.label,
    fecha: j.fecha,
    tipo: j.tipo,
    nota: j.nota,
    partidos: partidos
      .filter((p) => p.jornada_id === j.id)
      .map((p) => ({
        id: p.id,
        match_key: p.match_key,
        hora: p.hora,
        home: resolveLado(p, 'home'),
        away: resolveLado(p, 'away'),
        home_goals: p.home_goals,
        away_goals: p.away_goals,
        penales_home: p.penales_home,
        penales_away: p.penales_away,
        jugado: partidoJugado(p),
      })),
  }));

  // Pichichi: agregado por jugador+equipo con el escudo del equipo.
  const partidosById = new Map(partidos.map((p) => [p.id, p]));
  const totals = new Map();
  for (const g of goleadores) {
    const equipo = g.equipo_id ? equiposById.get(g.equipo_id) : null;
    const equipoNombre = equipo ? equipo.nombre : (g.legacy_team || '—');
    const key = `${g.player}|${equipoNombre}`;
    const cur = totals.get(key) || {
      player: g.player,
      equipo: { nombre: equipoNombre, logo_url: equipo ? equipo.logo_url || null : null },
      goals: 0,
    };
    cur.goals += g.goals;
    totals.set(key, cur);
  }
  const goleadoresPayload = Array.from(totals.values()).sort(
    (a, b) => b.goals - a.goals || a.player.localeCompare(b.player, 'es')
  );

  return {
    edicion: {
      nombre: edicion.nombre,
      nombre_corto: edicion.nombre_corto,
      slug: edicion.slug,
      fecha_inicio: edicion.fecha_inicio,
      fecha_fin: edicion.fecha_fin,
      activa: edicion.activa,
      archivada: edicion.archivada,
      info: edicion.info || {},
    },
    equipos: equipos.map((e) => ({ id: e.id, nombre: e.nombre, logo_url: e.logo_url || null })),
    clasificacion,
    liga_completa: ligaCompleta,
    jornadas: jornadasPayload,
    goleadores: goleadoresPayload,
    expulsiones: expulsiones.map((x) => ({
      id: x.id,
      partido_id: x.partido_id,
      equipo_id: x.equipo_id,
      jugador: x.jugador,
      tipo: x.tipo,
    })),
    goleadores_detalle: goleadores.map((g) => ({
      ...g,
      partido_label: g.partido_id && partidosById.has(g.partido_id)
        ? `${partidosById.get(g.partido_id).jornada_label} · ${partidosById.get(g.partido_id).match_key}`
        : null,
    })),
  };
}

// --------------------------------------------------------------------------
// App Express
// --------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Autenticación de admin (igual que siempre: header Authorization) ---
function requireAdmin(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// --- Acceso al archivo: cookie de sesión ligada a ARCHIVE_PASSWORD ---
function archiveToken() {
  return crypto.createHash('sha256').update(`hpp-archivo-v1|${ARCHIVE_PASSWORD}`).digest('hex');
}
function parseCookies(req) {
  const out = {};
  const raw = req.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
function hasArchiveAccess(req) {
  return !!ARCHIVE_PASSWORD && parseCookies(req).hpp_archivo === archiveToken();
}

// La edición activa; da 503 si aún no hay ninguna (BD sin migrar).
async function getActivaOr503(res) {
  const activa = await store.getEdicionActiva();
  if (!activa) {
    res.status(503).json({ error: 'No hay ninguna edición activa configurada.' });
    return null;
  }
  return activa;
}

// --------------------------------------------------------------------------
// API pública
// --------------------------------------------------------------------------
app.get('/api/data', async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    res.json(await buildEdicionPayload(activa));
  } catch (err) {
    console.error('Error en /api/data:', err);
    res.status(500).json({ error: 'Error al obtener los datos' });
  }
});

app.get('/api/archivo/ediciones', async (req, res) => {
  try {
    const ediciones = await store.getEdiciones();
    res.json({
      ediciones: ediciones
        .filter((e) => e.archivada)
        .map((e) => ({
          nombre: e.nombre, nombre_corto: e.nombre_corto, slug: e.slug,
          fecha_inicio: e.fecha_inicio, fecha_fin: e.fecha_fin,
        })),
      acceso: hasArchiveAccess(req),
    });
  } catch (err) {
    console.error('Error en /api/archivo/ediciones:', err);
    res.status(500).json({ error: 'Error al obtener las ediciones' });
  }
});

app.post('/api/archivo/login', (req, res) => {
  const { password } = req.body || {};
  if (!ARCHIVE_PASSWORD) {
    return res.status(500).json({ error: 'ARCHIVE_PASSWORD no está configurada en el servidor.' });
  }
  if (password !== ARCHIVE_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (IS_PRODUCTION) attrs.push('Secure');
  res.setHeader('Set-Cookie', `hpp_archivo=${archiveToken()}; ${attrs.join('; ')}`);
  res.json({ ok: true });
});

app.get('/api/archivo/:slug/data', async (req, res) => {
  try {
    if (!hasArchiveAccess(req)) {
      return res.status(401).json({ error: 'Se necesita la contraseña del archivo.', needsPassword: true });
    }
    const edicion = await store.getEdicionBySlug(req.params.slug);
    if (!edicion || !edicion.archivada) {
      return res.status(404).json({ error: 'Edición archivada no encontrada' });
    }
    res.json(await buildEdicionPayload(edicion));
  } catch (err) {
    console.error('Error en /api/archivo/:slug/data:', err);
    res.status(500).json({ error: 'Error al obtener los datos' });
  }
});

// Escudos subidos desde el panel de admin.
app.get('/api/logos/:id', async (req, res) => {
  try {
    const logo = await store.getLogo(req.params.id);
    if (!logo) return res.status(404).end();
    res.set('Content-Type', logo.mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(logo.data, 'base64'));
  } catch (err) {
    console.error('Error sirviendo logo:', err);
    res.status(500).end();
  }
});

// --------------------------------------------------------------------------
// API de administración (solo la edición ACTIVA es editable)
// --------------------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD no está configurada en el servidor.' });
  }
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/admin/data', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const [equipos, jornadas, partidos, goleadores, expulsiones, ediciones] = await Promise.all([
      store.getEquipos(activa.id),
      store.getJornadas(activa.id),
      store.getPartidos(activa.id),
      store.getGoleadores(activa.id),
      store.getExpulsiones(activa.id),
      store.getEdiciones(),
    ]);
    const equiposById = new Map(equipos.map((e) => [e.id, e]));
    res.json({
      edicion: { id: activa.id, nombre: activa.nombre, slug: activa.slug },
      equipos,
      jornadas,
      partidos: partidos.map((p) => ({
        ...p,
        home_nombre: p.home_equipo_id ? (equiposById.get(p.home_equipo_id) || {}).nombre : p.home_label,
        away_nombre: p.away_equipo_id ? (equiposById.get(p.away_equipo_id) || {}).nombre : p.away_label,
      })),
      goleadores: goleadores.map((g) => ({
        ...g,
        equipo_nombre: g.equipo_id ? (equiposById.get(g.equipo_id) || {}).nombre : g.legacy_team,
      })),
      expulsiones: expulsiones.map((x) => ({
        ...x,
        equipo_nombre: (equiposById.get(x.equipo_id) || {}).nombre || '—',
      })),
      ediciones: ediciones.map((e) => ({
        id: e.id, nombre: e.nombre, slug: e.slug, activa: e.activa, archivada: e.archivada,
        fecha_inicio: e.fecha_inicio, fecha_fin: e.fecha_fin,
      })),
    });
  } catch (err) {
    console.error('Error en /api/admin/data:', err);
    res.status(500).json({ error: 'Error al obtener los datos de administración' });
  }
});

// Comprueba que el partido existe y pertenece a la edición activa.
async function partidoEditable(req, res) {
  const activa = await getActivaOr503(res);
  if (!activa) return null;
  const partido = await store.getPartido(req.params.id || (req.body || {}).partidoId);
  if (!partido || String(partido.edicion_id) !== String(activa.id)) {
    res.status(400).json({ error: 'El partido no pertenece a la edición activa (las ediciones archivadas no se pueden editar).' });
    return null;
  }
  return { activa, partido };
}

app.post('/api/admin/resultados', requireAdmin, async (req, res) => {
  try {
    const ctx = await partidoEditable(req, res);
    if (!ctx) return;
    const { homeGoals, awayGoals, penalesHome, penalesAway } = req.body || {};
    const hg = Number(homeGoals);
    const ag = Number(awayGoals);
    if (!Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0) {
      return res.status(400).json({ error: 'Marcador inválido' });
    }
    let ph = null;
    let pa = null;
    const conPenales = penalesHome !== undefined && penalesHome !== null && penalesHome !== '' &&
                       penalesAway !== undefined && penalesAway !== null && penalesAway !== '';
    if (conPenales) {
      const jornadas = await store.getJornadas(ctx.activa.id);
      const jornada = jornadas.find((j) => String(j.id) === String(ctx.partido.jornada_id));
      const esEliminatoria = !!jornada && ['semifinal', 'final'].includes(jornada.tipo);
      ph = Number(penalesHome);
      pa = Number(penalesAway);
      if (!esEliminatoria) return res.status(400).json({ error: 'Los penaltis solo aplican a semifinales y final.' });
      if (hg !== ag) return res.status(400).json({ error: 'Los penaltis solo aplican si el partido acaba en empate.' });
      if (!Number.isInteger(ph) || !Number.isInteger(pa) || ph < 0 || pa < 0 || ph === pa) {
        return res.status(400).json({ error: 'Tanda de penaltis inválida (no puede acabar en empate).' });
      }
    }
    await store.setResultado(ctx.partido.id, hg, ag, ph, pa);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando resultado:', err);
    res.status(500).json({ error: 'Error al guardar el resultado' });
  }
});

app.delete('/api/admin/resultados/:id', requireAdmin, async (req, res) => {
  try {
    const ctx = await partidoEditable(req, res);
    if (!ctx) return;
    await store.clearResultado(ctx.partido.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error borrando resultado:', err);
    res.status(500).json({ error: 'Error al borrar el resultado' });
  }
});

app.post('/api/admin/goleadores', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const { player, equipoId, partidoId, goals } = req.body || {};
    const g = Number(goals);
    if (!player || !String(player).trim() || !Number.isInteger(g) || g < 1) {
      return res.status(400).json({ error: 'Datos de goleador inválidos' });
    }
    const equipo = await store.getEquipo(equipoId);
    if (!equipo || String(equipo.edicion_id) !== String(activa.id)) {
      return res.status(400).json({ error: 'El equipo no pertenece a la edición activa.' });
    }
    let partido = null;
    if (partidoId) {
      partido = await store.getPartido(partidoId);
      if (!partido || String(partido.edicion_id) !== String(activa.id)) {
        return res.status(400).json({ error: 'El partido no pertenece a la edición activa.' });
      }
    }
    const id = await store.addGoleador({
      edicionId: activa.id,
      partidoId: partido ? partido.id : null,
      equipoId: equipo.id,
      equipoNombre: equipo.nombre,
      player: String(player).trim(),
      goals: g,
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo goleador:', err);
    res.status(500).json({ error: 'Error al añadir el goleador' });
  }
});

app.delete('/api/admin/goleadores/:id', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const goleador = await store.getGoleador(req.params.id);
    if (!goleador || String(goleador.edicion_id) !== String(activa.id)) {
      return res.status(400).json({ error: 'El goleador no pertenece a la edición activa.' });
    }
    await store.deleteGoleador(goleador.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error borrando goleador:', err);
    res.status(500).json({ error: 'Error al borrar el goleador' });
  }
});

app.post('/api/admin/expulsiones', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const { equipoId, partidoId, jugador, tipo } = req.body || {};
    if (!['roja', 'doble-amarilla'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de expulsión inválido (roja o doble-amarilla).' });
    }
    const equipo = await store.getEquipo(equipoId);
    if (!equipo || String(equipo.edicion_id) !== String(activa.id)) {
      return res.status(400).json({ error: 'El equipo no pertenece a la edición activa.' });
    }
    let partido = null;
    if (partidoId) {
      partido = await store.getPartido(partidoId);
      if (!partido || String(partido.edicion_id) !== String(activa.id)) {
        return res.status(400).json({ error: 'El partido no pertenece a la edición activa.' });
      }
    }
    const id = await store.addExpulsion({
      edicionId: activa.id,
      partidoId: partido ? partido.id : null,
      equipoId: equipo.id,
      jugador: jugador ? String(jugador).trim() : null,
      tipo,
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo expulsión:', err);
    res.status(500).json({ error: 'Error al registrar la expulsión' });
  }
});

app.delete('/api/admin/expulsiones/:id', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const expulsion = await store.getExpulsion(req.params.id);
    if (!expulsion || String(expulsion.edicion_id) !== String(activa.id)) {
      return res.status(400).json({ error: 'La expulsión no pertenece a la edición activa.' });
    }
    await store.deleteExpulsion(expulsion.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error borrando expulsión:', err);
    res.status(500).json({ error: 'Error al borrar la expulsión' });
  }
});

app.put('/api/admin/equipos/:id', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const equipo = await store.getEquipo(req.params.id);
    if (!equipo || String(equipo.edicion_id) !== String(activa.id)) {
      return res.status(400).json({ error: 'El equipo no pertenece a la edición activa.' });
    }
    const { nombre, logoUrl } = req.body || {};
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del equipo no puede estar vacío.' });
    }
    await store.updateEquipo(equipo.id, {
      nombre: String(nombre).trim(),
      logoUrl: logoUrl ? String(logoUrl).trim() : null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error actualizando equipo:', err);
    res.status(500).json({ error: 'Error al actualizar el equipo' });
  }
});

// Subida de escudo (JSON con data URL en base64; se guarda en la BD).
app.post('/api/admin/equipos/:id/logo', requireAdmin, async (req, res) => {
  try {
    const activa = await getActivaOr503(res);
    if (!activa) return;
    const equipo = await store.getEquipo(req.params.id);
    if (!equipo || String(equipo.edicion_id) !== String(activa.id)) {
      return res.status(400).json({ error: 'El equipo no pertenece a la edición activa.' });
    }
    const { dataUrl } = req.body || {};
    const m = /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
    if (!m) return res.status(400).json({ error: 'Imagen inválida (se aceptan PNG, JPEG, WebP o SVG).' });
    if (m[2].length > 2 * 1024 * 1024) return res.status(400).json({ error: 'La imagen es demasiado grande (máximo ~1.5 MB).' });
    const logoId = await store.addLogo(m[1], m[2]);
    await store.updateEquipo(equipo.id, { nombre: equipo.nombre, logoUrl: `/api/logos/${logoId}` });
    res.json({ ok: true, logoUrl: `/api/logos/${logoId}` });
  } catch (err) {
    console.error('Error subiendo logo:', err);
    res.status(500).json({ error: 'Error al subir el escudo' });
  }
});

// --- Gestión de ediciones ---
app.post('/api/admin/ediciones', requireAdmin, async (req, res) => {
  try {
    const { nombre, nombreCorto, slug, fechaInicio, fechaFin } = req.body || {};
    if (!nombre || !slug || !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Hace falta un nombre y un slug (minúsculas, números y guiones).' });
    }
    if (await store.getEdicionBySlug(slug)) {
      return res.status(400).json({ error: 'Ya existe una edición con ese slug.' });
    }
    const id = await store.createEdicion({ nombre, nombreCorto, slug, fechaInicio, fechaFin, info: null });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error creando edición:', err);
    res.status(500).json({ error: 'Error al crear la edición' });
  }
});

app.post('/api/admin/ediciones/:id/activar', requireAdmin, async (req, res) => {
  try {
    await store.activarEdicion(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error activando edición:', err);
    res.status(500).json({ error: 'Error al activar la edición' });
  }
});

// Archivar congela la clasificación final con los criterios vigentes.
app.post('/api/admin/ediciones/:id/archivar', requireAdmin, async (req, res) => {
  try {
    const ediciones = await store.getEdiciones();
    const edicion = ediciones.find((e) => String(e.id) === String(req.params.id));
    if (!edicion) return res.status(404).json({ error: 'Edición no encontrada' });
    const equipos = await store.getEquipos(edicion.id);
    const partidos = await store.getPartidos(edicion.id);
    const expulsiones = await store.getExpulsiones(edicion.id);
    const liga = partidos.filter((p) => p.jornada_tipo === 'liga');
    const standings = computeStandings(equipos, liga, expulsiones);
    await store.setPosicionesFinales(standings.map((r) => ({ equipoId: r.equipo_id, pos: r.pos })));
    await store.archivarEdicion(edicion.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error archivando edición:', err);
    res.status(500).json({ error: 'Error al archivar la edición' });
  }
});

// Equipos, jornadas y partidos de una edición NO archivada (para montar
// futuras ediciones desde el panel sin tocar código).
async function edicionEditable(req, res) {
  const ediciones = await store.getEdiciones();
  const edicion = ediciones.find((e) => String(e.id) === String(req.params.id));
  if (!edicion) {
    res.status(404).json({ error: 'Edición no encontrada' });
    return null;
  }
  if (edicion.archivada) {
    res.status(400).json({ error: 'Las ediciones archivadas no se pueden modificar.' });
    return null;
  }
  return edicion;
}

// Detalle de cualquier edición (para montar futuras ediciones desde el panel).
app.get('/api/admin/ediciones/:id/detalle', requireAdmin, async (req, res) => {
  try {
    const ediciones = await store.getEdiciones();
    const edicion = ediciones.find((e) => String(e.id) === String(req.params.id));
    if (!edicion) return res.status(404).json({ error: 'Edición no encontrada' });
    const [equipos, jornadas, partidos] = await Promise.all([
      store.getEquipos(edicion.id),
      store.getJornadas(edicion.id),
      store.getPartidos(edicion.id),
    ]);
    res.json({ edicion, equipos, jornadas, partidos });
  } catch (err) {
    console.error('Error en detalle de edición:', err);
    res.status(500).json({ error: 'Error al obtener la edición' });
  }
});

app.post('/api/admin/ediciones/:id/equipos', requireAdmin, async (req, res) => {
  try {
    const edicion = await edicionEditable(req, res);
    if (!edicion) return;
    const { nombre, logoUrl } = req.body || {};
    if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'Falta el nombre del equipo.' });
    const id = await store.addEquipo(edicion.id, { nombre: String(nombre).trim(), logoUrl });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo equipo:', err);
    res.status(500).json({ error: 'Error al añadir el equipo' });
  }
});

app.post('/api/admin/ediciones/:id/jornadas', requireAdmin, async (req, res) => {
  try {
    const edicion = await edicionEditable(req, res);
    if (!edicion) return;
    const { orden, label, fecha, tipo, nota } = req.body || {};
    const o = Number(orden);
    if (!Number.isInteger(o) || o < 1 || !label) return res.status(400).json({ error: 'Hacen falta orden y nombre de jornada.' });
    if (tipo && !['liga', 'semifinal', 'final', 'descanso'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de jornada inválido.' });
    }
    const id = await store.addJornada(edicion.id, { orden: o, label, fecha, tipo, nota });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo jornada:', err);
    res.status(500).json({ error: 'Error al añadir la jornada' });
  }
});

app.post('/api/admin/ediciones/:id/partidos', requireAdmin, async (req, res) => {
  try {
    const edicion = await edicionEditable(req, res);
    if (!edicion) return;
    const { jornadaId, matchKey, hora, homeEquipoId, awayEquipoId, homeLabel, awayLabel } = req.body || {};
    const jornadas = await store.getJornadas(edicion.id);
    const jornada = jornadas.find((j) => String(j.id) === String(jornadaId));
    if (!jornada) return res.status(400).json({ error: 'La jornada no pertenece a esta edición.' });
    if (!matchKey || !/^[a-z0-9-]+$/.test(matchKey)) {
      return res.status(400).json({ error: 'Falta el identificador del partido (minúsculas, números y guiones).' });
    }
    const partidos = await store.getPartidos(edicion.id);
    if (partidos.some((p) => p.match_key === matchKey)) {
      return res.status(400).json({ error: 'Ya existe un partido con ese identificador en esta edición.' });
    }
    for (const eqId of [homeEquipoId, awayEquipoId]) {
      if (eqId) {
        const eq = await store.getEquipo(eqId);
        if (!eq || String(eq.edicion_id) !== String(edicion.id)) {
          return res.status(400).json({ error: 'Los equipos deben pertenecer a esta edición.' });
        }
      }
    }
    const id = await store.addPartido(edicion.id, jornada.id, { matchKey, hora, homeEquipoId, awayEquipoId, homeLabel, awayLabel });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error añadiendo partido:', err);
    res.status(500).json({ error: 'Error al añadir el partido' });
  }
});

// --------------------------------------------------------------------------
// Páginas
// --------------------------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, 'public');
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/archivo', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'archivo.html')));
app.get('/archivo/:slug', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// --------------------------------------------------------------------------
// Arranque
// --------------------------------------------------------------------------
function start() {
  store
    .init()
    .then(() => {
      app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('No se pudo inicializar la base de datos:', err);
      app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT} (sin BD)`));
    });
}

if (require.main === module) {
  start();
}

module.exports = { app, store, buildEdicionPayload };
