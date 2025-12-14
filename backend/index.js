const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
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

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Faltan credenciales" });
  }

  const user = getUserByUsername(username);
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

app.get("/api/appointments", authRequired, (req, res) => {
  const all = getAllAppointments();
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
});

app.post("/api/appointments", (req, res) => {
  const { serviceName, serviceDuration, date, time, worker, status } = req.body || {};

  if (!serviceName || !serviceDuration || !date || !time) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  if (hasConflict({ worker, date, time })) {
    return res
      .status(400)
      .json({ message: "Conflicto: el trabajador ya tiene una cita en ese horario" });
  }

  const created = createAppointment({
    id: Date.now().toString(),
    serviceName,
    serviceDuration,
    date,
    time,
    worker: worker ?? null,
    status: status ?? "pendiente",
  });

  res.status(201).json(created);
});

app.put("/api/appointments/:id", authRequired, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const updated = updateAppointmentDb(id, req.body || {});
  if (!updated) {
    return res.status(404).json({ message: "Appointment not found" });
  }
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
