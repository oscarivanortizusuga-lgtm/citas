const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL,
    workerName TEXT
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
const getUserByUsernameStmt = db.prepare(
  `SELECT id, username, passwordHash, role, workerName FROM users WHERE username = ?`
);
const insertUserStmt = db.prepare(`
  INSERT INTO users (id, username, passwordHash, role, workerName)
  VALUES (@id, @username, @passwordHash, @role, @workerName)
`);
const countUsersStmt = db.prepare(`SELECT COUNT(*) as count FROM users`);
const listUsersStmt = db.prepare(`SELECT id, username, role, workerName FROM users`);

const DEFAULT_USERS = [
  { username: "admin", password: "admin123", role: "admin", workerName: null, id: "user_admin" },
  { username: "ana", password: "ana123", role: "employee", workerName: "Ana", id: "user_ana" },
  { username: "luis", password: "luis123", role: "employee", workerName: "Luis", id: "user_luis" },
  { username: "carla", password: "carla123", role: "employee", workerName: "Carla", id: "user_carla" },
  { username: "mario", password: "mario123", role: "employee", workerName: "Mario", id: "user_mario" },
];

function genId(prefix = "user") {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

function seedUsersIfEmpty() {
  const { count } = countUsersStmt.get();
  if (count > 0) return;
  const insertMany = db.transaction((users) => {
    users.forEach((u) => {
      insertUserStmt.run({
        id: u.id || genId("user"),
        username: u.username,
        passwordHash: bcrypt.hashSync(u.password, 10),
        role: u.role,
        workerName: u.workerName ?? null,
      });
    });
  });

  insertMany(DEFAULT_USERS);
}

seedUsersIfEmpty(); // Seed default admin/employees once on empty DB

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

function getUserByUsername(username) {
  return getUserByUsernameStmt.get(username);
}

function createUser({ username, password, role, workerName }) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: genId("user"),
    username,
    passwordHash,
    role,
    workerName: workerName ?? null,
  };
  insertUserStmt.run(user);
  return { id: user.id, username: user.username, role: user.role, workerName: user.workerName };
}

function listUsers() {
  return listUsersStmt.all();
}

module.exports = {
  db,
  getAllAppointments,
  createAppointment,
  updateAppointment,
  hasConflict,
  getUserByUsername,
  createUser,
  listUsers,
};
