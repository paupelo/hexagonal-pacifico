# 🏆 Hexagonal Panamá Pacífico

Aplicación web full-stack para gestionar el torneo de fútbol **Hexagonal Panamá Pacífico**
(Sport Park, Panamá Pacífico). La edición vigente es **Octubre-Noviembre 2026**. La app
soporta **varias ediciones**: la web pública muestra la edición activa y, cuando una
edición se archive desde el admin, quedará en `/archivo`, protegida por contraseña y en
modo solo lectura.

- **Frontend** estático (HTML/CSS/JS) con estética limpia y mobile first.
- **Backend** Node.js + Express: un único Web Service sirve el frontend y expone la API REST.
- **Base de datos** PostgreSQL (librería `pg`) con modelo multi-edición:
  `ediciones`, `equipos`, `jornadas`, `partidos`, `goleadores`, `tarjetas` y `logos`.
- La **clasificación** se calcula en el servidor. Criterios de desempate (en este orden):
  puntos · diferencia de goles · goles a favor · enfrentamiento directo · orden alfabético.
  Las ediciones archivadas conservan su clasificación final **congelada** tal y como quedó.
- Los **cruces de semifinales y final** se rellenan solos cuando hay datos (liga completa /
  semifinal decidida); los empates en eliminatorias se resuelven con **penaltis**.
- **Panel de administración** en `/admin`: solo permite editar la edición activa.

---

## 📁 Estructura del proyecto

```
hexagonal-pacifico/
├── server.js                  # Servidor Express + API
├── lib/
│   ├── db.js                  # Capa de datos (PostgreSQL + modo preview en memoria)
│   └── clasificacion.js       # Cálculo de la clasificación (criterios v1 y v2)
├── data/ediciones.js          # Única fuente de verdad de las ediciones sembradas
├── migrations/                # Migraciones SQL idempotentes (se aplican al arrancar)
├── scripts/
│   ├── backup.sh              # Backup con pg_dump a backups/ (ignorado por git)
│   ├── migrate.js             # Aplica las migraciones a mano (p. ej. producción)
│   └── generate-migration.js  # Regenera la migración desde data/ediciones.js
└── public/                    # Frontend estático
    ├── index.html             # Vista del torneo (edición activa y archivadas)
    ├── archivo.html           # Listado de ediciones archivadas
    ├── admin.html             # Panel de administración
    ├── css/styles.css
    ├── js/                    # app.js · archivo.js · admin.js
    └── escudos/               # Escudos de los equipos
```

---

## 🔑 Variables de entorno

| Variable           | Obligatoria | Descripción                                                                 |
| ------------------ | :---------: | --------------------------------------------------------------------------- |
| `DATABASE_URL`     | En producción | URL de PostgreSQL. Sin ella la app usa un almacén **en memoria** (solo local). |
| `ADMIN_PASSWORD`   | Sí          | Contraseña del panel `/admin` (edición activa).                              |
| `ARCHIVE_PASSWORD` | Sí          | Contraseña (distinta de la de admin) para consultar las ediciones archivadas en `/archivo`. |

En el modo preview local (sin `DATABASE_URL`) las contraseñas por defecto son
`admin` y `archivo`.

---

## 🗄️ Migraciones y backups

- Las migraciones viven en `migrations/*.sql`, son **idempotentes** y el servidor las
  aplica automáticamente al arrancar. La migración `2026-09-28-purge-primera-edicion.sql`
  elimina a propósito los datos de la primera edición del torneo (Julio-Agosto 2026):
  el proyecto arranca de cero con la edición Octubre-Noviembre 2026.
- Para migrar a mano (por ejemplo producción, antes de desplegar el código nuevo):

  ```bash
  DATABASE_URL='postgres://…' node scripts/migrate.js
  ```

- **Antes de migrar producción, haz siempre un backup**:

  ```bash
  DATABASE_URL='postgres://…' ./scripts/backup.sh
  ```

  La URL **externa** está en el dashboard de Render → `hexagonal-pacifico-db` →
  **External Database URL**. El backup se guarda en `backups/` (ignorado por git).
  Para restaurar: `pg_restore --clean --if-exists -d "$DATABASE_URL" backups/<archivo>.dump`.

---

## 🆕 Crear una nueva edición (sin tocar código)

1. Entra en `/admin` → pestaña **Ediciones**.
2. **Crear nueva edición** con nombre, nombre corto, slug (p. ej. `2027-mar-abr`) y fechas.
3. En **Montar una edición**, selecciona la edición recién creada y añade sus equipos
   (con la ruta de su escudo), sus jornadas (liga / semifinal / final / descanso) y sus
   partidos. Para cruces sin equipo todavía usa etiquetas como `1º clasificado` o
   `Ganador Semifinal 1`: la web los rellena sola cuando haya datos.
4. Cuando termine la edición actual: **Archivar** (congela su clasificación final y la
   deja en `/archivo`) y **Activar** la nueva para que sea la portada.

## 🛡️ Añadir o cambiar escudos

- Sube el archivo a `public/escudos/` y usa la ruta `/escudos/<archivo>` en el campo
  *logo* del equipo (pestaña **Equipos** del admin), **o** sube la imagen directamente
  desde esa pestaña (se guarda en la base de datos y se sirve en `/api/logos/:id`).
- Si un equipo no tiene escudo, la web muestra un círculo con sus iniciales
  (nunca una imagen rota).

---

## 🚀 Despliegue en Render

El proyecto ya está desplegado como Web Service + PostgreSQL (ver `render.yaml`).
Cada `git push` a `main` redespliega automáticamente. Recuerda añadir
`ARCHIVE_PASSWORD` en **Environment** del Web Service (además de `ADMIN_PASSWORD`
y `DATABASE_URL`, que ya existen).

---

## 💻 Ejecutar en local

Solo necesitas **Node.js 20**.

```bash
npm install
npm start          # o npm run dev (recarga automática)
```

- Sin `DATABASE_URL`: modo preview en memoria con las dos ediciones sembradas
  (contraseñas `admin` y `archivo`).
- Con `DATABASE_URL` (copia `.env.example` a `.env` si existe): PostgreSQL real;
  las migraciones se aplican solas al arrancar.

Abre [http://localhost:3000](http://localhost:3000).

---

## 🧩 Resumen de la API

Rutas públicas:

| Método | Ruta                        | Descripción                                          |
| ------ | --------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/data`                 | Datos completos de la edición activa.                |
| `GET`  | `/api/archivo/ediciones`    | Listado de ediciones archivadas.                     |
| `POST` | `/api/archivo/login`        | Valida `ARCHIVE_PASSWORD` y crea la cookie de sesión.|
| `GET`  | `/api/archivo/:slug/data`   | Datos de una edición archivada (requiere cookie).    |
| `GET`  | `/api/logos/:id`            | Sirve un escudo subido desde el admin.               |
| `POST` | `/api/login`                | Valida la contraseña de admin.                       |

Rutas de administración (cabecera `Authorization: <ADMIN_PASSWORD>`; solo actúan
sobre la edición **activa**, salvo la gestión de ediciones):

| Método   | Ruta                                  | Descripción                                    |
| -------- | ------------------------------------- | ---------------------------------------------- |
| `GET`    | `/api/admin/data`                     | Datos de administración de la edición activa.  |
| `POST`   | `/api/admin/resultados`               | Guarda un marcador (con penaltis en eliminatorias). |
| `DELETE` | `/api/admin/resultados/:partidoId`    | Borra un marcador.                             |
| `POST`   | `/api/admin/goleadores`               | Añade un goleador.                             |
| `DELETE` | `/api/admin/goleadores/:id`           | Elimina un goleador.                           |
| `PUT`    | `/api/admin/equipos/:id`              | Edita nombre y logo de un equipo.              |
| `POST`   | `/api/admin/equipos/:id/logo`         | Sube el escudo de un equipo (base64).          |
| `POST`   | `/api/admin/ediciones`                | Crea una edición nueva.                        |
| `GET`    | `/api/admin/ediciones/:id/detalle`    | Equipos/jornadas/partidos de una edición.      |
| `POST`   | `/api/admin/ediciones/:id/activar`    | Convierte la edición en la portada.            |
| `POST`   | `/api/admin/ediciones/:id/archivar`   | Archiva y congela su clasificación final.      |
| `POST`   | `/api/admin/ediciones/:id/equipos`    | Añade un equipo a una edición no archivada.    |
| `POST`   | `/api/admin/ediciones/:id/jornadas`   | Añade una jornada.                             |
| `POST`   | `/api/admin/ediciones/:id/partidos`   | Añade un partido.                              |

---

Sport Park · Panamá Pacífico
