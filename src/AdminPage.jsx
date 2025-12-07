import React, { useState } from "react";
import { useAppointments } from "./context/AppointmentsContext";

const workers = ["Ana", "Luis", "Carla", "Mario"];

export function AdminPage({ onLogout, users = [], onCreateUser }) {
  const { appointments, updateAppointment } = useAppointments();
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", role: "employee", password: "" });
  const [creationError, setCreationError] = useState("");
  const [creationOk, setCreationOk] = useState("");

  const handleWorkerChange = (id, worker) => {
    updateAppointment(id, { worker });
  };

  const handleStatusChange = (id, status) => {
    updateAppointment(id, { status });
  };

  const confirmedByWorker = workers.map((name) => ({
    name,
    count: appointments.filter(
      (appt) => appt.status === "confirmada" && appt.worker === name
    ).length,
  }));

  const pendingCount = appointments.filter((appt) => appt.status === "pendiente").length;
  const totalAppointments = appointments.length;

  const filteredAppointments = showPendingOnly
    ? appointments.filter((appt) => appt.status === "pendiente")
    : appointments;

  const employeesList = users.filter((u) => u.role === "employee");

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!onCreateUser) return;
    const result = onCreateUser(newUser);
    if (result.ok) {
      setCreationError("");
      setCreationOk("Usuario creado correctamente");
      setNewUser({ username: "", role: "employee", password: "" });
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
            {onLogout ? (
              <button className="ghost-button" onClick={onLogout}>
                Cerrar sesión
              </button>
            ) : null}
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
        </div>

        <div className="panel admin-summary">
          {confirmedByWorker.map(({ name, count }) => (
            <span key={name} className="summary-chip">
              {name}: {count} {count === 1 ? "cita" : "citas"} confirmadas
            </span>
          ))}
        </div>

        <div className="panel" style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="stack">
            <h3 style={{ margin: 0 }}>Crear usuario</h3>
            <p className="helper">Admin requiere contraseña; empleados solo usuario.</p>
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
              <button type="submit" className="primary-button">
                Crear usuario
              </button>
            </form>
          </div>
          <div className="stack">
            <h4 style={{ margin: 0 }}>Empleados existentes</h4>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {employeesList.map((u) => (
                <span key={u.username} className="summary-chip">
                  {u.username} → /#/empleado/{u.username}
                </span>
              ))}
              {employeesList.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Aún no hay empleados creados.</p>
              ) : null}
            </div>
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="panel">
            <p className="notice">No hay citas registradas aún.</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="panel">
            <p className="notice">No hay citas con el filtro seleccionado.</p>
          </div>
        ) : (
          <div className="panel" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <colgroup>
                <col />
                <col />
                <col style={{ width: "90px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "220px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Trabajador</th>
                  <th>Estado</th>
                  <th className="actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>{appt.serviceName}</td>
                    <td>{appt.date}</td>
                    <td>{appt.time}</td>
                    <td>
                      <select
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
                    </td>
                    <td className={`status-pill status-${appt.status}`}>
                      {appt.status}
                    </td>
                    <td className="admin-actions actions-cell">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
