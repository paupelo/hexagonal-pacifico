'use strict';

// ---------------------------------------------------------------------------
// Cálculo de la clasificación de una edición. Criterios, en este orden:
//   1. Puntos (victoria 3, empate 1, derrota 0)
//   2. Diferencia de goles
//   3. Goles a favor
//   4. Enfrentamiento directo
//   5. Menos expulsiones acumuladas en el torneo (roja directa o doble amarilla)
//   (último recurso técnico, no publicado en las normas: orden alfabético 'es')
// ---------------------------------------------------------------------------

// `partidos`: solo los de liga, con home_equipo_id/away_equipo_id y goles.
// `expulsiones`: filas con equipo_id (cualquier tipo de expulsión cuenta).
function computeStandings(equipos, partidos, expulsiones = []) {
  const jugados = partidos.filter(
    (p) => p.home_goals !== null && p.home_goals !== undefined &&
           p.away_goals !== null && p.away_goals !== undefined &&
           p.home_equipo_id && p.away_equipo_id
  );

  const expPorEquipo = new Map(equipos.map((e) => [e.id, 0]));
  for (const x of expulsiones) {
    if (expPorEquipo.has(x.equipo_id)) expPorEquipo.set(x.equipo_id, expPorEquipo.get(x.equipo_id) + 1);
  }

  const table = new Map(
    equipos.map((e) => [e.id, {
      equipo_id: e.id, nombre: e.nombre, logo_url: e.logo_url || null,
      pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
      exp: expPorEquipo.get(e.id) || 0,
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

  // Orden por pts/DG/GF; los grupos que sigan empatados en los tres se
  // resuelven por enfrentamiento directo, menos expulsiones y, como último
  // recurso técnico, alfabético.
  const alpha = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  const rows = Array.from(table.values());
  rows.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);

  const key = (r) => `${r.pts}|${r.dg}|${r.gf}`;
  const ordered = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
    const group = rows.slice(i, j);
    if (group.length > 1) {
      const h2h = h2hPoints(group);
      group.sort((a, b) =>
        h2h.get(b.equipo_id) - h2h.get(a.equipo_id) || a.exp - b.exp || alpha(a, b)
      );
    }
    ordered.push(...group);
    i = j;
  }

  return ordered.map((row, idx) => ({ pos: idx + 1, ...row }));
}

module.exports = { computeStandings };
