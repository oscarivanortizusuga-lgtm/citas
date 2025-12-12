const express = require("express");
const cors = require("cors");
const {
  getAllAppointments,
  createAppointment,
  updateAppointment: updateAppointmentDb,
  hasConflict,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

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

app.get("/api/services", (_req, res) => {
  res.json(services);
});

app.get("/api/workers", (_req, res) => {
  res.json(workers);
});

app.get("/api/appointments", (_req, res) => {
  const all = getAllAppointments();
  res.json(all);
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

app.put("/api/appointments/:id", (req, res) => {
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
