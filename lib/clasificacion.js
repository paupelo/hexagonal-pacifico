'use strict';

// ---------------------------------------------------------------------------
// Cálculo de la clasificación de una edición.
//
// Criterios v2 (ediciones nuevas, en este orden):
//   1. Puntos  2. Diferencia de goles  3. Goles a favor
//   4. Enfrentamiento directo  5. Orden alfabético (locale 'es')
//
// Criterios v1 (los de la primera edición; solo se usan para CONGELAR su
// clasificación final tal y como quedó publicada):
//   1. Puntos  2. Enfrentamiento directo  3. Diferencia de goles
//   4. Goles a favor  5. Fair play (menos rojas)  6. Orden alfabético
// ---------------------------------------------------------------------------

// `partidos`: solo los de liga, con home_equipo_id/away_equipo_id y goles.
// `tarjetas`: solo se usa con criterios v1 (fair play).
function computeStandings(equipos, partidos, { criterios = 'v2', tarjetas = [] } = {}) {
  const jugados = partidos.filter(
    (p) => p.home_goals !== null && p.home_goals !== undefined &&
           p.away_goals !== null && p.away_goals !== undefined &&
           p.home_equipo_id && p.away_equipo_id
  );

  const rojas = new Map(equipos.map((e) => [e.id, 0]));
  for (const t of tarjetas) {
    if (t.type === 'roja' && rojas.has(t.equipo_id)) rojas.set(t.equipo_id, rojas.get(t.equipo_id) + 1);
  }

  const table = new Map(
    equipos.map((e) => [e.id, {
      equipo_id: e.id, nombre: e.nombre, logo_url: e.logo_url || null,
      pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, rojas: rojas.get(e.id) || 0,
    }])
  );

  for (const p of jugados) {
    const home = table.get(p.home_equipo_id);
    const away = table.get(p.away_equipo_id);
    if (!home || !away) continue;
    home.pj++; away.pj++;
    home.gf += p.home_goals; home.gc += p.away_goals;
    away.gf += p.away_goals; away.gc += p.home_goals;
    if (p.home_goals > p.away_goals) { home.pg++; home.pts += 3; away.pp++; }
    else if (p.home_goals < p.away_goals) { away.pg++; away.pts += 3; home.pp++; }
    else { home.pe++; away.pe++; home.pts++; away.pts++; }
  }
  for (const row of table.values()) row.dg = row.gf - row.gc;

  // Puntos conseguidos SOLO en los partidos entre los equipos del grupo dado.
  function h2hPoints(group) {
    const ids = new Set(group.map((r) => r.equipo_id));
    const pts = new Map(group.map((r) => [r.equipo_id, 0]));
    for (const p of jugados) {
      if (!ids.has(p.home_equipo_id) || !ids.has(p.away_equipo_id)) continue;
      if (p.home_goals > p.away_goals) pts.set(p.home_equipo_id, pts.get(p.home_equipo_id) + 3);
      else if (p.home_goals < p.away_goals) pts.set(p.away_equipo_id, pts.get(p.away_equipo_id) + 3);
      else {
        pts.set(p.home_equipo_id, pts.get(p.home_equipo_id) + 1);
        pts.set(p.away_equipo_id, pts.get(p.away_equipo_id) + 1);
      }
    }
    return pts;
  }

  // Ordena `rows` por los criterios previos a h2h, resuelve los grupos que
  // sigan empatados con el enfrentamiento directo y los criterios restantes.
  const alpha = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  let rows = Array.from(table.values());

  // Clave de empate previa al enfrentamiento directo, según los criterios.
  const preKey = criterios === 'v1'
    ? (r) => `${r.pts}`
    : (r) => `${r.pts}|${r.dg}|${r.gf}`;
  const preSort = criterios === 'v1'
    ? (a, b) => b.pts - a.pts
    : (a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf;
  const postSort = criterios === 'v1'
    ? (h2h) => (a, b) =>
        h2h.get(b.equipo_id) - h2h.get(a.equipo_id) ||
        b.dg - a.dg || b.gf - a.gf || a.rojas - b.rojas || alpha(a, b)
    : (h2h) => (a, b) => h2h.get(b.equipo_id) - h2h.get(a.equipo_id) || alpha(a, b);

  rows.sort(preSort);
  const ordered = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && preKey(rows[j]) === preKey(rows[i])) j++;
    const group = rows.slice(i, j);
    if (group.length > 1) group.sort(postSort(h2hPoints(group)));
    ordered.push(...group);
    i = j;
  }

  return ordered.map((row, idx) => ({ pos: idx + 1, ...row }));
}

module.exports = { computeStandings };
