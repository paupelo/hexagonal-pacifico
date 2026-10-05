'use strict';

// ---------------------------------------------------------------------------
// Vista pública del torneo. Sirve tanto para la edición activa (/) como para
// una edición archivada (/archivo/:slug); en el segundo caso pide primero la
// contraseña del archivo si no hay cookie de sesión.
// ---------------------------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);

const archiveMatch = location.pathname.match(/^\/archivo\/([a-z0-9-]+)\/?$/);
const ARCHIVE_SLUG = archiveMatch ? archiveMatch[1] : null;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function initials(name) {
  return String(name || '')
    .replace(/\bFC\b|\bPPFC\b/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

// Escudo en círculo: imagen si hay logo (con fallback a iniciales si la
// imagen falla) y placeholder con iniciales o el ordinal si no lo hay.
function badge(side, { large = false } = {}) {
  const cls = `badge-circle${large ? ' badge-lg' : ''}`;
  if (side && side.logo_url) {
    const fallback = escapeHtml(initials(side.nombre));
    return `<span class="${cls}"><img src="${escapeHtml(side.logo_url)}" alt="" loading="lazy"
      onerror="this.parentNode.textContent='${fallback}'" /></span>`;
  }
  if (side && side.nombre) return `<span class="${cls}">${escapeHtml(initials(side.nombre))}</span>`;
  const ph = side && side.placeholder ? side.placeholder.match(/\d+º|SF\s?\d|GF?/) : null;
  return `<span class="${cls} badge-ph">${escapeHtml(ph ? ph[0] : '?')}</span>`;
}

function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(data) {
  const ed = data.edicion;

  if (ed.archivada) {
    const banner = $('#archiveBanner');
    banner.hidden = false;
    banner.innerHTML = `📁 Edición archivada – ${escapeHtml(ed.nombre_corto || ed.nombre)} · <a href="/">Ir a la edición actual</a>`;
    document.title = `${ed.nombre_corto || ''} · Hexagonal Panamá Pacífico (archivo)`;
  }

  $('#heroBadge').textContent = ed.nombre_corto || ed.slug;
  const info = ed.info || {};
  $('#heroMeta').innerHTML = [
    info.sede ? `<span>📍 ${escapeHtml(info.sede)}</span>` : '',
    info.dias ? `<span>📅 ${escapeHtml(info.dias)}</span>` : '',
  ].join('');

  renderStandings(data);
  renderSchedule(data);
  renderScorers(data);
  renderFormat(data);

  $('#loading').hidden = true;
  $('#content').hidden = false;
}

function renderStandings(data) {
  $('#standingsBody').innerHTML = data.clasificacion
    .map((r) => `
      <tr class="${r.pos <= 4 ? 'qualify' : ''}">
        <td class="pos-cell">${r.pos}</td>
        <td><div class="team-cell">${badge(r)}<span>${escapeHtml(r.nombre)}</span></div></td>
        <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
        <td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? '+' + r.dg : r.dg}</td>
        <td class="pts-cell">${r.pts}</td>
      </tr>`)
    .join('');
}

function scorersOf(data, partidoId, equipoId) {
  const list = (data.goleadores_detalle || []).filter(
    (g) => g.partido_id === partidoId && g.equipo_id === equipoId && g.goals > 0
  );
  if (!list.length) return '';
  return `<ul class="match-scorers">${list
    .map((g) => `<li>⚽ ${escapeHtml(g.player)}${g.goals > 1 ? ` ×${g.goals}` : ''}</li>`)
    .join('')}</ul>`;
}

function expulsionesOf(data, partidoId, equipoId) {
  const list = (data.expulsiones || []).filter(
    (x) => x.partido_id === partidoId && x.equipo_id === equipoId
  );
  if (!list.length) return '';
  return `<ul class="match-scorers">${list
    .map((x) => `<li>🟥 ${x.jugador ? `${escapeHtml(x.jugador)} ` : ''}${x.tipo === 'doble-amarilla' ? '(doble amarilla)' : '(roja directa)'}</li>`)
    .join('')}</ul>`;
}

function renderSchedule(data) {
  $('#calendarioSub').textContent = (data.edicion.info || {}).dias || '';
  $('#scheduleWrap').innerHTML = data.jornadas
    .map((j) => {
      const knockout = j.tipo === 'semifinal' || j.tipo === 'final';
      let body;
      if (j.tipo === 'descanso') {
        body = `<div class="rest-card">🎉 ${escapeHtml(j.nota || 'Sin partidos')}</div>`;
      } else {
        body = `<div class="matches">${j.partidos
          .map((p) => {
            const center = p.jugado
              ? `<div class="match-score">${p.home_goals}<span class="sep">·</span>${p.away_goals}</div>` +
                (p.penales_home !== null && p.penales_away !== null
                  ? `<div class="match-pens">${p.penales_home}–${p.penales_away} pen.</div>`
                  : '')
              : `<div class="match-time">${escapeHtml(p.hora || '')}</div>`;
            const side = (s, id) => `
              <div class="match-team">
                ${badge(s, { large: true })}
                <span class="name ${s.nombre ? '' : 'placeholder'}">${escapeHtml(s.nombre || s.placeholder || '—')}</span>
                ${s.equipo_id ? scorersOf(data, p.id, s.equipo_id) + expulsionesOf(data, p.id, s.equipo_id) : ''}
              </div>`;
            return `
              <div class="match-card ${j.partidos.length === 1 ? 'solo' : ''}">
                <div class="match-grid">
                  ${side(p.home)}
                  <div class="match-center">${center}</div>
                  ${side(p.away)}
                </div>
              </div>`;
          })
          .join('')}</div>`;
      }
      return `
        <div class="round-block">
          <div class="round-head">
            <span class="round-label ${knockout ? 'knockout' : ''}">${escapeHtml(j.label)}</span>
            ${j.fecha ? `<span class="round-date">${escapeHtml(j.fecha)}</span>` : ''}
          </div>
          ${body}
          ${j.tipo !== 'descanso' && j.nota ? `<div class="round-nota">${escapeHtml(j.nota)}</div>` : ''}
        </div>`;
    })
    .join('');
}

function renderScorers(data) {
  const body = $('#scorersBody');
  if (!data.goleadores.length) {
    body.innerHTML = `<tr><td colspan="4" style="color:var(--muted-3)">Aún no hay goleadores registrados.</td></tr>`;
    return;
  }
  body.innerHTML = data.goleadores
    .map((s, i) => `
      <tr>
        <td class="pos-cell">${i + 1}</td>
        <td style="text-align:left;font-weight:700">${escapeHtml(s.player)}</td>
        <td><div class="scorer-team">${badge(s.equipo)}<span>${escapeHtml(s.equipo.nombre)}</span></div></td>
        <td class="goals-cell">${s.goals}</td>
      </tr>`)
    .join('');
}

function renderFormat(data) {
  const info = data.edicion.info || {};
  $('#formatoSub').textContent = info.sede || '';
  const card = (title, items, ordered = false) => {
    if (!items || !items.length) return '';
    const tag = ordered ? 'ol' : 'ul';
    return `<div class="format-card"><h3>${title}</h3><${tag}>${items
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join('')}</${tag}></div>`;
  };
  $('#formatGrid').innerHTML =
    card('Formato', info.formato) +
    card('Horarios', info.turnos) +
    card('Criterios de desempate', info.desempate, true) +
    card('Régimen disciplinario', info.disciplina) +
    card('Sede y días', [info.sede, info.dias].filter(Boolean));
}

// ---------------------------------------------------------------------------
// Carga (con puerta de contraseña para el archivo)
// ---------------------------------------------------------------------------
async function loadData() {
  const url = ARCHIVE_SLUG ? `/api/archivo/${ARCHIVE_SLUG}/data` : '/api/data';
  const res = await fetch(url);
  if (res.status === 401 && ARCHIVE_SLUG) {
    $('#loading').hidden = true;
    $('#gate').hidden = false;
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $('#loading').textContent = err.error || 'No se pudieron cargar los datos.';
    return;
  }
  render(await res.json());
}

$('#gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#gateMsg');
  msg.className = 'form-msg';
  msg.textContent = '';
  const res = await fetch('/api/archivo/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: $('#gatePassword').value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg.className = 'form-msg err';
    msg.textContent = err.error || 'Contraseña incorrecta';
    return;
  }
  $('#gate').hidden = true;
  $('#loading').hidden = false;
  await loadData();
});

loadData().catch((err) => {
  console.error(err);
  $('#loading').textContent = 'No se pudieron cargar los datos.';
});
