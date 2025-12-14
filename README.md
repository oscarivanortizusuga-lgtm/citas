# Citas Web (React + Vite + Node/Express/SQLite)

Agenda de citas con roles (cliente, admin, empleado) y autenticación JWT.

## Backend (Express + SQLite)

- Base de datos: `backend/database.sqlite` (better-sqlite3).
- JWT: lee `process.env.JWT_SECRET` con fallback `dev_secret_change_me`. Define un secreto fuerte en producción.
- Endpoints:
  - Público: `POST /api/appointments`, `GET /api/services`, `GET /api/workers`
  - Autenticados (JWT Bearer): `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/appointments`, `PUT /api/appointments/:id` (solo admin)
  - Filtrado para empleados: `GET /api/appointments` devuelve solo sus citas según `workerName` en el token.

### Usuarios de prueba (seed)
- Admin: `admin / admin123`
- Empleados: `ana / ana123`, `luis / luis123`, `carla / carla123`, `mario / mario123`

### Variables de entorno
- `JWT_SECRET` (obligatoria en prod). En Render: Config Vars -> key `JWT_SECRET`, value un string seguro.

### Ejecutar backend local
```bash
cd backend
JWT_SECRET=dev_secret_change_me node index.js
```

## Frontend (React + Vite)

- Base API configurada en `src/config.js` usando `VITE_API_BASE_URL`.
- AuthContext guarda el token en `localStorage` (`auth_token`) y llama `GET /api/auth/me` al cargar.
- AppointmentsContext usa el token para `GET /api/appointments` y `PUT /api/appointments/:id`; el `POST /api/appointments` sigue público.
- Rutas por hash:
  - Cliente: `/#/` (o sin hash)
  - Admin: `/#/admin` (requiere login admin)
  - Empleado: `/#/empleado` (requiere login empleado; si el token tiene `workerName`, fija el empleado)

### Variables de entorno frontend
- `VITE_API_BASE_URL` apuntando al backend (ej. `https://tu-backend.onrender.com`).

### Despliegue en Netlify (solo frontend)
1) Configura `VITE_API_BASE_URL` en Netlify apuntando a tu backend público.
2) Build command: `npm run build` (en raíz).
3) Publish directory: `dist`.
4) Probar:
   - Cliente: `https://tu-site.netlify.app/`
   - Admin: `https://tu-site.netlify.app/#/admin` (usa usuarios de prueba).
   - Empleado: `https://tu-site.netlify.app/#/empleado` (se filtra según token; el backend aplica rol/worker).

## Notas de seguridad
- No hardcodes secrets en el frontend. Solo usa `VITE_API_BASE_URL`.
- Define `JWT_SECRET` solo en el backend (Render u host elegido).
