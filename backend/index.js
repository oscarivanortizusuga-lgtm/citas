const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  initDb,
  getDbInfo,
  getBusinessBySlug,
  listServices,
  createService,
  updateService,
  deleteService,
  listWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  getUserByBusinessAndUsername,
  listUsers,
  createUser,
  updateUserPassword,
  setUserActive,
  listAppointments,
  createAppointment,
  updateAppointment: updateAppointmentDb,
  hasConflict,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const allowedOrigins = new Set(["http://localhost:5173", "https://magicbeautycol.netlify.app"]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// Auth helpers
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Token requerido" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "No autorizado" });
    }
    next();
  };
}

app.get("/", (_req, res) => {
  res.send("API OK");
});

app.get("/health", (_req, res) => {
  const info = getDbInfo();
  res.json({ ok: true, ...info });
});

// Auth
app.post("/api/auth/login", async (req, res) => {
  const { slug, username, password } = req.body || {};
  if (!slug || !username || !password) {
    return res.status(400).json({ message: "Faltan slug/usuario/contraseña" });
  }

  const biz = await getBusinessBySlug(slug);
  if (!biz) return res.status(404).json({ message: "Negocio no encontrado" });

  const user = await getUserByBusinessAndUsername(biz.id, username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const payload = {
    username: user.username,
    role: user.role,
    workerName: user.workerName ?? null,
    businessId: biz.id,
    businessSlug: biz.slug,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: payload });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  const { username, role, workerName, businessId, businessSlug } = req.user || {};
  res.json({ username, role, workerName, businessId, businessSlug });
});

// Público por negocio
app.get("/api/public/:slug/services", async (req, res) => {
  const { slug } = req.params;
  const biz = await getBusinessBySlug(slug);
  if (!biz) return res.status(404).json({ message: "Negocio no encontrado" });
  const svcs = await listServices(biz.id, { activeOnly: true });
  res.json(svcs.map((s) => ({ id: s.id, name: s.name, duration: s.durationMinutes })));
});

app.get("/api/public/:slug/workers", async (req, res) => {
  const { slug } = req.params;
  const biz = await getBusinessBySlug(slug);
  if (!biz) return res.status(404).json({ message: "Negocio no encontrado" });
  const wk = await listWorkers(biz.id, { activeOnly: true });
  res.json(wk.map((w) => ({ id: w.id, name: w.name })));
});

app.post("/api/public/:slug/appointments", async (req, res) => {
  const { slug } = req.params;
  const { serviceId, date, time } = req.body || {};
  if (!serviceId || !date || !time) {
    return res.status(400).json({ message: "Faltan datos obligatorios" });
  }
  const biz = await getBusinessBySlug(slug);
  if (!biz) return res.status(404).json({ message: "Negocio no encontrado" });

  const servicesBiz = await listServices(biz.id, { activeOnly: true });
  const svc = servicesBiz.find((s) => s.id === serviceId);
  if (!svc) {
    return res.status(400).json({ message: "Servicio inválido" });
  }

  const workersBiz = await listWorkers(biz.id, { activeOnly: true });
  let selectedWorker = null;
  for (const w of workersBiz) {
    const conflict = await hasConflict(biz.id, { workerId: w.id, date, time });
    if (!conflict) {
      selectedWorker = w;
      break;
    }
  }
  if (!selectedWorker) {
    return res.status(409).json({ message: "No hay disponibilidad" });
  }

  const created = await createAppointment(biz.id, {
    serviceId: svc.id,
    serviceName: svc.name,
    serviceDuration: svc.durationMinutes,
    date,
    time,
    workerId: selectedWorker.id,
    worker: selectedWorker.name,
    status: "pendiente",
  });

  res.status(201).json(created);
});

// Citas protegidas
app.get("/api/appointments", authRequired, async (req, res) => {
  try {
    const bizId = req.user.businessId;
    const all = await listAppointments(bizId);
    if (req.user.role === "admin") {
      return res.json(all);
    }
    if (req.user.role === "employee") {
      if (!req.user.workerName) {
        return res.status(403).json({ message: "Empleado sin worker asignado" });
      }
      const own = all.filter((appt) => appt.worker === req.user.workerName);
      return res.json(own);
    }
    return res.status(403).json({ message: "No autorizado" });
  } catch (err) {
    console.error("GET /api/appointments error", err);
    res.status(500).json({ message: "Error al obtener citas" });
  }
});

app.post("/api/appointments", authRequired, async (req, res) => {
  const { serviceId, serviceName, serviceDuration, date, time, workerId, worker, status } =
    req.body || {};

  if (!serviceName || !serviceDuration || !date || !time) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    if (await hasConflict(req.user.businessId, { workerId, workerName: worker, date, time })) {
      return res
        .status(400)
        .json({ message: "Conflicto: el trabajador ya tiene una cita en ese horario" });
    }

    const toInsert = {
      id: Date.now().toString(),
      serviceId: serviceId ?? null,
      serviceName,
      serviceDuration,
      date,
      time,
      workerId: workerId ?? null,
      worker: worker ?? null,
      status: status ?? "pendiente",
    };

    console.log("INSERT appointment", {
      business_id: req.user.businessId,
      service_name: toInsert.serviceName,
      date: toInsert.date,
      time: toInsert.time,
      worker: toInsert.worker,
      status: toInsert.status,
    });

    const created = await createAppointment(req.user.businessId, toInsert);
    console.log("INSERT OK", created.id);
    res.status(201).json(created);
  } catch (err) {
    console.error("INSERT ERROR", err);
    res.status(500).json({ message: "Error al crear cita", details: err.message });
  }
});

app.put("/api/appointments/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await updateAppointmentDb(req.user.businessId, id, req.body || {});
    if (!updated) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/appointments/:id error", err);
    res.status(500).json({ message: "Error al actualizar cita", details: err.message });
  }
});

// Admin: Servicios
app.get("/api/admin/services", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const items = await listServices(req.user.businessId, { activeOnly: false });
    res.json(items);
  } catch (err) {
    console.error("GET /api/admin/services error", err);
    res.status(500).json({ message: "Error al obtener servicios" });
  }
});

app.post("/api/admin/services", authRequired, requireRole("admin"), async (req, res) => {
  const { name, durationMinutes } = req.body || {};
  if (!name || !durationMinutes) {
    return res.status(400).json({ message: "Faltan datos" });
  }
  try {
    const created = await createService(req.user.businessId, { name, durationMinutes });
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/admin/services error", err);
    res.status(500).json({ message: "Error al crear servicio", details: err.message });
  }
});

app.put("/api/admin/services/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const updated = await updateService(req.user.businessId, req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/admin/services/:id error", err);
    res.status(500).json({ message: "Error al actualizar servicio", details: err.message });
  }
});

app.delete("/api/admin/services/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const updated = await deleteService(req.user.businessId, req.params.id);
    res.json(updated);
  } catch (err) {
    console.error("DELETE /api/admin/services/:id error", err);
    res.status(500).json({ message: "Error al eliminar servicio", details: err.message });
  }
});

// Admin: Workers
app.get("/api/admin/workers", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const items = await listWorkers(req.user.businessId, { activeOnly: false });
    res.json(items);
  } catch (err) {
    console.error("GET /api/admin/workers error", err);
    res.status(500).json({ message: "Error al obtener trabajadores" });
  }
});

app.post("/api/admin/workers", authRequired, requireRole("admin"), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: "Nombre requerido" });
  try {
    const created = await createWorker(req.user.businessId, { name });
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/admin/workers error", err);
    res.status(500).json({ message: "Error al crear trabajador", details: err.message });
  }
});

app.put("/api/admin/workers/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const updated = await updateWorker(req.user.businessId, req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/admin/workers/:id error", err);
    res.status(500).json({ message: "Error al actualizar trabajador", details: err.message });
  }
});

app.delete("/api/admin/workers/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const updated = await deleteWorker(req.user.businessId, req.params.id);
    res.json(updated);
  } catch (err) {
    console.error("DELETE /api/admin/workers/:id error", err);
    res.status(500).json({ message: "Error al eliminar trabajador", details: err.message });
  }
});

// Admin: Users
app.get("/api/admin/users", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const users = await listUsers(req.user.businessId);
    res.json(users);
  } catch (err) {
    console.error("GET /api/admin/users error", err);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
});

app.post("/api/admin/users", authRequired, requireRole("admin"), async (req, res) => {
  const { username, password, role, workerName } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ message: "Faltan datos obligatorios" });
  }
  if (!["admin", "employee"].includes(role)) {
    return res.status(400).json({ message: "Rol inválido" });
  }
  if (role === "employee" && !workerName) {
    return res.status(400).json({ message: "workerName es obligatorio para empleados" });
  }

  try {
    const created = await createUser(req.user.businessId, { username, password, role, workerName });
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/admin/users error", err);
    res.status(500).json({ message: "Error al crear usuario", details: err.message });
  }
});

app.put("/api/admin/users/:username/password", authRequired, requireRole("admin"), async (req, res) => {
  const { username } = req.params;
  const { newPassword } = req.body || {};
  if (!newPassword) {
    return res.status(400).json({ message: "Nueva contraseña requerida" });
  }
  try {
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await updateUserPassword(req.user.businessId, username, passwordHash);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/users/:username/password error", err);
    res.status(500).json({ message: "Error al actualizar contraseña", details: err.message });
  }
});

app.put("/api/admin/users/:username/active", authRequired, requireRole("admin"), async (req, res) => {
  const { username } = req.params;
  const { active } = req.body || {};
  if (active !== 0 && active !== 1 && active !== true && active !== false) {
    return res.status(400).json({ message: "active debe ser 0/1 o boolean" });
  }
  try {
    await setUserActive(req.user.businessId, username, active);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/users/:username/active error", err);
    res.status(500).json({ message: "Error al actualizar usuario", details: err.message });
  }
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to init DB", err);
    process.exit(1);
  }
}

start();
