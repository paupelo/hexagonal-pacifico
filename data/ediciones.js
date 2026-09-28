'use strict';

// ---------------------------------------------------------------------------
// ÚNICA FUENTE DE VERDAD de las ediciones del torneo.
//
// De este archivo se generan:
//   - la migración SQL (scripts/generate-migration.js -> migrations/*.sql)
//   - el seed del almacén en memoria (preview local sin DATABASE_URL)
//
// Los RESULTADOS/GOLEADORES/TARJETAS de la primera edición viven en las tablas
// legadas (resultados, goleadores, tarjetas) de la base de datos de producción
// y la migración los copia desde allí; los seeds legados de abajo solo existen
// para que una base de datos nueva (o el modo preview) muestre la edición
// archivada completa. En producción no pisan nada: son idempotentes.
// ---------------------------------------------------------------------------

const EDICIONES = [
  {
    slug: '2026-jul-ago',
    nombre: 'Hexagonal Panamá Pacífico – Julio-Agosto 2026',
    nombreCorto: 'Julio-Agosto 2026',
    fechaInicio: '2026-07-12',
    fechaFin: '2026-08-30',
    activa: false,
    archivada: true,
    info: {
      sede: 'Sport Park, Panamá Pacífico',
      dias: 'Domingos por la mañana',
      turnos: [
        'Jornadas de 3 partidos: 7:00, 8:15 y 9:30',
        'Jornadas de 2 partidos: 7:30 y 8:45',
      ],
      formato: [
        'Liguilla todos contra todos a una sola vuelta: 6 equipos, 6 jornadas y 15 partidos.',
        'Clasifican los 4 primeros a semifinales: 1º vs 4º y 2º vs 3º.',
        'Final entre los ganadores de las semifinales.',
      ],
      desempate: [
        'Puntos (victoria 3, empate 1, derrota 0)',
        'Enfrentamiento directo',
        'Diferencia de goles',
        'Goles a favor',
        'Fair play (menos tarjetas rojas)',
        'Orden alfabético',
      ],
    },
    equipos: [
      { nombre: 'Panamá Pacífico Residentes FC', logo: '/escudos/panama-pacifico.jpeg' },
      { nombre: 'Cludsa FC', logo: '/escudos/cludsa.jpeg' },
      { nombre: 'Deportivo Amarillo', logo: '/escudos/escudo-amarillo-fc.jpeg' },
      { nombre: 'Hermandad FC', logo: '/escudos/hermandad.jpeg' },
      { nombre: 'New Generation PPFC', logo: '/escudos/new-generation.jpeg' },
      { nombre: 'Futbirria Amigos', logo: '/escudos/futbirria-amigos.jpeg' },
    ],
    jornadas: [
      {
        orden: 1, label: 'Jornada 1', fecha: 'Domingo 12 de julio de 2026', tipo: 'liga',
        nota: 'Descansan: New Generation PPFC y Futbirria Amigos',
        partidos: [
          { key: 'j1-1', hora: '7:30', home: 'Panamá Pacífico Residentes FC', away: 'Hermandad FC' },
          { key: 'j1-2', hora: '9:00', home: 'Cludsa FC', away: 'Deportivo Amarillo' },
        ],
      },
      {
        orden: 2, label: 'Jornada 2', fecha: 'Domingo 19 de julio de 2026', tipo: 'liga',
        partidos: [
          { key: 'j2-1', hora: '7:00', home: 'Panamá Pacífico Residentes FC', away: 'Cludsa FC' },
          { key: 'j2-2', hora: '8:15', home: 'Deportivo Amarillo', away: 'Hermandad FC' },
          { key: 'j2-3', hora: '9:30', home: 'New Generation PPFC', away: 'Futbirria Amigos' },
        ],
      },
      {
        orden: 3, label: 'Jornada 3', fecha: 'Domingo 26 de julio de 2026', tipo: 'liga',
        nota: 'Descansan: Deportivo Amarillo y Hermandad FC',
        partidos: [
          { key: 'j3-1', hora: '7:30', home: 'Panamá Pacífico Residentes FC', away: 'New Generation PPFC' },
          { key: 'j3-2', hora: '8:45', home: 'Cludsa FC', away: 'Futbirria Amigos' },
        ],
      },
      {
        orden: 4, label: 'Jornada 4', fecha: 'Domingo 2 de agosto de 2026', tipo: 'liga',
        nota: 'Descansan: Panamá Pacífico Residentes FC y Cludsa FC',
        partidos: [
          { key: 'j4-1', hora: '7:30', home: 'Deportivo Amarillo', away: 'Futbirria Amigos' },
          { key: 'j4-2', hora: '8:45', home: 'Hermandad FC', away: 'New Generation PPFC' },
        ],
      },
      {
        orden: 5, label: 'Jornada 5', fecha: 'Domingo 9 de agosto de 2026', tipo: 'liga',
        partidos: [
          { key: 'j5-1', hora: '7:00', home: 'Deportivo Amarillo', away: 'New Generation PPFC' },
          { key: 'j5-2', hora: '8:15', home: 'Panamá Pacífico Residentes FC', away: 'Futbirria Amigos' },
          { key: 'j5-3', hora: '9:30', home: 'Cludsa FC', away: 'Hermandad FC' },
        ],
      },
      {
        orden: 6, label: 'Jornada 6', fecha: 'Domingo 16 de agosto de 2026', tipo: 'liga',
        partidos: [
          { key: 'j6-1', hora: '7:00', home: 'Hermandad FC', away: 'Futbirria Amigos' },
          { key: 'j6-2', hora: '8:15', home: 'Cludsa FC', away: 'New Generation PPFC' },
          { key: 'j6-3', hora: '9:30', home: 'Panamá Pacífico Residentes FC', away: 'Deportivo Amarillo' },
        ],
      },
      {
        orden: 7, label: 'Semifinales', fecha: 'Domingo 23 de agosto de 2026', tipo: 'semifinal',
        partidos: [
          { key: 'sf-1', hora: '7:30', home: 'Hermandad FC', away: 'Panamá Pacífico Residentes FC' },
          { key: 'sf-2', hora: '8:45', home: 'Deportivo Amarillo', away: 'Cludsa FC' },
        ],
      },
      {
        orden: 8, label: 'Final', fecha: 'Domingo 30 de agosto de 2026', tipo: 'final',
        partidos: [
          { key: 'final', hora: '8:00', home: 'Panamá Pacífico Residentes FC', away: 'Cludsa FC' },
        ],
      },
    ],
  },
  {
    slug: '2026-oct-nov',
    nombre: 'Hexagonal Panamá Pacífico – Octubre-Noviembre 2026',
    nombreCorto: 'Octubre-Noviembre 2026',
    fechaInicio: '2026-10-04',
    fechaFin: '2026-11-29',
    activa: true,
    archivada: false,
    info: {
      sede: 'Sport Park, Panamá Pacífico (cancha F11)',
      dias: 'Domingos por la mañana',
      turnos: [
        'Turno 1 · 7:00 – 8:00',
        'Turno 2 · 8:15 – 9:15',
        'Turno 3 · 9:30 – 10:30',
      ],
      formato: [
        'Liguilla todos contra todos a una sola vuelta: 5 jornadas, 3 partidos por jornada, 15 partidos.',
        'Clasifican los 4 primeros a semifinales: 1º vs 4º y 2º vs 3º.',
        'Final entre los ganadores de las semifinales. No hay partido por el tercer puesto.',
        'Sin partidos el 1 y el 8 de noviembre (Fiestas Patrias).',
        'En caso de empate en semifinales o final, el partido se decide por penaltis.',
      ],
      desempate: [
        'Puntos (victoria 3, empate 1, derrota 0)',
        'Diferencia de goles',
        'Goles a favor',
        'Enfrentamiento directo',
        'Orden alfabético',
      ],
    },
    equipos: [
      { nombre: 'Cludsa FC', logo: '/escudos/cludsa.jpeg' },
      { nombre: 'Panamá Pacífico Residentes', logo: '/escudos/panama-pacifico.jpeg' },
      { nombre: 'New Generation', logo: '/escudos/new-generation.jpeg' },
      { nombre: 'La10 West FC', logo: '/escudos/la10-west-fc.png' },
      { nombre: 'Deportivo Amarillo', logo: '/escudos/escudo-amarillo-fc.jpeg' },
      { nombre: 'Baviera FC', logo: '/escudos/baviera-fc.png' },
    ],
    jornadas: [
      {
        orden: 1, label: 'Jornada 1', fecha: 'Domingo 4 de octubre de 2026', tipo: 'liga',
        partidos: [
          { key: 'j1-1', hora: '7:00', home: 'Panamá Pacífico Residentes', away: 'La10 West FC' },
          { key: 'j1-2', hora: '8:15', home: 'Deportivo Amarillo', away: 'New Generation' },
          { key: 'j1-3', hora: '9:30', home: 'Baviera FC', away: 'Cludsa FC' },
        ],
      },
      {
        orden: 2, label: 'Jornada 2', fecha: 'Domingo 11 de octubre de 2026', tipo: 'liga',
        partidos: [
          { key: 'j2-1', hora: '7:00', home: 'Cludsa FC', away: 'Deportivo Amarillo' },
          { key: 'j2-2', hora: '8:15', home: 'Panamá Pacífico Residentes', away: 'Baviera FC' },
          { key: 'j2-3', hora: '9:30', home: 'New Generation', away: 'La10 West FC' },
        ],
      },
      {
        orden: 3, label: 'Jornada 3', fecha: 'Domingo 18 de octubre de 2026', tipo: 'liga',
        partidos: [
          { key: 'j3-1', hora: '7:00', home: 'Baviera FC', away: 'La10 West FC' },
          { key: 'j3-2', hora: '8:15', home: 'Panamá Pacífico Residentes', away: 'Deportivo Amarillo' },
          { key: 'j3-3', hora: '9:30', home: 'Cludsa FC', away: 'New Generation' },
        ],
      },
      {
        orden: 4, label: 'Jornada 4', fecha: 'Domingo 25 de octubre de 2026', tipo: 'liga',
        partidos: [
          { key: 'j4-1', hora: '7:00', home: 'Panamá Pacífico Residentes', away: 'New Generation' },
          { key: 'j4-2', hora: '8:15', home: 'La10 West FC', away: 'Cludsa FC' },
          { key: 'j4-3', hora: '9:30', home: 'Deportivo Amarillo', away: 'Baviera FC' },
        ],
      },
      {
        orden: 5, label: 'Fiestas Patrias', fecha: 'Domingos 1 y 8 de noviembre de 2026', tipo: 'descanso',
        nota: 'Sin partidos por las Fiestas Patrias.',
        partidos: [],
      },
      {
        orden: 6, label: 'Jornada 5', fecha: 'Domingo 15 de noviembre de 2026', tipo: 'liga',
        partidos: [
          { key: 'j5-1', hora: '7:00', home: 'New Generation', away: 'Baviera FC' },
          { key: 'j5-2', hora: '8:15', home: 'Panamá Pacífico Residentes', away: 'Cludsa FC' },
          { key: 'j5-3', hora: '9:30', home: 'La10 West FC', away: 'Deportivo Amarillo' },
        ],
      },
      {
        orden: 7, label: 'Semifinales', fecha: 'Domingo 22 de noviembre de 2026', tipo: 'semifinal',
        partidos: [
          { key: 'sf-1', hora: '7:30', homeLabel: '1º clasificado', awayLabel: '4º clasificado' },
          { key: 'sf-2', hora: '8:45', homeLabel: '2º clasificado', awayLabel: '3º clasificado' },
        ],
      },
      {
        orden: 8, label: 'Final', fecha: 'Domingo 29 de noviembre de 2026', tipo: 'final',
        partidos: [
          { key: 'final', hora: '8:00', homeLabel: 'Ganador Semifinal 1', awayLabel: 'Ganador Semifinal 2' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Datos legados de la primera edición (idénticos a los seeds del server.js
// histórico). Van a las tablas legadas resultados/goleadores/tarjetas, de las
// que la migración copia hacia el modelo multi-edición.
// ---------------------------------------------------------------------------
const LEGACY_RESULTS = [
  { match_id: 'j1-1', home_goals: 2, away_goals: 2 },
  { match_id: 'j1-2', home_goals: 0, away_goals: 4 },
  { match_id: 'j2-1', home_goals: 0, away_goals: 3 },
  { match_id: 'j2-2', home_goals: 0, away_goals: 3 },
  { match_id: 'j2-3', home_goals: 4, away_goals: 1 },
  { match_id: 'j3-1', home_goals: 2, away_goals: 1 },
  { match_id: 'j3-2', home_goals: 0, away_goals: 4 },
  { match_id: 'j4-1', home_goals: 3, away_goals: 1 },
  { match_id: 'j4-2', home_goals: 1, away_goals: 0 },
  { match_id: 'j5-1', home_goals: 3, away_goals: 0 },
  { match_id: 'j5-2', home_goals: 2, away_goals: 2 },
  { match_id: 'j5-3', home_goals: 1, away_goals: 5 },
  { match_id: 'j6-1', home_goals: 2, away_goals: 0 },
  { match_id: 'j6-2', home_goals: 3, away_goals: 1 },
  { match_id: 'j6-3', home_goals: 1, away_goals: 3 },
  { match_id: 'sf-1', home_goals: 0, away_goals: 2 },
  { match_id: 'sf-2', home_goals: 1, away_goals: 2 },
];

const LEGACY_SCORERS = [
  { player: 'Julián Dueñas', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j1-1' },
  { player: 'Luis Stanziola', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j1-1' },
  { player: 'Londres López', team: 'Hermandad FC', goals: 1, match_id: 'j1-1' },
  { player: 'Silvano Nicholson', team: 'Hermandad FC', goals: 1, match_id: 'j1-1' },
  { player: 'Gerardo Jiménez', team: 'Deportivo Amarillo', goals: 1, match_id: 'j1-2' },
  { player: 'José Pinnock', team: 'Deportivo Amarillo', goals: 1, match_id: 'j1-2' },
  { player: 'Octavio Maravilla', team: 'Deportivo Amarillo', goals: 1, match_id: 'j1-2' },
  { player: 'Ricardo Dubois', team: 'Deportivo Amarillo', goals: 1, match_id: 'j1-2' },
  { player: 'Rubén Córdoba', team: 'Cludsa FC', goals: 1, match_id: 'j2-1' },
  { player: 'Iansen Carrillo', team: 'Cludsa FC', goals: 1, match_id: 'j2-1' },
  { player: 'Julio Joyce', team: 'Cludsa FC', goals: 1, match_id: 'j2-1' },
  { player: 'Silvano Nicholson', team: 'Hermandad FC', goals: 2, match_id: 'j2-2' },
  { player: 'Federico Cotter', team: 'Hermandad FC', goals: 1, match_id: 'j2-2' },
  { player: 'Luis Rodríguez', team: 'New Generation PPFC', goals: 2, match_id: 'j2-3' },
  { player: 'Ricaurte Cárdenas', team: 'New Generation PPFC', goals: 1, match_id: 'j2-3' },
  { player: 'Alex Delgado', team: 'New Generation PPFC', goals: 1, match_id: 'j2-3' },
  { player: 'Héctor Carrillo', team: 'Futbirria Amigos', goals: 1, match_id: 'j2-3' },
  { player: 'Paulo Ramos', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j3-1' },
  { player: 'Luis Stanziola', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j3-1' },
  { player: 'Luis Rodríguez', team: 'New Generation PPFC', goals: 1, match_id: 'j3-1' },
  { player: 'Jonathan Botacio', team: 'Deportivo Amarillo', goals: 2, match_id: 'j4-1' },
  { player: 'Robinson Zarco', team: 'Deportivo Amarillo', goals: 1, match_id: 'j4-1' },
  { player: 'Silvano Nicholson', team: 'Hermandad FC', goals: 1, match_id: 'j4-2' },
  { player: 'Dinnick Salerno', team: 'Deportivo Amarillo', goals: 1, match_id: 'j5-1' },
  { player: 'Jonathan Botacio', team: 'Deportivo Amarillo', goals: 1, match_id: 'j5-1' },
  { player: 'Rodrigo Grattulini', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j5-2' },
  { player: 'Julián Dueñas', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j5-2' },
  { player: 'Nicolás Muñoz', team: 'Hermandad FC', goals: 1, match_id: 'j6-1' },
  { player: 'José Alcázar', team: 'Hermandad FC', goals: 1, match_id: 'j6-1' },
  { player: 'Ricardo Dubois', team: 'Deportivo Amarillo', goals: 2, match_id: 'j6-3' },
  { player: 'Jonathan Botacio', team: 'Deportivo Amarillo', goals: 1, match_id: 'j6-3' },
  { player: 'Jorge Geo', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'j6-3' },
  { player: 'Jefferson García', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'sf-1' },
  { player: 'Jan Branicki', team: 'Panamá Pacífico Residentes FC', goals: 1, match_id: 'sf-1' },
];

const LEGACY_CARDS = [
  { player: 'Jugador Hermandad (doble amarilla)', team: 'Hermandad FC', type: 'roja' },
];

const SLUG_ARCHIVADA = '2026-jul-ago';
const SLUG_ACTIVA = '2026-oct-nov';

module.exports = { EDICIONES, LEGACY_RESULTS, LEGACY_SCORERS, LEGACY_CARDS, SLUG_ARCHIVADA, SLUG_ACTIVA };
