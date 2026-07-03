# 🏆 Pentagonal Panamá Pacífico

Aplicación web full-stack para gestionar el torneo de fútbol **Pentagonal Panamá Pacífico**
(Sport Park, Panamá Pacífico · 2026).

- **Frontend** estático (HTML/CSS/JS) con estética deportiva tipo FIFA.
- **Backend** Node.js + Express: un único Web Service sirve el frontend y expone la API REST.
- **Base de datos** PostgreSQL (librería `pg`): se guardan resultados, goleadores y tarjetas.
- El **calendario es fijo** (está en el código). En la base de datos solo se guardan resultados, goleadores y tarjetas.
- La **clasificación** se calcula automáticamente en el servidor, con los criterios de desempate del reglamento.
- **Panel de administración** protegido por contraseña validada en el servidor.

> Los datos se comparten entre todos los dispositivos porque se guardan en PostgreSQL (no en el navegador).

---

## 📁 Estructura del proyecto

```
hexagonal-pacifico/
├── server.js          # Servidor Express + API + conexión a PostgreSQL
├── package.json       # Dependencias y scripts
├── .env.example       # Plantilla de variables de entorno
├── .gitignore
├── README.md
└── public/            # Frontend estático
    ├── index.html
    ├── css/styles.css
    └── js/app.js
```

---

## 🚀 Despliegue en Render.com (guía para principiantes)

Sigue estos pasos en orden. No necesitas saber programar.

### Paso 1 — Subir el proyecto a GitHub

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Crea un **repositorio nuevo** (botón **New**). Ponle un nombre, por ejemplo `hexagonal-pacifico`. Déjalo **vacío** (sin README).
3. Abre una terminal dentro de la carpeta del proyecto y ejecuta:

   ```bash
   git init
   git add .
   git commit -m "Primera versión del torneo"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/hexagonal-pacifico.git
   git push -u origin main
   ```

   (Sustituye `TU_USUARIO` por tu usuario de GitHub.)

### Paso 2 — Crear la base de datos PostgreSQL en Render

1. Crea una cuenta en [render.com](https://render.com) (puedes entrar con tu cuenta de GitHub).
2. En el panel, pulsa **New +** → **PostgreSQL**.
3. Ponle un nombre (por ejemplo `hexagonal-db`), elige la región más cercana y el plan **Free**.
4. Pulsa **Create Database** y espera a que el estado sea **Available**.
5. En la página de la base de datos, busca el apartado **Connections** y copia la **Internal Database URL**
   (empieza por `postgres://...`). La necesitarás en el Paso 4.

### Paso 3 — Crear el Web Service conectado al repo

1. Pulsa **New +** → **Web Service**.
2. Conecta tu cuenta de GitHub y selecciona el repositorio `hexagonal-pacifico`.
3. Configura:
   - **Runtime / Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. **No** pulses crear todavía: primero añade las variables de entorno (Paso 4).

### Paso 4 — Configurar las variables de entorno

En la sección **Environment Variables** del Web Service, añade estas dos:

| Key              | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`   | Pega la **Internal Database URL** que copiaste en el Paso 2.       |
| `ADMIN_PASSWORD` | La contraseña secreta que tú elijas para entrar al panel de Admin. |

> 💡 Si tu Web Service y tu base de datos están en la misma cuenta de Render, también puedes
> usar **Add from Database** para que `DATABASE_URL` se enlace automáticamente.

### Paso 5 — Desplegar

1. Pulsa **Create Web Service**. Render instalará dependencias y arrancará la app.
2. Al arrancar, el servidor **crea las tablas automáticamente** (no tienes que hacer nada en la BD).
3. Cuando el estado sea **Live**, abre la URL pública que te da Render (algo como
   `https://hexagonal-pacifico.onrender.com`). ¡Listo!

### Actualizar la app más adelante

Cada vez que hagas `git push` a la rama `main`, Render volverá a desplegar automáticamente.

---

## 🔐 Uso del panel de administración

1. En la web, ve a la pestaña **Admin**.
2. Introduce la `ADMIN_PASSWORD` que configuraste en Render.
3. Desde ahí puedes:
   - **Resultados:** cargar/editar el marcador de cada partido.
   - **Goleadores:** registrar jugador, equipo y goles (alimenta la tabla de máximos goleadores).
   - **Tarjetas:** registrar amarillas y rojas (las rojas alimentan el criterio de fair play).

La clasificación, los marcadores del calendario y la tabla de goleadores se actualizan al instante.

> La contraseña nunca está en el código: el servidor la lee de `ADMIN_PASSWORD` y valida cada
> petición de escritura. Las rutas de lectura son públicas.

---

## 💻 Ejecutar en local

Solo necesitas **Node.js 20**.

### Opción A — Previsualización rápida (sin base de datos)

Si **no** defines `DATABASE_URL`, la app usa un almacén **en memoria** para que puedas ver
toda la web funcionando al instante. Los datos no se guardan al reiniciar (es solo para mirar).

```bash
npm install
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Para entrar al panel **Admin** en este modo,
la contraseña por defecto es `admin` (o la que pongas en `ADMIN_PASSWORD`).

> Este modo en memoria se activa solo en local; en Render, al haber `DATABASE_URL`, siempre se usa PostgreSQL real.

### Opción B — Con PostgreSQL real en local

1. Copia el archivo de ejemplo y edítalo:

   ```bash
   cp .env.example .env
   ```

   Ajusta `DATABASE_URL` a tu PostgreSQL local y pon una `ADMIN_PASSWORD`.

2. Instala dependencias y arranca:

   ```bash
   npm install
   npm run dev        # recarga automática (Node 20)
   # o bien:
   npm start
   ```

3. Abre [http://localhost:3000](http://localhost:3000).

---

## 🧩 Resumen de la API

Todas las rutas de **escritura** requieren la cabecera `Authorization: <ADMIN_PASSWORD>`.

| Método   | Ruta                   | Auth | Descripción                          |
| -------- | ---------------------- | :--: | ------------------------------------ |
| `POST`   | `/api/login`           |  No  | Valida la contraseña de admin.       |
| `GET`    | `/api/data`            |  No  | Devuelve calendario, resultados, clasificación, goleadores y tarjetas. |
| `POST`   | `/api/results`         |  Sí  | Guarda/actualiza el marcador de un partido. |
| `DELETE` | `/api/results/:matchId`|  Sí  | Borra el resultado de un partido.    |
| `POST`   | `/api/scorers`         |  Sí  | Añade un goleador.                   |
| `PUT`    | `/api/scorers/:id`     |  Sí  | Edita un goleador.                   |
| `DELETE` | `/api/scorers/:id`     |  Sí  | Elimina un goleador.                 |
| `POST`   | `/api/cards`           |  Sí  | Registra una tarjeta.                |
| `DELETE` | `/api/cards/:id`       |  Sí  | Elimina una tarjeta.                 |

---

## ⚙️ Datos del torneo

- **Formato:** liguilla de una sola vuelta (5 equipos, 5 jornadas; cada jornada descansa un equipo). Clasifican los 4 primeros a semifinales (1º vs 4º · 2º vs 3º) y la final es a partido único.
- **Partidos:** domingos en 2 turnos (jornada 1: 8:15 y 9:30 · jornadas 2 a 5: 7:30 y 9:00), a 2 tiempos de 30 minutos.
- **Desempates:** 1) head-to-head · 2) diferencia de goles · 3) goles a favor · 4) fair play (menos rojas) · 5) sorteo.
- **Inscripción:** 350 USD · Cuenta `04-72-00-733927-2` · Banco General · Ahorros · A nombre de *Panama Pacífico FC*.

---

Sport Park · Panamá Pacífico · 2026
