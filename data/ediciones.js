'use strict';

// ---------------------------------------------------------------------------
// ÚNICA FUENTE DE VERDAD de las ediciones sembradas del torneo.
//
// De este archivo se generan:
//   - la migración SQL (scripts/generate-migration.js -> migrations/*.sql)
//   - el seed del almacén en memoria (preview local sin DATABASE_URL)
// ---------------------------------------------------------------------------

const EDICIONES = [
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
          { key: 'j1-2', hora: '7:00', home: 'Deportivo Amarillo', away: 'New Generation' },
          { key: 'j1-1', hora: '8:15', home: 'Panamá Pacífico Residentes', away: 'La10 West FC' },
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

module.exports = { EDICIONES };
