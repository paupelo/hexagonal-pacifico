'use strict';

// Listado de ediciones archivadas. La contraseña se pide en la propia página
// de la edición (/archivo/:slug) si no hay sesión de archivo.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function rango(ed) {
  const f = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const ini = f(ed.fecha_inicio);
  const fin = f(ed.fecha_fin);
  if (ini && fin) return `${ini} – ${fin}`;
  return ini || fin || '';
}

(async function init() {
  const loading = document.getElementById('loading');
  const list = document.getElementById('editionsList');
  try {
    const res = await fetch('/api/archivo/ediciones');
    if (!res.ok) throw new Error('No se pudieron cargar las ediciones');
    const data = await res.json();
    loading.hidden = true;
    if (!data.ediciones.length) {
      list.innerHTML = '<div class="loading">Todavía no hay ediciones archivadas.</div>';
      return;
    }
    list.innerHTML = data.ediciones
      .map(
        (ed) => `
        <a class="edition-card" href="/archivo/${escapeHtml(ed.slug)}">
          <div>
            <div class="name">${escapeHtml(ed.nombre)}</div>
            <div class="dates">${escapeHtml(rango(ed))}${data.acceso ? '' : ' · 🔒 requiere contraseña'}</div>
          </div>
          <span class="arrow">→</span>
        </a>`
      )
      .join('');
  } catch (err) {
    loading.textContent = err.message || 'Error al cargar.';
  }
})();
