const dns = require("dns");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Prefer IPv4 to avoid ENETUNREACH on hosts that resolve to IPv6 first
dns.setDefaultResultOrder("ipv4first");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL es requerido para conectar a Postgres");
}

const ssl =
  connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString,
  ssl,
});

const DEFAULT_USERS = [
  { username: "admin", password: "admin123", role: "admin", workerName: null },
  { username: "ana", password: "ana123", role: "employee", workerName: "Ana" },
  { username: "luis", password: "luis123", role: "employee", workerName: "Luis" },
  { username: "carla", password: "carla123", role: "employee", workerName: "Carla" },
  { username: "mario", password: "mario123", role: "employee", workerName: "Mario" },
];

function genId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      service_duration INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      worker TEXT,
      status TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      worker_name TEXT,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  const count = countRes.rows[0]?.count || 0;
  if (count === 0) {
    for (const u of DEFAULT_USERS) {
      const passwordHash = bcrypt.hashSync(u.password, 10);
      await pool.query(
        `INSERT INTO users (id, username, password_hash, role, worker_name, active)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [genId("user"), u.username, passwordHash, u.role, u.workerName]
      );
    }
  }
}

function mapAppointmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceName: row.service_name,
    serviceDuration: row.service_duration,
    date: row.date,
    time: row.time,
    worker: row.worker,
    status: row.status,
  };
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    workerName: row.worker_name,
    active: row.active,
  };
}

async function listAppointments() {
  const res = await pool.query(`SELECT * FROM appointments ORDER BY date, time`);
  return res.rows.map(mapAppointmentRow);
}

async function getAllAppointments() {
  return listAppointments();
}

async function createAppointment(appointment) {
  const id = appointment.id || genId("appt");
  const { serviceName, serviceDuration, date, time, worker, status } = appointment;
  const res = await pool.query(
    `INSERT INTO appointments (id, service_name, service_duration, date, time, worker, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, serviceName, serviceDuration, date, time, worker, status]
  );
  return mapAppointmentRow(res.rows[0]);
}

async function updateAppointment(id, partialData) {
  const fields = [];
  const values = [];
  const mapping = {
    serviceName: "service_name",
    serviceDuration: "service_duration",
    date: "date",
    time: "time",
    worker: "worker",
    status: "status",
  };

  Object.entries(partialData || {}).forEach(([key, value]) => {
    if (mapping[key] !== undefined && value !== undefined) {
      fields.push(`${mapping[key]} = $${fields.length + 1}`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    const current = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
    if (current.rowCount === 0) return null;
    return mapAppointmentRow(current.rows[0]);
  }

  values.push(id);
  const res = await pool.query(
    `UPDATE appointments SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (res.rowCount === 0) return null;
  return mapAppointmentRow(res.rows[0]);
}

async function hasConflict({ worker, date, time }) {
  if (!worker || !date || !time) return false;
  const res = await pool.query(
    `SELECT 1 FROM appointments WHERE worker = $1 AND date = $2 AND time = $3 AND status != 'cancelada' LIMIT 1`,
    [worker, date, time]
  );
  return res.rowCount > 0;
}

async function getUserByUsername(username) {
  const res = await pool.query(
    `SELECT id, username, password_hash, role, worker_name, active FROM users WHERE username = $1`,
    [username]
  );
  return mapUserRow(res.rows[0]);
}

async function listUsers() {
  const res = await pool.query(
    `SELECT id, username, role, worker_name, active FROM users ORDER BY username`
  );
  return res.rows.map(mapUserRow);
}

async function createUser({ username, password, role, workerName }) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const id = genId("user");
  const res = await pool.query(
    `INSERT INTO users (id, username, password_hash, role, worker_name, active)
     VALUES ($1, $2, $3, $4, $5, 1)
     RETURNING id, username, role, worker_name, active`,
    [id, username, passwordHash, role, workerName ?? null]
  );
  return mapUserRow(res.rows[0]);
}

async function updateUserPassword(username, passwordHash) {
  const res = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE username = $2`,
    [passwordHash, username]
  );
  return res.rowCount > 0;
}

async function setUserActive(username, active) {
  const res = await pool.query(
    `UPDATE users SET active = $1 WHERE username = $2`,
    [active, username]
  );
  return res.rowCount > 0;
}

function getDbInfo() {
  const url = new URL(connectionString);
  return { db: "postgres", dbHost: url.hostname };
}

module.exports = {
  initDb,
  listAppointments,
  getAllAppointments,
  createAppointment,
  updateAppointment,
  hasConflict,
  getUserByUsername,
  createUser,
  listUsers,
  updateUserPassword,
  setUserActive,
  getDbInfo,
};
