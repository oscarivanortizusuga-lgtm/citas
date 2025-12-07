import React, { useMemo, useState } from "react";
import { useAppointments } from "./context/AppointmentsContext";

const workers = ["Ana", "Luis", "Carla", "Mario"];

const getStoredUsers = () => {
  try {
    const raw = localStorage.getItem("appointments_users");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
};

function generateTimeSlots() {
  const times = [];
  let hour = 9;
  let minutes = 0;

  while (hour < 18 || (hour === 18 && minutes === 0)) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    times.push(`${hh}:${mm}`);

    minutes += 30;
    if (minutes === 60) {
      minutes = 0;
      hour += 1;
    }
  }

  return times;
}

const timeSlots = generateTimeSlots();

export function EmployeePage({ initialWorker = "", lockWorker = false }) {
  const { appointments } = useAppointments();
  const [selectedWorker, setSelectedWorker] = useState(initialWorker);
  const [selectedDate, setSelectedDate] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ user: "", password: "" });
  const [adminError, setAdminError] = useState("");

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter(
        (appt) =>
          appt.worker === selectedWorker &&
          appt.date === selectedDate
      )
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedWorker, selectedDate]);

  const isReady = selectedWorker && selectedDate;

  return (
    <div className="page">
      <div className="app-shell">
        <header className="page-header left">
          <h1 className="page-title">Agenda del empleado</h1>
          <p className="lede">
            Filtra por empleado y fecha para ver citas y disponibilidad.
          </p>
          <p className="helper">Los estados, horarios y colores se mantienen en el tema actual.</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
            <button className="ghost-button" type="button" onClick={() => setShowAdminLogin((v) => !v)}>
              {showAdminLogin ? "Cerrar acceso admin" : "Entrar como admin"}
            </button>
          </div>
        </header>

        {showAdminLogin && (
          <div className="panel" style={{ maxWidth: "460px" }}>
            <div className="section-heading">
              <div>
                <h3 style={{ margin: 0 }}>Acceso admin</h3>
                <p className="helper">Solo usuarios admin creados en el panel.</p>
              </div>
              <span className="badge-soft">Seguro</span>
            </div>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const users = getStoredUsers();
                const record = users.find(
                  (u) => u.username === adminCreds.user && u.role === "admin"
                );
                if (record && record.password === adminCreds.password) {
                  sessionStorage.setItem("admin_session", JSON.stringify({ user: record.username }));
                  setAdminError("");
                  window.location.hash = "/admin";
                  return;
                }
                setAdminError("Usuario o contraseña incorrectos");
              }}
            >
              <label className="field">
                <span className="field-label">Usuario</span>
                <input
                  className="control"
                  value={adminCreds.user}
                  onChange={(e) => setAdminCreds({ ...adminCreds, user: e.target.value })}
                  placeholder="admin"
                />
              </label>
              <label className="field">
                <span className="field-label">Contraseña</span>
                <input
                  className="control"
                  type="password"
                  value={adminCreds.password}
                  onChange={(e) => setAdminCreds({ ...adminCreds, password: e.target.value })}
                  placeholder="••••••••"
                />
              </label>
              {adminError ? <p className="muted" style={{ color: "#b91c1c" }}>{adminError}</p> : null}
              <button type="submit" className="primary-button">
                Entrar al panel admin
              </button>
            </form>
          </div>
        )}

        <div className="panel grid-form">
          <label className="field">
            <span className="field-label">Empleado</span>
            <select
              className="control"
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              disabled={lockWorker}
            >
              <option value="">Selecciona empleado</option>
              {workers.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Fecha</span>
            <input
              className="control"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
        </div>

        {!isReady ? (
          <div className="panel">
            <p className="notice">Selecciona empleado y fecha.</p>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="section-heading">
                <h2 style={{ margin: 0 }}>Citas del día</h2>
                {selectedWorker ? (
                  <span className="badge-soft">{selectedWorker}</span>
                ) : null}
              </div>
              {filteredAppointments.length === 0 ? (
                <p className="notice">No hay citas para este empleado en esta fecha.</p>
              ) : (
                <div className="stack" style={{ gap: "12px" }}>
                  {filteredAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.3fr",
                        gap: "8px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        padding: "10px 12px",
                        background: "#fffdf7",
                      }}
                    >
                      <div className="muted" style={{ fontWeight: 700 }}>Hora</div>
                      <div style={{ fontWeight: 700 }}>{appt.time}</div>
                      <div className="muted" style={{ fontWeight: 700 }}>Servicio</div>
                      <div>{appt.serviceName}</div>
                      <div className="muted" style={{ fontWeight: 700 }}>Duración</div>
                      <div>{appt.serviceDuration} min</div>
                      <div className="muted" style={{ fontWeight: 700 }}>Estado</div>
                      <div>
                        <span className={`status-pill status-${appt.status}`}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <h2 style={{ margin: "0 0 10px" }}>Horario del día</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                }}
              >
                {timeSlots.map((slot) => {
                  const occupied = filteredAppointments.some(
                    (appt) => appt.time === slot && appt.status !== "cancelada"
                  );
                  return (
                    <div
                      key={slot}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "10px",
                        background: occupied ? "var(--accent-soft)" : "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{slot}</span>
                      <span
                        className={`status-pill ${
                          occupied ? "status-confirmada" : "status-pendiente"
                        }`}
                      >
                        {occupied ? "Ocupado" : "Libre"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
