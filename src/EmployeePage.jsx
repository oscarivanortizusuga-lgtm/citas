import React, { useEffect, useMemo, useState } from "react";
import { useAppointments } from "./context/AppointmentsContext";
import { useAuth } from "./context/AuthContext";

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
  const { appointments, updateAppointment, loading } = useAppointments();
  const { user, logout } = useAuth();
  const [selectedWorker, setSelectedWorker] = useState(initialWorker);
  const [selectedDate, setSelectedDate] = useState("");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    if (user?.workerName) {
      setSelectedWorker(user.workerName);
    } else if (initialWorker) {
      setSelectedWorker(initialWorker);
    }
  }, [user?.workerName, initialWorker]);

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
        </header>

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
              {user?.workerName ? (
                <option value={user.workerName}>{user.workerName}</option>
              ) : null}
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
        ) : loading ? (
          <div className="panel">
            <p className="muted">Cargando citas...</p>
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
              {statusError ? (
                <p className="notice" style={{ color: "#7f1d1d", borderColor: "#fca5a5", background: "#fef2f2" }}>
                  {statusError}
                </p>
              ) : null}
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
                      <div className="stack" style={{ gap: "6px" }}>
                        <span className={`status-pill status-${appt.status}`}>
                          {appt.status}
                        </span>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={async () => {
                            try {
                              setStatusError("");
                                await updateAppointment(appt.id, { status: "confirmada" });
                            } catch (err) {
                              console.error(err);
                              setStatusError("No se pudo actualizar el estado.");
                            }
                          }}
                          >
                            Completar
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={async () => {
                              try {
                                setStatusError("");
                                await updateAppointment(appt.id, { status: "cancelada" });
                              } catch (err) {
                                console.error(err);
                                setStatusError("No se pudo actualizar el estado.");
                              }
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
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
