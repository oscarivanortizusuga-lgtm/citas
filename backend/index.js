const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  initDb,
  getAllAppointments,
  createAppointment,
  updateAppointment: updateAppointmentDb,
  hasConflict,
  getUserByUsername,
  createUser,
  listUsers,
  updateUserPassword,
  setUserActive,
  getDbInfo,
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

const services = [
  { id: 1, name: "Manos o pies normal", duration: 30 },
  { id: 2, name: "Pies y manos normal", duration: 60 },
  { id: 3, name: "Cejas", duration: 60 },
  { id: 4, name: "Pestañas", duration: 60 },
  { id: 5, name: "Uñas semipermanentes", duration: 90 },
];

const workers = [
  { id: 1, name: "Ana" },
  { id: 2, name: "Luis" },
  { id: 3, name: "Carla" },
  { id: 4, name: "Mario" },
];

app.get("/", (_req, res) => {
  res.send("API OK");
});

app.get("/health", (_req, res) => {
  const info = getDbInfo();
  res.json({ ok: true, ...info });
});

app.get("/api/services", (_req, res) => {
  res.json(services);
});

app.get("/api/workers", (_req, res) => {
  res.json(workers);
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Faltan credenciales" });
  }

  const user = await getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const payload = {
    username: user.username,
    role: user.role,
    workerName: user.workerName ?? null,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: payload });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({
    username: req.user.username,
    role: req.user.role,
    workerName: req.user.workerName ?? null,
  });
});

app.get("/api/appointments", authRequired, async (req, res) => {
  try {
    const all = await getAllAppointments();
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

app.post("/api/appointments", async (req, res) => {
  const { serviceName, serviceDuration, date, time, worker, status } = req.body || {};

  if (!serviceName || !serviceDuration || !date || !time) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    if (await hasConflict({ worker, date, time })) {
      return res
        .status(400)
        .json({ message: "Conflicto: el trabajador ya tiene una cita en ese horario" });
    }

    const toInsert = {
      id: Date.now().toString(),
      serviceName,
      serviceDuration,
      date,
      time,
      worker: worker ?? null,
      status: status ?? "pendiente",
    };

    console.log("INSERT appointment", {
      service_name: toInsert.serviceName,
      date: toInsert.date,
      time: toInsert.time,
      worker: toInsert.worker,
      status: toInsert.status,
    });

    const created = await createAppointment(toInsert);
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
    const updated = await updateAppointmentDb(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/appointments/:id error", err);
    res.status(500).json({ message: "Error al actualizar cita", details: err.message });
  }
});

// Admin: list users
app.get("/api/admin/users", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    console.error("GET /api/admin/users error", err);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
});

// Admin: create user
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
    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "El usuario ya existe" });
    }

    const created = await createUser({ username, password, role, workerName });
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/admin/users error", err);
    res.status(500).json({ message: "Error al crear usuario", details: err.message });
  }
});

// Admin: change password
app.put("/api/admin/users/:username/password", authRequired, requireRole("admin"), async (req, res) => {
  const { username } = req.params;
  const { newPassword } = req.body || {};
  if (!newPassword) {
    return res.status(400).json({ message: "Nueva contraseña requerida" });
  }
  try {
    const target = await getUserByUsername(username);
    if (!target) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await updateUserPassword(username, passwordHash);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/users/:username/password error", err);
    res.status(500).json({ message: "Error al actualizar contraseña", details: err.message });
  }
});

// Admin: set active (optional)
app.put("/api/admin/users/:username/active", authRequired, requireRole("admin"), async (req, res) => {
  const { username } = req.params;
  const { active } = req.body || {};
  if (active !== 0 && active !== 1) {
    return res.status(400).json({ message: "active debe ser 0 o 1" });
  }
  try {
    const target = await getUserByUsername(username);
    if (!target) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    await setUserActive(username, active);
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
