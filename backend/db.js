const dns = require("dns");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL es requerido para conectar a Postgres");
}

let pool;
let defaultBusinessId = null;
const DEFAULT_BUSINESS = { name: "Magic Beauty", slug: "magicbeautycol" };
const DEFAULT_SERVICES = [
  { name: "Manos o pies normal", duration: 30 },
  { name: "Pies y manos normal", duration: 60 },
  { name: "Cejas", duration: 60 },
  { name: "Pestanas", duration: 60 },
  { name: "Unas semipermanentes", duration: 90 },
];
const DEFAULT_WORKERS = ["Ana", "Luis", "Carla", "Mario"];
const DEFAULT_USERS = [
  { username: "admin", password: "admin123", role: "admin", workerName: null },
  { username: "ana", password: "ana123", role: "employee", workerName: "Ana" },
  { username: "luis", password: "luis123", role: "employee", workerName: "Luis" },
  { username: "carla", password: "carla123", role: "employee", workerName: "Carla" },
  { username: "mario", password: "mario123", role: "employee", workerName: "Mario" },
];

async function getPool() {
  if (pool) return pool;
  const url = new URL(connectionString);
  const hostLookup = await dns.promises.lookup(url.hostname, { family: 4 });
  const ssl =
    url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? false
      : { rejectUnauthorized: false };

  pool = new Pool({
    host: hostLookup.address,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl,
  });

  return pool;
}

function genId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

async function runQuery(sql, params = []) {
  const p = await getPool();
  return p.query(sql, params);
}

async function ensureSchemas() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration_minutes INT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(business_id, name)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(business_id, name)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      worker_name TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
      service_id TEXT REFERENCES services(id),
      service_name TEXT,
      service_duration INT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      worker_id TEXT REFERENCES workers(id),
      worker TEXT,
      status TEXT NOT NULL
    )
  `);

  await runQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id TEXT`);
  await runQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_name TEXT`);
  await runQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN`);
  await runQuery(`
    ALTER TABLE users
    ALTER COLUMN active TYPE BOOLEAN
    USING (
      CASE
        WHEN active IS NULL THEN TRUE
        WHEN active::text IN ('1','true','t','yes','on') THEN TRUE
        ELSE FALSE
      END
    )
  `);
  await runQuery(`ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE`);
  await runQuery(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS business_id TEXT`);
  await runQuery(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS worker_id TEXT REFERENCES workers(id)`);
  await runQuery(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id TEXT REFERENCES services(id)`);
  await runQuery(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_name TEXT`);
  await runQuery(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_duration INT`);
  await runQuery(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS worker TEXT`);

  await runQuery(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='users_username_key') THEN
        EXECUTE 'DROP INDEX users_username_key';
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END$$;
  `);
  await runQuery(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_business_username_key ON users(business_id, username)`
  );
}

async function getDefaultBusiness() {
  const existing = await getBusinessBySlug(DEFAULT_BUSINESS.slug);
  if (existing) {
    defaultBusinessId = existing.id;
    return existing;
  }
  const created = await createBusiness(DEFAULT_BUSINESS);
  defaultBusinessId = created.id;
  return created;
}

async function seedDefaultData(businessId) {
  const svcCount = await runQuery(`SELECT COUNT(*)::int AS count FROM services WHERE business_id = $1`, [
    businessId,
  ]);
  if ((svcCount.rows[0]?.count || 0) === 0) {
    for (const svc of DEFAULT_SERVICES) {
      await createService(businessId, { name: svc.name, durationMinutes: svc.duration });
    }
  }

  const workerCount = await runQuery(`SELECT COUNT(*)::int AS count FROM workers WHERE business_id = $1`, [
    businessId,
  ]);
  if ((workerCount.rows[0]?.count || 0) === 0) {
    for (const w of DEFAULT_WORKERS) {
      await createWorker(businessId, { name: w });
    }
  }

  const userCount = await runQuery(
    `SELECT COUNT(*)::int AS count FROM users WHERE business_id = $1`,
    [businessId]
  );
  if ((userCount.rows[0]?.count || 0) === 0) {
    for (const u of DEFAULT_USERS) {
      await createUser(businessId, u);
    }
  }
}

async function migrateExistingData(defaultBizId) {
  await runQuery(`UPDATE users SET business_id = $1 WHERE business_id IS NULL`, [defaultBizId]);
  await runQuery(`UPDATE appointments SET business_id = $1 WHERE business_id IS NULL`, [defaultBizId]);

  const workers = await listWorkers(defaultBizId, { activeOnly: false });
  const workerMap = new Map(workers.map((w) => [w.name, w.id]));

  const distinctWorkers = await runQuery(
    `SELECT DISTINCT worker FROM appointments WHERE business_id = $1 AND worker IS NOT NULL`,
    [defaultBizId]
  );
  for (const row of distinctWorkers.rows) {
    const name = row.worker;
    if (!name) continue;
    if (!workerMap.has(name)) {
      const created = await createWorker(defaultBizId, { name });
      workerMap.set(name, created.id);
    }
  }

  for (const [name, id] of workerMap.entries()) {
    await runQuery(
      `UPDATE appointments SET worker_id = $1 WHERE business_id = $2 AND worker = $3 AND worker_id IS NULL`,
      [id, defaultBizId, name]
    );
  }

  const services = await listServices(defaultBizId, { activeOnly: false });
  const serviceMap = new Map(services.map((s) => [s.name, s.id]));
  const distinctServices = await runQuery(
    `SELECT DISTINCT service_name FROM appointments WHERE business_id = $1 AND service_name IS NOT NULL`,
    [defaultBizId]
  );
  for (const row of distinctServices.rows) {
    const name = row.service_name;
    if (!name) continue;
    const svcId = serviceMap.get(name);
    if (svcId) {
      await runQuery(
        `UPDATE appointments SET service_id = $1 WHERE business_id = $2 AND service_name = $3 AND service_id IS NULL`,
        [svcId, defaultBizId, name]
      );
    }
  }
}

async function initDb() {
  await ensureSchemas();
  const biz = await getDefaultBusiness();
  await seedDefaultData(biz.id);
  await migrateExistingData(biz.id);
}

function mapServiceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    active: row.active,
    createdAt: row.created_at,
  };
}

function mapWorkerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
  };
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    workerName: row.worker_name,
    active: row.active,
  };
}

function mapAppointmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceName: row.service_name,
    serviceDuration: row.service_duration,
    date: row.date,
    time: row.time,
    worker: row.worker_name_resolved ?? row.worker,
    status: row.status,
  };
}

// Businesses
async function getBusinessBySlug(slug) {
  const res = await runQuery(`SELECT * FROM businesses WHERE slug = $1 LIMIT 1`, [slug]);
  return res.rows[0] || null;
}

async function createBusiness({ name, slug }) {
  const id = genId("biz");
  const res = await runQuery(
    `INSERT INTO businesses (id, name, slug) VALUES ($1, $2, $3) RETURNING *`,
    [id, name, slug]
  );
  return res.rows[0];
}

async function listBusinesses() {
  const res = await runQuery(`SELECT * FROM businesses ORDER BY created_at DESC`);
  return res.rows;
}

// Services
async function listServices(businessId, { activeOnly = true } = {}) {
  const res = await runQuery(
    `SELECT * FROM services WHERE business_id = $1 ${activeOnly ? "AND active = TRUE" : ""} ORDER BY name`,
    [businessId || defaultBusinessId]
  );
  return res.rows.map(mapServiceRow);
}

async function createService(businessId, { name, durationMinutes }) {
  const id = genId("svc");
  const res = await runQuery(
    `INSERT INTO services (id, business_id, name, duration_minutes, active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (business_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [id, businessId || defaultBusinessId, name, durationMinutes]
  );
  return mapServiceRow(res.rows[0]);
}

async function updateService(businessId, serviceId, partial) {
  const fields = [];
  const values = [];
  if (partial.name !== undefined) {
    fields.push(`name = $${fields.length + 1}`);
    values.push(partial.name);
  }
  if (partial.durationMinutes !== undefined) {
    fields.push(`duration_minutes = $${fields.length + 1}`);
    values.push(partial.durationMinutes);
  }
  if (partial.active !== undefined) {
    fields.push(`active = $${fields.length + 1}`);
    values.push(!!partial.active);
  }
  if (fields.length === 0) {
    const res = await runQuery(
      `SELECT * FROM services WHERE business_id = $1 AND id = $2`,
      [businessId || defaultBusinessId, serviceId]
    );
    return mapServiceRow(res.rows[0]);
  }
  values.push(businessId || defaultBusinessId);
  values.push(serviceId);
  const res = await runQuery(
    `UPDATE services SET ${fields.join(", ")} WHERE business_id = $${values.length - 1} AND id = $${values.length} RETURNING *`,
    values
  );
  return mapServiceRow(res.rows[0]);
}

async function deleteService(businessId, serviceId) {
  return updateService(businessId, serviceId, { active: false });
}

// Workers
async function listWorkers(businessId, { activeOnly = true } = {}) {
  const res = await runQuery(
    `SELECT * FROM workers WHERE business_id = $1 ${activeOnly ? "AND active = TRUE" : ""} ORDER BY name`,
    [businessId || defaultBusinessId]
  );
  return res.rows.map(mapWorkerRow);
}

async function createWorker(businessId, { name }) {
  const id = genId("wrk");
  const res = await runQuery(
    `INSERT INTO workers (id, business_id, name, active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (business_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [id, businessId || defaultBusinessId, name]
  );
  return mapWorkerRow(res.rows[0]);
}

async function updateWorker(businessId, workerId, partial) {
  const fields = [];
  const values = [];
  if (partial.name !== undefined) {
    fields.push(`name = $${fields.length + 1}`);
    values.push(partial.name);
  }
  if (partial.active !== undefined) {
    fields.push(`active = $${fields.length + 1}`);
    values.push(!!partial.active);
  }
  if (fields.length === 0) {
    const res = await runQuery(
      `SELECT * FROM workers WHERE business_id = $1 AND id = $2`,
      [businessId || defaultBusinessId, workerId]
    );
    return mapWorkerRow(res.rows[0]);
  }
  values.push(businessId || defaultBusinessId);
  values.push(workerId);
  const res = await runQuery(
    `UPDATE workers SET ${fields.join(", ")} WHERE business_id = $${values.length - 1} AND id = $${values.length} RETURNING *`,
    values
  );
  return mapWorkerRow(res.rows[0]);
}

async function deleteWorker(businessId, workerId) {
  return updateWorker(businessId, workerId, { active: false });
}

// Users
async function getUserByBusinessAndUsername(businessId, username) {
  const res = await runQuery(
    `SELECT id, username, password_hash, role, worker_name, active, business_id
     FROM users
     WHERE business_id = $1 AND username = $2
     LIMIT 1`,
    [businessId || defaultBusinessId, username]
  );
  return mapUserRow(res.rows[0]);
}

async function getUserByUsername(username) {
  return getUserByBusinessAndUsername(defaultBusinessId, username);
}

async function listUsers(businessId) {
  const res = await runQuery(
    `SELECT id, username, role, worker_name, active, business_id FROM users WHERE business_id = $1 ORDER BY username`,
    [businessId || defaultBusinessId]
  );
  return res.rows.map(mapUserRow);
}

async function createUser(businessId, { username, password, role, workerName }) {
  const bizId = businessId || defaultBusinessId;
  const passwordHash = bcrypt.hashSync(password, 10);
  const id = genId("user");
  const res = await runQuery(
    `INSERT INTO users (id, username, password_hash, role, worker_name, active, business_id)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)
     ON CONFLICT (business_id, username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id, username, role, worker_name, active, business_id`,
    [id, username, passwordHash, role, workerName ?? null, bizId]
  );
  return mapUserRow(res.rows[0]);
}

async function updateUserPassword(businessId, username, passwordHash) {
  const res = await runQuery(
    `UPDATE users SET password_hash = $1 WHERE business_id = $2 AND username = $3`,
    [passwordHash, businessId || defaultBusinessId, username]
  );
  return res.rowCount > 0;
}

async function setUserActive(businessId, username, active) {
  const normalized = active === true || active === 1 || active === "1" || active === "true";
  const res = await runQuery(
    `UPDATE users SET active = $1 WHERE business_id = $2 AND username = $3`,
    [normalized, businessId || defaultBusinessId, username]
  );
  return res.rowCount > 0;
}

// Appointments
async function listAppointments(businessId) {
  const bizId = businessId || defaultBusinessId;
  const res = await runQuery(
    `SELECT a.id,
            a.date,
            a.time,
            a.status,
            COALESCE(s.name, a.service_name) AS service_name,
            COALESCE(s.duration_minutes, a.service_duration) AS service_duration,
            COALESCE(w.name, a.worker) AS worker_name_resolved,
            a.worker
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.id
     LEFT JOIN workers w ON a.worker_id = w.id
     WHERE a.business_id = $1
     ORDER BY a.date, a.time`,
    [bizId]
  );
  return res.rows.map(mapAppointmentRow);
}

async function getAllAppointments() {
  return listAppointments(defaultBusinessId);
}

async function createAppointment(businessId, appointment) {
  const bizId = businessId || defaultBusinessId;
  const id = appointment.id || genId("appt");
  const res = await runQuery(
    `INSERT INTO appointments (
        id, business_id, service_id, service_name, service_duration,
        date, time, worker_id, worker, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      id,
      bizId,
      appointment.serviceId ?? null,
      appointment.serviceName ?? null,
      appointment.serviceDuration ?? null,
      appointment.date,
      appointment.time,
      appointment.workerId ?? null,
      appointment.worker ?? null,
      appointment.status ?? "pendiente",
    ]
  );
  return mapAppointmentRow(res.rows[0]);
}

async function updateAppointment(businessId, id, partialData) {
  const bizId = businessId || defaultBusinessId;
  const fields = [];
  const values = [];
  const mapping = {
    serviceId: "service_id",
    serviceName: "service_name",
    serviceDuration: "service_duration",
    date: "date",
    time: "time",
    workerId: "worker_id",
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
    const current = await runQuery(
      `SELECT a.id,
              a.date,
              a.time,
              a.status,
              COALESCE(s.name, a.service_name) AS service_name,
              COALESCE(s.duration_minutes, a.service_duration) AS service_duration,
              COALESCE(w.name, a.worker) AS worker_name_resolved,
              a.worker
       FROM appointments a
       LEFT JOIN services s ON a.service_id = s.id
       LEFT JOIN workers w ON a.worker_id = w.id
       WHERE a.business_id = $1 AND a.id = $2`,
      [bizId, id]
    );
    if (current.rowCount === 0) return null;
    return mapAppointmentRow(current.rows[0]);
  }

  values.push(bizId);
  values.push(id);
  const res = await runQuery(
    `UPDATE appointments SET ${fields.join(", ")} WHERE business_id = $${values.length - 1} AND id = $${values.length} RETURNING *`,
    values
  );
  if (res.rowCount === 0) return null;
  return mapAppointmentRow(res.rows[0]);
}

async function hasConflict(businessId, { workerId, workerName, date, time }) {
  const bizId = businessId || defaultBusinessId;
  if (!date || !time) return false;
  if (workerId) {
    const res = await runQuery(
      `SELECT 1 FROM appointments WHERE business_id = $1 AND worker_id = $2 AND date = $3 AND time = $4 AND status != 'cancelada' LIMIT 1`,
      [bizId, workerId, date, time]
    );
    return res.rowCount > 0;
  }
  if (workerName) {
    const res = await runQuery(
      `SELECT 1 FROM appointments WHERE business_id = $1 AND worker = $2 AND date = $3 AND time = $4 AND status != 'cancelada' LIMIT 1`,
      [bizId, workerName, date, time]
    );
    return res.rowCount > 0;
  }
  return false;
}

function getDbInfo() {
  const url = new URL(connectionString);
  return { db: "postgres", dbHost: url.hostname };
}

module.exports = {
  initDb,
  getDbInfo,
  // businesses
  getBusinessBySlug,
  createBusiness,
  listBusinesses,
  // services
  listServices,
  createService,
  updateService,
  deleteService,
  // workers
  listWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  // users
  getUserByBusinessAndUsername,
  getUserByUsername,
  listUsers,
  createUser,
  updateUserPassword,
  setUserActive,
  // appointments
  listAppointments,
  getAllAppointments,
  createAppointment,
  updateAppointment,
  hasConflict,
};
