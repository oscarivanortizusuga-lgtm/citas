const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");
const db = new Database(dbPath);

// Ensure FK (not strictly needed here, but good practice)
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    serviceName TEXT NOT NULL,
    serviceDuration INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    worker TEXT,
    status TEXT NOT NULL
  )
`);

const selectAllStmt = db.prepare(`SELECT * FROM appointments`);
const insertStmt = db.prepare(`
  INSERT INTO appointments (id, serviceName, serviceDuration, date, time, worker, status)
  VALUES (@id, @serviceName, @serviceDuration, @date, @time, @worker, @status)
`);

const getByIdStmt = db.prepare(`SELECT * FROM appointments WHERE id = ?`);
const conflictStmt = db.prepare(
  `SELECT 1 FROM appointments WHERE worker = ? AND date = ? AND time = ? AND status != 'cancelada' LIMIT 1`
);

function getAllAppointments() {
  return selectAllStmt.all();
}

function createAppointment(data) {
  const id = data.id || Date.now().toString();
  const appointment = {
    id,
    serviceName: data.serviceName,
    serviceDuration: data.serviceDuration,
    date: data.date,
    time: data.time,
    worker: data.worker ?? null,
    status: data.status ?? "pendiente",
  };
  insertStmt.run(appointment);
  return appointment;
}

function updateAppointment(id, partialData) {
  const existing = getByIdStmt.get(id);
  if (!existing) return null;

  // Merge existing with partial
  const updated = {
    ...existing,
    ...partialData,
  };

  const fields = ["serviceName", "serviceDuration", "date", "time", "worker", "status"];
  const setClauses = [];
  const values = [];

  fields.forEach((field) => {
    if (partialData[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(partialData[field]);
    }
  });

  if (setClauses.length === 0) {
    return existing;
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE appointments SET ${setClauses.join(", ")} WHERE id = ?`);
  stmt.run(...values);

  return getByIdStmt.get(id);
}

function hasConflict({ worker, date, time }) {
  if (!worker || !date || !time) return false;
  const row = conflictStmt.get(worker, date, time);
  return !!row;
}

module.exports = {
  db,
  getAllAppointments,
  createAppointment,
  updateAppointment,
  hasConflict,
};
