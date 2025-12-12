import React, { useEffect, useState } from "react";
import { useAppointments } from "./context/AppointmentsContext";
import { API_BASE_URL } from "./config";

const FALLBACK_WORKERS = ["Ana", "Luis", "Carla", "Mario"];

export function AdminPage({ onLogout, users = [], onCreateUser }) {
  const { appointments, updateAppointment } = useAppointments();
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", role: "employee", password: "" });
  const [creationError, setCreationError] = useState("");
  const [creationOk, setCreationOk] = useState("");
  const [assignError, setAssignError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [workers, setWorkers] = useState(FALLBACK_WORKERS);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState(false);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setWorkersLoading(true);
        setWorkersError(false);
        console.log("API_BASE_URL (workers) =", API_BASE_URL);
        const res = await fetch(`${API_BASE_URL}/api/workers`);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();
        const normalized =
          Array.isArray(data) && data.length > 0
            ? data
                .map((w) => (typeof w === "string" ? w : w?.name))
                .filter(Boolean)
            : FALLBACK_WORKERS;
        setWorkers(normalized.length > 0 ? normalized : FALLBACK_WORKERS);
      } catch (err) {
        console.error(err);
        setWorkersError(true);
        setWorkers(FALLBACK_WORKERS);
      } finally {
        setWorkersLoading(false);
      }
    };

    fetchWorkers();
  }, [API_BASE_URL]);

  const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const overlaps = (a, b) => {
    const startA = toMinutes(a.time);
    const endA = startA + (Number(a.serviceDuration) || 0);
    const startB = toMinutes(b.time);
    const endB = startB + (Number(b.serviceDuration) || 0);
    return startA < endB && startB < endA;
  };

  const handleWorkerChange = async (id, worker) => {
    const target = appointments.find((appt) => appt.id === id);
    if (!target) return;
    if (
      worker &&
      appointments.some(
        (appt) =>
          appt.id !== id &&
          appt.worker === worker &&
          appt.date === target.date &&
          appt.status !== "cancelada" &&
          overlaps(appt, target)
      )
    ) {
      setAssignError(
        `Conflicto: ${worker} ya tiene una cita asignada ese día con horario que se cruza con ${target.time}.`
      );
      return;
    }
    setAssignError("");
    try {
      await updateAppointment(id, { worker });
    } catch (err) {
      console.error(err);
      setAssignError("Error al asignar trabajador. Intenta de nuevo.");
    }
  };

  const handleStatusChange = async (id, status) => {
    const target = appointments.find((appt) => appt.id === id);
    if (!target) return;

    if (status === "confirmada") {
      if (!target.worker) {
        setAssignError("Asigna un trabajador antes de confirmar la cita.");
        return;
      }
      const conflict = appointments.some(
        (appt) =>
          appt.id !== id &&
          appt.worker === target.worker &&
          appt.date === target.date &&
          appt.status !== "cancelada" &&
          overlaps(appt, target)
      );
      if (conflict) {
        setAssignError(
          `Conflicto: ${target.worker} ya tiene una cita en un horario que se cruza con ${target.time} el ${target.date}.`
        );
        return;
      }
    }

    setAssignError("");
    try {
      await updateAppointment(id, { status });
    } catch (err) {
      console.error(err);
      setAssignError("Error al actualizar el estado. Intenta de nuevo.");
    }
  };

  const pendingCount = appointments.filter((appt) => appt.status === "pendiente").length;
  const totalAppointments = appointments.length;

  const filteredAppointments = showPendingOnly
    ? appointments.filter((appt) => appt.status === "pendiente")
    : appointments;

  const employeesList = users.filter((u) => u.role === "employee");

  const generateTimeSlots = () => {
    const slots = [];
    let hour = 9;
    let minutes = 0;
    while (hour < 18 || (hour === 18 && minutes === 0)) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
      minutes += 30;
      if (minutes === 60) {
        minutes = 0;
        hour += 1;
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const calendarData = workers.map((worker) => {
    const appts = appointments
      .filter(
        (a) =>
          a.worker === worker &&
          a.date === calendarDate &&
          a.status !== "cancelada"
      )
      .map((a) => ({
        ...a,
        start: toMinutes(a.time),
        end: toMinutes(a.time) + (Number(a.serviceDuration) || 0),
      }));
    return { worker, appts };
  });

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!onCreateUser) return;
    const result = onCreateUser(newUser);
    if (result.ok) {
      setCreationError("");
      setCreationOk("Usuario creado correctamente");
      setNewUser({ username: "", role: "employee", password: "" });
      setShowCreateModal(false);
    } else {
      setCreationOk("");
      setCreationError(result.error || "No se pudo crear el usuario");
    }
  };

  return (
    <div className="page">
      <div className="app-shell">
        <header className="page-header left">
          <div className="section-heading">
            <div>
              <h1 className="page-title">Panel de administración</h1>
              <p className="lede">Gestiona citas, asigna personal y crea usuarios.</p>
              <p className="helper">Tema Magic Beauty, estados y duraciones intactos.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="primary-button" type="button" onClick={() => setShowCreateModal(true)}>
                Crear usuario
              </button>
              {onLogout ? (
                <button className="ghost-button" onClick={onLogout}>
                  Cerrar sesión
                </button>
              ) : null}
            </div>
          </div>
          <div className="stack" style={{ flexDirection: "row", gap: "10px", flexWrap: "wrap" }}>
            <span className="badge-soft">Total: {totalAppointments}</span>
            <span className="badge-soft">Pendientes: {pendingCount}</span>
          </div>
        </header>

        <div className="panel admin-toolbar">
          <div className="segmented">
            <button
              type="button"
              className={showPendingOnly ? "primary-button" : "ghost-button"}
              onClick={() => setShowPendingOnly(true)}
            >
              Ver solo pendientes
            </button>
            <button
              type="button"
              className={!showPendingOnly ? "primary-button" : "ghost-button"}
              onClick={() => setShowPendingOnly(false)}
            >
              Ver todas
            </button>
          </div>
          {workersLoading ? (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Cargando trabajadores...
            </p>
          ) : workersError ? (
            <p className="muted" style={{ margin: "8px 0 0", color: "#b91c1c" }}>
              Error al cargar trabajadores (lista local en uso)
            </p>
          ) : null}
        </div>

        {assignError ? (
          <div className="panel">
            <p className="notice" style={{ color: "#7f1d1d", borderColor: "#fca5a5", background: "#fef2f2" }}>
              {assignError}
            </p>
          </div>
        ) : null}

        {showCreateModal ? (
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="section-heading">
                <div>
                  <h3 style={{ margin: 0 }}>Crear usuario</h3>
                  <p className="helper">Admin requiere contraseña; empleados solo usuario.</p>
                </div>
                <button className="ghost-button" type="button" onClick={() => setShowCreateModal(false)}>
                  Cerrar
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="stack">
                <label className="field">
                  <span className="field-label">Usuario</span>
                  <input
                    className="control"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="ej. ana"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Rol</span>
                  <select
                    className="control"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="employee">Empleado</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                {newUser.role === "admin" ? (
                  <label className="field">
                    <span className="field-label">Contraseña (solo admin)</span>
                    <input
                      className="control"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </label>
                ) : null}
                {creationError ? <p className="muted" style={{ color: "#b91c1c" }}>{creationError}</p> : null}
                {creationOk ? <p className="muted" style={{ color: "#15803d" }}>{creationOk}</p> : null}
                <div className="admin-actions" style={{ justifyContent: "flex-start", gap: "8px" }}>
                  <button type="submit" className="primary-button">
                    Guardar
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setShowCreateModal(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {appointments.length === 0 ? (
          <div className="panel">
            <p className="notice">No hay citas registradas aún.</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="panel">
            <p className="notice">No hay citas con el filtro seleccionado.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: "12px" }}>
            {filteredAppointments.map((appt) => (
              <div
                key={appt.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "12px",
                  background: "#fffdf7",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px 12px",
                  alignItems: "center",
                }}
              >
                <div>
                  <div className="muted" style={{ fontWeight: 700 }}>Servicio</div>
                  <div>{appt.serviceName}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontWeight: 700 }}>Fecha</div>
                  <div>{appt.date}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontWeight: 700 }}>Hora</div>
                  <div>{appt.time}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontWeight: 700 }}>Trabajador</div>
                  <select
                    disabled={workersLoading}
                    value={appt.worker ?? ""}
                    onChange={(e) =>
                      handleWorkerChange(appt.id, e.target.value || null)
                    }
                    className="control"
                  >
                    <option value="">Sin asignar</option>
                    {workers.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="muted" style={{ fontWeight: 700 }}>Estado</div>
                  <span className={`status-pill status-${appt.status}`}>
                    {appt.status}
                  </span>
                </div>
                <div className="admin-actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleStatusChange(appt.id, "confirmada")}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleStatusChange(appt.id, "cancelada")}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="panel stack" style={{ gap: "14px" }}>
          <div className="section-heading">
            <h3 style={{ margin: 0 }}>Calendario diario</h3>
            <div className="input-row" style={{ flex: "0 0 auto" }}>
              <label className="field" style={{ minWidth: "180px" }}>
                <span className="field-label">Fecha</span>
                <input
                  className="control"
                  type="date"
                  value={calendarDate}
                  onChange={(e) => setCalendarDate(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="schedule-grid">
            <div className="schedule-head">
              <div className="schedule-time">Hora</div>
              {workers.map((w) => (
                <div key={w} className="schedule-worker">
                  {w}
                </div>
              ))}
            </div>
            <div className="schedule-body">
              {timeSlots.map((slot) => (
                <React.Fragment key={slot}>
                  <div className="schedule-time">{slot}</div>
                  {calendarData.map(({ worker, appts }) => {
                    const found = appts.find(
                      (a) => toMinutes(slot) >= a.start && toMinutes(slot) < a.end
                    );
                    if (found) {
                      const rowSpan = Math.max(1, found.serviceDuration / 30 || 1);
                      const isStart = toMinutes(slot) === found.start;
                      return isStart ? (
                        <div
                          key={`${worker}-${slot}`}
                          className={`schedule-cell busy status-${found.status}`}
                          style={{ gridRow: `span ${rowSpan}` }}
                        >
                          <div className="schedule-title">{found.serviceName}</div>
                          <div className="schedule-meta">
                            {found.time} · {found.serviceDuration} min
                          </div>
                          <div className="schedule-status">{found.status}</div>
                        </div>
                      ) : null;
                    }
                    return (
                      <div key={`${worker}-${slot}`} className="schedule-cell free">
                        Libre
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="input-row" style={{ gap: "8px" }}>
            <span className="badge-soft" style={{ background: "#ecfdf3", borderColor: "#86efac" }}>
              Confirmada
            </span>
            <span className="badge-soft" style={{ background: "#fff9e6", borderColor: "#f5d276" }}>
              Pendiente
            </span>
            <span className="badge-soft">Libre</span>
          </div>
        </div>
      </div>
    </div>
  );
}
