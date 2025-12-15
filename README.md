# Citas Web (multi-negocio)

React + Vite (frontend) y Node/Express + Postgres (Supabase/pg) con JWT. Multi-tenant por `slug`.

## Rutas del frontend
- Cliente (público): `/b/:slug`
- Admin: `/b/:slug/admin`
- Empleado: `/b/:slug/empleado`
- Root redirige a `/b/magicbeautycol`.

## Backend (principales)
- Auth:
  - `POST /api/auth/login` body `{ slug, username, password }` → token con `businessId`, `businessSlug`, `role`, `workerName`.
  - `GET /api/auth/me` (Bearer).
- Público por negocio:
  - `GET /api/public/:slug/services`
  - `GET /api/public/:slug/workers`
  - `POST /api/public/:slug/appointments` body `{ serviceId, date, time }` (asigna worker libre o 409 si no hay disponibilidad).
- Admin/empleado (requiere Bearer, usa `businessId` del token):
  - Citas: `GET /api/appointments` (admin ve todas, employee solo las suyas), `PUT /api/appointments/:id` (admin).
  - Servicios: `GET/POST/PUT/DELETE /api/admin/services`
  - Trabajadores: `GET/POST/PUT/DELETE /api/admin/workers`
  - Usuarios: `GET/POST/PUT /api/admin/users`, `PUT /api/admin/users/:username/password`, `PUT /api/admin/users/:username/active`

## Multi-negocio
- El `slug` viene en la URL; el token incluye `businessId`/`businessSlug`.
- Para crear un nuevo negocio:
  - Opción rápida: insertar en DB (tabla `businesses`) y seed de servicios/trabajadores/usuarios vía SQL o script (a falta de endpoint global).
  - Slug debe ser único y se usa en `/b/:slug`.

## Datos seed por defecto (business: magicbeautycol)
- Admin: `admin / admin123`
- Empleados: `ana / ana123`, `luis / luis123`, `carla / carla123`, `mario / mario123`
- Servicios: Manos o pies normal (30), Pies y manos normal (60), Cejas (60), Pestanas (60), Unas semipermanentes (90)
- Trabajadores: Ana, Luis, Carla, Mario

## Variables de entorno
- Render (backend):
  - `DATABASE_URL` (usa el pooler de Supabase con `sslmode=require`)
  - `JWT_SECRET` (valor fuerte)
- Netlify (frontend):
  - `VITE_API_BASE_URL` apuntando al backend (ej. `https://tu-backend.onrender.com`)

## Despliegue frontend (Netlify)
- `npm run build` (publish: `dist`)
- Probar:
  - Cliente: `https://tu-site.netlify.app/b/magicbeautycol`
  - Admin: `https://tu-site.netlify.app/b/magicbeautycol/admin`
  - Empleado: `https://tu-site.netlify.app/b/magicbeautycol/empleado`

## Notas
- No expongas secretos en el frontend; solo `VITE_API_BASE_URL`.
- JWT solo en backend (`JWT_SECRET`).***
