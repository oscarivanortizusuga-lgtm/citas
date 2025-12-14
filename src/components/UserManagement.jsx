import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

export function UserManagement() {
  const { token, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    role: "employee",
    workerName: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  const [pwdEdit, setPwdEdit] = useState(null); // { username, newPassword }
  const [pwdLoading, setPwdLoading] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchUsers = async () => {
    if (!token) {
      setError("No autorizado");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          ...authHeaders,
        },
      });
      if (res.status === 401 || res.status === 403) {
        setError("No autorizado");
        logout();
        return;
      }
      if (!res.ok) throw new Error("Error al cargar usuarios");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!createForm.username || !createForm.password) {
      setError("Usuario y contraseña son obligatorios");
      return;
    }
    if (!["admin", "employee"].includes(createForm.role)) {
      setError("Rol inválido");
      return;
    }
    if (createForm.role === "employee" && !createForm.workerName) {
      setError("workerName es obligatorio para empleados");
      return;
    }

    try {
      setCreateLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(createForm),
      });
      if (res.status === 401 || res.status === 403) {
        setError("No autorizado");
        logout();
        return;
      }
      if (res.status === 409) {
        setError("El usuario ya existe");
        return;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Error al crear usuario");
      }
      await fetchUsers();
      setSuccess("Usuario creado");
      setCreateForm({ username: "", password: "", role: "employee", workerName: "" });
    } catch (err) {
      setError(err?.message || "Error al crear usuario");
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    if (!pwdEdit?.newPassword) {
      setError("Nueva contraseña requerida");
      return;
    }
    try {
      setPwdLoading(true);
      setError("");
      setSuccess("");
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${pwdEdit.username}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ newPassword: pwdEdit.newPassword }),
      });
      if (res.status === 401 || res.status === 403) {
        setError("No autorizado");
        logout();
        return;
      }
      if (!res.ok) {
        throw new Error("No se pudo cambiar la contraseña");
      }
      setSuccess(`Contraseña actualizada para ${pwdEdit.username}`);
      setPwdEdit(null);
    } catch (err) {
      setError(err?.message || "Error al cambiar contraseña");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "14px" }}>
      <div className="panel">
        <div className="section-heading" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Usuarios</h2>
          <span className="badge-soft">Solo admin</span>
        </div>
        {loading ? <p className="muted">Cargando usuarios...</p> : null}
        {error ? (
          <p className="muted" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="muted" style={{ color: "#15803d" }}>
            {success}
          </p>
        ) : null}
        {!loading && !error ? (
          users.length === 0 ? (
            <p className="notice">No hay usuarios</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Worker</th>
                    <th>Activo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.role}</td>
                      <td>{u.workerName || "-"}</td>
                      <td>{u.active ? "Sí" : "No"}</td>
                      <td>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setPwdEdit({ username: u.username, newPassword: "" })}
                        >
                          Cambiar contraseña
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>

      {pwdEdit ? (
        <div className="panel">
          <div className="section-heading">
            <h3 style={{ margin: 0 }}>Cambiar contraseña: {pwdEdit.username}</h3>
            <button className="ghost-button" type="button" onClick={() => setPwdEdit(null)}>
              Cerrar
            </button>
          </div>
          <form className="stack" onSubmit={handlePwdSubmit}>
            <label className="field">
              <span className="field-label">Nueva contraseña</span>
              <input
                className="control"
                type="password"
                value={pwdEdit.newPassword}
                onChange={(e) => setPwdEdit({ ...pwdEdit, newPassword: e.target.value })}
                placeholder="••••••••"
              />
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="primary-button" type="submit" disabled={pwdLoading}>
                {pwdLoading ? "Guardando..." : "Guardar"}
              </button>
              <button className="ghost-button" type="button" onClick={() => setPwdEdit(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="section-heading">
          <h3 style={{ margin: 0 }}>Crear usuario</h3>
        </div>
        <form className="grid-form" onSubmit={handleCreateUser}>
          <label className="field">
            <span className="field-label">Usuario</span>
            <input
              className="control"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              placeholder="usuario"
            />
          </label>
          <label className="field">
            <span className="field-label">Contraseña</span>
            <input
              className="control"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="••••••••"
            />
          </label>
          <label className="field">
            <span className="field-label">Rol</span>
            <select
              className="control"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            >
              <option value="employee">Empleado</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {createForm.role === "employee" ? (
            <label className="field">
              <span className="field-label">Worker</span>
              <input
                className="control"
                value={createForm.workerName}
                onChange={(e) => setCreateForm({ ...createForm, workerName: e.target.value })}
                placeholder="Ana, Luis, ..."
              />
            </label>
          ) : null}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px" }}>
            <button className="primary-button" type="submit" disabled={createLoading}>
              {createLoading ? "Creando..." : "Crear usuario"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setCreateForm({ username: "", password: "", role: "employee", workerName: "" });
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
