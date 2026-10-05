'use strict';

// ---------------------------------------------------------------------------
// Panel de administración: solo la edición ACTIVA es editable.
// ---------------------------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let DATA = null; // /api/admin/data

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function getToken() { return sessionStorage.getItem('hpp_admin') || ''; }
function setToken(t) { sessionStorage.setItem('hpp_admin', t); }
function clearToken() { sessionStorage.removeItem('hpp_admin'); }

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: getToken() },
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

function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'form-msg ' + (ok ? 'ok' : 'err');
}

function handleError(err, msgEl) {
  if (err.status === 401) {
    alert('Tu sesión ha caducado o la contraseña no es válida. Vuelve a iniciar sesión.');
    clearToken();
    showPanel(false);
  } else if (msgEl) {
    setMsg(msgEl, err.message || 'Error al guardar.', false);
  } else {
    alert(err.message || 'Error al guardar.');
  }
}

function showPanel(show) {
  $('#adminLogin').hidden = show;
  $('#adminPanel').hidden = !show;
  $('#logoutBtn').hidden = !show;
}

// ---------------------------------------------------------------------------
// Carga y render
// ---------------------------------------------------------------------------
async function loadData() {
  DATA = await api('GET', '/api/admin/data');
  $('#edicionActual').innerHTML =
    `Edición activa: <strong>${escapeHtml(DATA.edicion.nombre)}</strong>. Las ediciones archivadas no se pueden modificar.`;
  renderResults();
  renderScorerForm();
  renderScorers();
  renderCardForm();
  renderCards();
  renderTeams();
  renderEditions();
  await renderBuilder();
}

function matchLabel(p) {
  return `${p.jornada_label} · ${p.home_nombre || '—'} vs ${p.away_nombre || '—'}`;
}

function renderResults() {
  $('#adminResults').innerHTML = DATA.partidos
    .filter((p) => p.jornada_tipo !== 'descanso')
    .map((p) => {
      const knockout = ['semifinal', 'final'].includes(p.jornada_tipo);
      const pens = knockout
        ? `<span class="pens-label">Penaltis:</span>
           <input type="number" min="0" class="ar-ph" value="${p.penales_home ?? ''}" placeholder="-" />
           <span>:</span>
           <input type="number" min="0" class="ar-pa" value="${p.penales_away ?? ''}" placeholder="-" />`
        : '';
      return `
      <div class="ar-row" data-id="${p.id}">
        <div class="ar-meta">${escapeHtml(p.jornada_label)} · ${escapeHtml(p.hora || '')}</div>
        <div class="ar-match">${escapeHtml(p.home_nombre || '—')} vs ${escapeHtml(p.away_nombre || '—')}</div>
        <div class="ar-controls">
          <input type="number" min="0" class="ar-home" value="${p.home_goals ?? ''}" placeholder="-" />
          <span>:</span>
          <input type="number" min="0" class="ar-away" value="${p.away_goals ?? ''}" placeholder="-" />
          ${pens}
          <button class="btn btn-primary btn-sm ar-save">Guardar</button>
          ${p.home_goals !== null ? '<button class="btn btn-danger btn-sm ar-clear">Borrar</button>' : ''}
        </div>
      </div>`;
    })
    .join('');
}

function renderScorerForm() {
  $('#scorerTeam').innerHTML = DATA.equipos
    .map((e) => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`)
    .join('');
  $('#scorerMatch').innerHTML =
    '<option value="">— Sin partido —</option>' +
    DATA.partidos
      .filter((p) => p.jornada_tipo !== 'descanso')
      .map((p) => `<option value="${p.id}">${escapeHtml(matchLabel(p))}</option>`)
      .join('');
}

function renderScorers() {
  const body = $('#adminScorersBody');
  if (!DATA.goleadores.length) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--muted-3)">Sin goleadores.</td></tr>`;
    return;
  }
  const partidosById = new Map(DATA.partidos.map((p) => [p.id, p]));
  body.innerHTML = DATA.goleadores
    .map((g) => {
      const p = g.partido_id ? partidosById.get(g.partido_id) : null;
      return `
      <tr>
        <td style="text-align:left">${escapeHtml(g.player)}</td>
        <td style="text-align:left">${escapeHtml(g.equipo_nombre || '—')}</td>
        <td style="text-align:left">${p ? escapeHtml(matchLabel(p)) : '—'}</td>
        <td>${g.goals}</td>
        <td><button class="row-del" data-del-scorer="${g.id}">Eliminar</button></td>
      </tr>`;
    })
    .join('');
}

function renderCardForm() {
  $('#cardTeam').innerHTML = DATA.equipos
    .map((e) => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`)
    .join('');
  $('#cardMatch').innerHTML =
    '<option value="">— Sin partido —</option>' +
    DATA.partidos
      .filter((p) => p.jornada_tipo !== 'descanso')
      .map((p) => `<option value="${p.id}">${escapeHtml(matchLabel(p))}</option>`)
      .join('');
}

function renderCards() {
  const body = $('#adminCardsBody');
  const expulsiones = DATA.expulsiones || [];
  if (!expulsiones.length) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--muted-3)">Sin expulsiones.</td></tr>`;
    return;
  }
  const partidosById = new Map(DATA.partidos.map((p) => [p.id, p]));
  body.innerHTML = expulsiones
    .map((x) => {
      const p = x.partido_id ? partidosById.get(x.partido_id) : null;
      return `
      <tr>
        <td style="text-align:left">${escapeHtml(x.equipo_nombre)}</td>
        <td style="text-align:left">${p ? escapeHtml(matchLabel(p)) : '—'}</td>
        <td>🟥 ${x.tipo === 'doble-amarilla' ? 'Doble amarilla' : 'Roja directa'}</td>
        <td style="text-align:left">${escapeHtml(x.jugador || '—')}</td>
        <td><button class="row-del" data-del-card="${x.id}">Eliminar</button></td>
      </tr>`;
    })
    .join('');
}

function renderTeams() {
  $('#adminTeams').innerHTML = DATA.equipos
    .map(
      (e) => `
    <div class="ar-row" data-team="${e.id}">
      <div class="ar-controls">
        <span class="badge-circle logo-preview">${e.logo_url ? `<img src="${escapeHtml(e.logo_url)}" alt="" />` : ''}</span>
        <input type="text" class="input eq-nombre" value="${escapeHtml(e.nombre)}" style="flex:1;min-width:150px" />
        <input type="text" class="input eq-logo" value="${escapeHtml(e.logo_url || '')}" placeholder="/escudos/…" style="flex:1;min-width:150px" />
        <input type="file" class="eq-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="max-width:180px" />
        <button class="btn btn-primary btn-sm eq-save">Guardar</button>
      </div>
    </div>`
    )
    .join('');
}

function renderEditions() {
  $('#adminEditionsBody').innerHTML = DATA.ediciones
    .map((e) => {
      const estado = e.activa
        ? '<span class="pill pill-activa">Activa</span>'
        : e.archivada
          ? '<span class="pill pill-archivada">Archivada</span>'
          : '<span class="pill pill-borrador">Borrador</span>';
      const acciones = [
        !e.activa ? `<button class="btn btn-ghost btn-sm" data-activar="${e.id}">Activar</button>` : '',
        !e.archivada ? `<button class="btn btn-danger btn-sm" data-archivar="${e.id}">Archivar</button>` : '',
      ].join(' ');
      return `
      <tr>
        <td style="text-align:left;font-weight:700">${escapeHtml(e.nombre)}</td>
        <td style="text-align:left">${escapeHtml(e.slug)}</td>
        <td>${estado}</td>
        <td>${acciones}</td>
      </tr>`;
    })
    .join('');
}

// --- Constructor de ediciones futuras -------------------------------------
async function renderBuilder() {
  const sel = $('#builderEdition');
  const editables = DATA.ediciones.filter((e) => !e.archivada);
  sel.innerHTML = editables
    .map((e) => `<option value="${e.id}" ${e.activa ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`)
    .join('');
  await refreshBuilderDetail();
}

async function refreshBuilderDetail() {
  const id = $('#builderEdition').value;
  if (!id) {
    $('#builderDetail').textContent = '';
    return;
  }
  try {
    const d = await api('GET', `/api/admin/ediciones/${id}/detalle`);
    $('#builderDetail').textContent =
      `${d.equipos.length} equipos · ${d.jornadas.length} jornadas · ${d.partidos.length} partidos`;
    $('#bpJornada').innerHTML = d.jornadas
      .map((j) => `<option value="${j.id}">${escapeHtml(`${j.orden}. ${j.label}`)}</option>`)
      .join('');
    const teamOptions =
      '<option value="">— placeholder —</option>' +
      d.equipos.map((e) => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('');
    $('#bpHome').innerHTML = teamOptions;
    $('#bpAway').innerHTML = teamOptions;
  } catch (err) {
    handleError(err);
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function initEvents() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = $('#adminPassword').value;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) throw new Error('Contraseña incorrecta');
      setToken(pwd);
      $('#adminPassword').value = '';
      showPanel(true);
      await loadData();
    } catch (err) {
      setMsg($('#loginMsg'), err.message || 'Error al iniciar sesión', false);
    }
  });

  $('#logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    clearToken();
    showPanel(false);
  });

  $$('.atab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.atab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.atab-panel').forEach((p) => (p.hidden = true));
      $('#tab-' + tab.dataset.tab).hidden = false;
    })
  );

  // Resultados
  $('#adminResults').addEventListener('click', async (e) => {
    const row = e.target.closest('.ar-row');
    if (!row) return;
    const partidoId = row.dataset.id;
    if (e.target.classList.contains('ar-save')) {
      const hg = $('.ar-home', row).value;
      const ag = $('.ar-away', row).value;
      if (hg === '' || ag === '') return alert('Introduce ambos marcadores.');
      const phEl = $('.ar-ph', row);
      const paEl = $('.ar-pa', row);
      try {
        await api('POST', '/api/admin/resultados', {
          partidoId,
          homeGoals: parseInt(hg, 10),
          awayGoals: parseInt(ag, 10),
          penalesHome: phEl && phEl.value !== '' ? parseInt(phEl.value, 10) : null,
          penalesAway: paEl && paEl.value !== '' ? parseInt(paEl.value, 10) : null,
        });
        await loadData();
      } catch (err) { handleError(err); }
    }
    if (e.target.classList.contains('ar-clear')) {
      if (!confirm('¿Borrar el resultado de este partido?')) return;
      try {
        await api('DELETE', '/api/admin/resultados/' + partidoId);
        await loadData();
      } catch (err) { handleError(err); }
    }
  });

  // Goleadores
  $('#scorerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#scorerMsg');
    try {
      await api('POST', '/api/admin/goleadores', {
        player: $('#scorerPlayer').value,
        equipoId: $('#scorerTeam').value,
        partidoId: $('#scorerMatch').value || null,
        goals: parseInt($('#scorerGoals').value, 10),
      });
      $('#scorerPlayer').value = '';
      $('#scorerGoals').value = '1';
      setMsg(msg, 'Goleador añadido.', true);
      await loadData();
    } catch (err) { handleError(err, msg); }
  });

  $('#adminScorersBody').addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-del-scorer');
    if (!id) return;
    if (!confirm('¿Eliminar este goleador?')) return;
    try {
      await api('DELETE', '/api/admin/goleadores/' + id);
      await loadData();
    } catch (err) { handleError(err); }
  });

  // Expulsiones
  $('#cardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#cardMsg');
    try {
      await api('POST', '/api/admin/expulsiones', {
        equipoId: $('#cardTeam').value,
        partidoId: $('#cardMatch').value || null,
        tipo: $('#cardType').value,
        jugador: $('#cardPlayer').value || null,
      });
      $('#cardPlayer').value = '';
      setMsg(msg, 'Expulsión registrada.', true);
      await loadData();
    } catch (err) { handleError(err, msg); }
  });

  $('#adminCardsBody').addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-del-card');
    if (!id) return;
    if (!confirm('¿Eliminar esta expulsión?')) return;
    try {
      await api('DELETE', '/api/admin/expulsiones/' + id);
      await loadData();
    } catch (err) { handleError(err); }
  });

  // Equipos
  $('#adminTeams').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('eq-save')) return;
    const row = e.target.closest('.ar-row');
    const equipoId = row.dataset.team;
    try {
      const file = $('.eq-file', row).files[0];
      let logoUrl = $('.eq-logo', row).value.trim() || null;
      if (file) {
        if (file.size > 1.5 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máximo 1.5 MB).');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const up = await api('POST', `/api/admin/equipos/${equipoId}/logo`, { dataUrl });
        logoUrl = up.logoUrl;
      }
      await api('PUT', `/api/admin/equipos/${equipoId}`, {
        nombre: $('.eq-nombre', row).value,
        logoUrl,
      });
      await loadData();
    } catch (err) { handleError(err); }
  });

  // Ediciones: activar / archivar
  $('#adminEditionsBody').addEventListener('click', async (e) => {
    const act = e.target.getAttribute('data-activar');
    const arc = e.target.getAttribute('data-archivar');
    try {
      if (act) {
        if (!confirm('¿Convertir esta edición en la portada de la web?')) return;
        await api('POST', `/api/admin/ediciones/${act}/activar`);
        await loadData();
      }
      if (arc) {
        if (!confirm('¿Archivar esta edición? Su clasificación final quedará congelada y ya no se podrá editar.')) return;
        await api('POST', `/api/admin/ediciones/${arc}/archivar`);
        await loadData();
      }
    } catch (err) { handleError(err); }
  });

  // Crear edición
  $('#editionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#editionMsg');
    try {
      await api('POST', '/api/admin/ediciones', {
        nombre: $('#edNombre').value,
        nombreCorto: $('#edNombreCorto').value || null,
        slug: $('#edSlug').value,
        fechaInicio: $('#edInicio').value || null,
        fechaFin: $('#edFin').value || null,
      });
      setMsg(msg, 'Edición creada. Ahora añade sus equipos, jornadas y partidos más abajo.', true);
      e.target.reset();
      await loadData();
    } catch (err) { handleError(err, msg); }
  });

  // Constructor
  $('#builderEdition').addEventListener('change', refreshBuilderDetail);

  $('#builderTeamForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#builderMsg');
    try {
      await api('POST', `/api/admin/ediciones/${$('#builderEdition').value}/equipos`, {
        nombre: $('#btNombre').value,
        logoUrl: $('#btLogo').value || null,
      });
      setMsg(msg, 'Equipo añadido.', true);
      e.target.reset();
      await loadData();
    } catch (err) { handleError(err, msg); }
  });

  $('#builderRoundForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#builderMsg');
    try {
      await api('POST', `/api/admin/ediciones/${$('#builderEdition').value}/jornadas`, {
        orden: parseInt($('#bjOrden').value, 10),
        label: $('#bjLabel').value,
        tipo: $('#bjTipo').value,
        fecha: $('#bjFecha').value || null,
        nota: $('#bjNota').value || null,
      });
      setMsg(msg, 'Jornada añadida.', true);
      e.target.reset();
      await loadData();
    } catch (err) { handleError(err, msg); }
  });

  $('#builderMatchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#builderMsg');
    try {
      const homeId = $('#bpHome').value;
      const awayId = $('#bpAway').value;
      const homeLabel = homeId ? null : prompt('Etiqueta del local (p. ej. "1º clasificado"):') || null;
      const awayLabel = awayId ? null : prompt('Etiqueta del visitante (p. ej. "4º clasificado"):') || null;
      await api('POST', `/api/admin/ediciones/${$('#builderEdition').value}/partidos`, {
        jornadaId: $('#bpJornada').value,
        matchKey: $('#bpKey').value,
        hora: $('#bpHora').value || null,
        homeEquipoId: homeId || null,
        awayEquipoId: awayId || null,
        homeLabel,
        awayLabel,
      });
      setMsg(msg, 'Partido añadido.', true);
      e.target.reset();
      await loadData();
    } catch (err) { handleError(err, msg); }
  });
}

// ---------------------------------------------------------------------------
(async function init() {
  initEvents();
  if (getToken()) {
    try {
      showPanel(true);
      await loadData();
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        showPanel(false);
      }
    }
  }
})();
