'use strict';

// ---------------------------------------------------------------------------
// Estado y utilidades
// ---------------------------------------------------------------------------
let DATA = null; // datos del torneo recibidos del servidor

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Iniciales para los escudos placeholder.
function initials(name) {
  return name
    .replace(/FC|PPFC/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Contenido del escudo de un equipo: imagen si existe, iniciales si no
// (p. ej. "1º clasificado" en semifinales y final).
function badgeContent(team) {
  const src = (DATA && DATA.badges && DATA.badges[team]) || null;
  return src
    ? `<img src="${escapeHtml(src)}" alt="Escudo de ${escapeHtml(team)}" loading="lazy" />`
    : escapeHtml(initials(team));
}

// Sesión de admin: la contraseña se guarda solo en sessionStorage.
function getToken() { return sessionStorage.getItem('hpp_admin') || ''; }
function setToken(t) { sessionStorage.setItem('hpp_admin', t); }
function clearToken() { sessionStorage.removeItem('hpp_admin'); }

// Peticiones a la API.
async function apiGet() {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('No se pudieron cargar los datos');
  return res.json();
}
async function apiWrite(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Error en la petición');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Carga y renderizado global
// ---------------------------------------------------------------------------
async function loadData() {
  DATA = await apiGet();
  renderTeams();
  renderSchedule();
  renderStandings();
  renderScorers();
  if (getToken()) renderAdminData();
}

function resultMap() {
  const map = new Map();
  (DATA.results || []).forEach((r) => map.set(r.match_id, r));
  return map;
}

// ---------------------------------------------------------------------------
// EQUIPOS
// ---------------------------------------------------------------------------
function renderTeams() {
  $('#teamsGrid').innerHTML = DATA.teams
    .map(
      (t) => `
      <div class="team-card">
        <div class="team-badge">${badgeContent(t)}</div>
        <h3>${escapeHtml(t)}</h3>
      </div>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// CALENDARIO
// ---------------------------------------------------------------------------
// Goleadores de un equipo en un partido concreto (lista pequeña bajo el nombre).
function matchScorers(team, matchId) {
  const list = (DATA.scorers || []).filter(
    (s) => s.match_id === matchId && s.team === team && s.goals > 0
  );
  if (!list.length) return '';
  const items = list
    .map(
      (s) =>
        `<li>⚽ ${escapeHtml(s.player)}${s.goals > 1 ? ` <span class="x-goals">×${s.goals}</span>` : ''}</li>`
    )
    .join('');
  return `<ul class="match-scorers">${items}</ul>`;
}

function renderSchedule() {
  const results = resultMap();
  $('#scheduleWrap').innerHTML = DATA.schedule
    .map((round) => {
      const knockout = round.type !== 'liga';
      const cards = round.matches
        .map((m) => {
          const r = results.get(m.id);
          const center = r
            ? `<div class="match-score">${r.home_goals}<span class="sep">·</span>${r.away_goals}</div>`
            : `<div class="match-vs">VS</div>`;
          return `
          <div class="match-card">
            <div class="match-top">
              <span class="time">${escapeHtml(m.time)}</span>
              <span>${escapeHtml(round.label)}</span>
            </div>
            <div class="match-body">
              <div class="match-team">
                <div class="mini-badge">${badgeContent(m.home)}</div>
                <span class="name">${escapeHtml(m.home)}</span>
                ${matchScorers(m.home, m.id)}
              </div>
              <div class="match-center">${center}</div>
              <div class="match-team">
                <div class="mini-badge">${badgeContent(m.away)}</div>
                <span class="name">${escapeHtml(m.away)}</span>
                ${matchScorers(m.away, m.id)}
              </div>
            </div>
          </div>`;
        })
        .join('');
      const restTeams = round.rest ? [].concat(round.rest) : [];
      const rest = restTeams.length
        ? `<div class="round-rest">
            ${restTeams.map((t) => `<span class="rest-badge">${badgeContent(t)}</span>`).join('')}
            <span>${restTeams.length > 1 ? 'Descansan' : 'Descansa'}:
              <strong>${restTeams.map(escapeHtml).join(' y ')}</strong></span>
          </div>`
        : '';
      return `
        <div class="round-block">
          <div class="round-head">
            <span class="round-badge ${knockout ? 'knockout' : ''}">${escapeHtml(round.label)}</span>
            ${round.date ? `<span class="round-date">${escapeHtml(round.date)}</span>` : ''}
          </div>
          <div class="matches">${cards}</div>
          ${rest}
        </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// CLASIFICACIÓN
// ---------------------------------------------------------------------------
function renderStandings() {
  const body = $('#standingsBody');
  const rows = DATA.standings || [];
  body.innerHTML = rows
    .map((r) => {
      const qualify = r.pos <= 4 ? 'qualify' : '';
      return `
      <tr class="${qualify}">
        <td class="col-pos">${r.pos}</td>
        <td class="col-team">
          <div class="team-cell">
            <span class="dot">${badgeContent(r.team)}</span>
            <span>${escapeHtml(r.team)}</span>
          </div>
        </td>
        <td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td>
        <td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? '+' + r.dg : r.dg}</td>
        <td>${r.red}</td>
        <td class="col-pts">${r.pts}</td>
      </tr>`;
    })
    .join('');
}

function renderScorers() {
  const body = $('#scorersBody');
  // Los goles se registran por partido: el Pichichi agrega el total por jugador.
  const totals = new Map();
  for (const s of DATA.scorers || []) {
    if (!(s.goals > 0)) continue;
    const k = s.player + '|' + s.team;
    const cur = totals.get(k) || { player: s.player, team: s.team, goals: 0 };
    cur.goals += s.goals;
    totals.set(k, cur);
  }
  const scorers = Array.from(totals.values()).sort(
    (a, b) => b.goals - a.goals || a.player.localeCompare(b.player, 'es')
  );
  if (!scorers.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="4">Aún no hay goleadores registrados.</td></tr>`;
    return;
  }
  body.innerHTML = scorers
    .map(
      (s, i) => `
      <tr>
        <td class="col-pos">${i + 1}</td>
        <td class="col-team">${escapeHtml(s.player)}</td>
        <td>${escapeHtml(s.team)}</td>
        <td class="col-pts">${s.goals}</td>
      </tr>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
function showAdminPanel(show) {
  $('#adminLogin').hidden = show;
  $('#adminPanel').hidden = !show;
}

function fillTeamSelects() {
  const options = DATA.teams.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  $('#scorerTeam').innerHTML = options;
  $('#cardTeam').innerHTML = options;
  $('#scorerMatch').innerHTML = DATA.schedule
    .flatMap((round) =>
      round.matches.map(
        (m) =>
          `<option value="${escapeHtml(m.id)}">${escapeHtml(matchLabel(round, m))}</option>`
      )
    )
    .join('');
}

// Etiqueta corta de un partido para selects y tablas de admin.
function matchLabel(round, m) {
  return `${round.label} · ${m.home} vs ${m.away}`;
}

function matchLabelById(matchId) {
  for (const round of DATA.schedule) {
    const m = round.matches.find((x) => x.id === matchId);
    if (m) return matchLabel(round, m);
  }
  return matchId || '—';
}

function renderAdminData() {
  fillTeamSelects();
  renderAdminResults();
  renderAdminScorers();
  renderAdminCards();
}

function renderAdminResults() {
  const results = resultMap();
  const html = DATA.schedule
    .map((round) => {
      const rows = round.matches
        .map((m) => {
          const r = results.get(m.id);
          const hg = r ? r.home_goals : '';
          const ag = r ? r.away_goals : '';
          return `
          <div class="admin-result-row" data-match="${m.id}">
            <div class="ar-round">${escapeHtml(round.label)} · ${escapeHtml(m.time)}</div>
            <div class="ar-team">${escapeHtml(m.home)}</div>
            <div class="ar-controls">
              <input type="number" min="0" class="ar-home" value="${hg}" placeholder="-" />
              <span>:</span>
              <input type="number" min="0" class="ar-away" value="${ag}" placeholder="-" />
            </div>
            <div class="ar-team away">${escapeHtml(m.away)}</div>
            <div class="ar-actions">
              <button class="btn btn-primary btn-sm ar-save">Guardar</button>
              ${r ? '<button class="btn btn-danger btn-sm ar-clear">Borrar</button>' : ''}
            </div>
          </div>`;
        })
        .join('');
      return rows;
    })
    .join('');
  $('#adminResults').innerHTML = html;
}

function renderAdminScorers() {
  const body = $('#adminScorersBody');
  const scorers = DATA.scorers || [];
  if (!scorers.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="5">Sin goleadores.</td></tr>`;
    return;
  }
  body.innerHTML = scorers
    .map(
      (s) => `
      <tr data-id="${s.id}">
        <td>${escapeHtml(s.player)}</td>
        <td>${escapeHtml(s.team)}</td>
        <td>${s.match_id ? escapeHtml(matchLabelById(s.match_id)) : '—'}</td>
        <td class="center">${s.goals}</td>
        <td class="center"><button class="row-del" data-del-scorer="${s.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
}

function renderAdminCards() {
  const body = $('#adminCardsBody');
  const cards = DATA.cards || [];
  if (!cards.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="4">Sin tarjetas.</td></tr>`;
    return;
  }
  body.innerHTML = cards
    .map(
      (c) => `
      <tr data-id="${c.id}">
        <td>${escapeHtml(c.player)}</td>
        <td>${escapeHtml(c.team)}</td>
        <td class="center"><span class="pill-${c.type}">${c.type === 'roja' ? '🟥 Roja' : '🟨 Amarilla'}</span></td>
        <td class="center"><button class="row-del" data-del-card="${c.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'form-msg ' + (ok ? 'ok' : 'err');
}

function initEvents() {
  // Menú móvil
  $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  $$('#navLinks a').forEach((a) =>
    a.addEventListener('click', () => $('#navLinks').classList.remove('open'))
  );

  // Login
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = $('#adminPassword').value;
    const msg = $('#loginMsg');
    try {
      await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      }).then((r) => {
        if (!r.ok) throw new Error('Contraseña incorrecta');
      });
      setToken(pwd);
      $('#adminPassword').value = '';
      setMsg(msg, '', true);
      showAdminPanel(true);
      renderAdminData();
    } catch (err) {
      setMsg(msg, err.message || 'Error al iniciar sesión', false);
    }
  });

  // Logout
  $('#logoutBtn').addEventListener('click', () => {
    clearToken();
    showAdminPanel(false);
  });

  // Pestañas admin
  $$('.atab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.atab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.atab-panel').forEach((p) => (p.hidden = true));
      $('#tab-' + tab.dataset.tab).hidden = false;
    })
  );

  // Guardar / borrar resultados (delegación de eventos)
  $('#adminResults').addEventListener('click', async (e) => {
    const row = e.target.closest('.admin-result-row');
    if (!row) return;
    const matchId = row.dataset.match;

    if (e.target.classList.contains('ar-save')) {
      const homeGoals = $('.ar-home', row).value;
      const awayGoals = $('.ar-away', row).value;
      if (homeGoals === '' || awayGoals === '') {
        alert('Introduce ambos marcadores.');
        return;
      }
      try {
        await apiWrite('POST', '/api/results', {
          matchId,
          homeGoals: parseInt(homeGoals, 10),
          awayGoals: parseInt(awayGoals, 10),
        });
        await refreshAfterWrite();
      } catch (err) {
        handleWriteError(err);
      }
    }

    if (e.target.classList.contains('ar-clear')) {
      if (!confirm('¿Borrar el resultado de este partido?')) return;
      try {
        await apiWrite('DELETE', '/api/results/' + encodeURIComponent(matchId));
        await refreshAfterWrite();
      } catch (err) {
        handleWriteError(err);
      }
    }
  });

  // Añadir goleador
  $('#scorerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#scorerMsg');
    try {
      await apiWrite('POST', '/api/scorers', {
        player: $('#scorerPlayer').value,
        team: $('#scorerTeam').value,
        matchId: $('#scorerMatch').value,
        goals: parseInt($('#scorerGoals').value, 10),
      });
      $('#scorerPlayer').value = '';
      $('#scorerGoals').value = '1';
      setMsg(msg, 'Goleador añadido.', true);
      await refreshAfterWrite();
    } catch (err) {
      setMsg(msg, err.message, false);
      handleWriteError(err);
    }
  });

  // Borrar goleador
  $('#adminScorersBody').addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-del-scorer');
    if (!id) return;
    if (!confirm('¿Eliminar este goleador?')) return;
    try {
      await apiWrite('DELETE', '/api/scorers/' + id);
      await refreshAfterWrite();
    } catch (err) {
      handleWriteError(err);
    }
  });

  // Registrar tarjeta
  $('#cardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#cardMsg');
    try {
      await apiWrite('POST', '/api/cards', {
        player: $('#cardPlayer').value,
        team: $('#cardTeam').value,
        type: $('#cardType').value,
      });
      $('#cardPlayer').value = '';
      setMsg(msg, 'Tarjeta registrada.', true);
      await refreshAfterWrite();
    } catch (err) {
      setMsg(msg, err.message, false);
      handleWriteError(err);
    }
  });

  // Borrar tarjeta
  $('#adminCardsBody').addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-del-card');
    if (!id) return;
    if (!confirm('¿Eliminar esta tarjeta?')) return;
    try {
      await apiWrite('DELETE', '/api/cards/' + id);
      await refreshAfterWrite();
    } catch (err) {
      handleWriteError(err);
    }
  });
}

function handleWriteError(err) {
  if (err.status === 401) {
    alert('Tu sesión ha caducado o la contraseña no es válida. Vuelve a iniciar sesión.');
    clearToken();
    showAdminPanel(false);
  } else {
    alert(err.message || 'Error al guardar.');
  }
}

// Recarga todos los datos desde la API tras una escritura.
async function refreshAfterWrite() {
  await loadData();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async function init() {
  initEvents();
  try {
    await loadData();
    if (getToken()) showAdminPanel(true);
  } catch (err) {
    console.error(err);
  }
})();
