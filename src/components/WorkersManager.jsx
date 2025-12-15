import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

export function WorkersManager() {
  const { token, logout } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadWorkers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE_URL}/api/admin/workers`, { headers: authHeaders });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("Error al cargar trabajadores");
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Error al cargar trabajadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name) {
      setError("Nombre requerido");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ name: form.name }),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("No se pudo crear trabajador");
      await loadWorkers();
      setSuccess("Trabajador creado");
      setForm({ name: "" });
    } catch (err) {
      setError(err?.message || "Error al crear trabajador");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, partial) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/workers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(partial),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("No se pudo actualizar trabajador");
      await loadWorkers();
    } catch (err) {
      setError(err?.message || "Error al actualizar trabajador");
    }
  };

  return (
    <div className="stack" style={{ gap: "14px" }}>
      <div className="panel">
        <div className="section-heading">
          <h3 style={{ margin: 0 }}>Trabajadores</h3>
        </div>
        {loading ? <p className="muted">Cargando trabajadores...</p> : null}
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
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <input
                        className="control"
                        value={w.name}
                        onChange={(e) => handleUpdate(w.id, { name: e.target.value })}
                      />
                    </td>
                    <td>{w.active ? "Sí" : "No"}</td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleUpdate(w.id, { active: !w.active })}
                      >
                        {w.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="section-heading">
          <h3 style={{ margin: 0 }}>Crear trabajador</h3>
        </div>
        <form className="grid-form" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">Nombre</span>
            <input
              className="control"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="Nombre"
            />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px" }}>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear trabajador"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setForm({ name: "" })}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
