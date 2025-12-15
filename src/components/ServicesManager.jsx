import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

export function ServicesManager() {
  const { token, logout } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "", durationMinutes: "" });
  const [saving, setSaving] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadServices = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE_URL}/api/admin/services`, { headers: authHeaders });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("Error al cargar servicios");
      const data = await res.json();
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name || !form.durationMinutes) {
      setError("Nombre y duración son obligatorios");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ name: form.name, durationMinutes: Number(form.durationMinutes) }),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("No se pudo crear servicio");
      await loadServices();
      setSuccess("Servicio creado");
      setForm({ name: "", durationMinutes: "" });
    } catch (err) {
      setError(err?.message || "Error al crear servicio");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, partial) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(partial),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("No se pudo actualizar servicio");
      await loadServices();
    } catch (err) {
      setError(err?.message || "Error al actualizar servicio");
    }
  };

  return (
    <div className="stack" style={{ gap: "14px" }}>
      <div className="panel">
        <div className="section-heading">
          <h3 style={{ margin: 0 }}>Servicios</h3>
        </div>
        {loading ? <p className="muted">Cargando servicios...</p> : null}
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
                  <th>Duración</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        className="control"
                        value={s.name}
                        onChange={(e) => handleUpdate(s.id, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="control"
                        type="number"
                        value={s.durationMinutes}
                        onChange={(e) =>
                          handleUpdate(s.id, { durationMinutes: Number(e.target.value) })
                        }
                        style={{ width: "90px" }}
                      />{" "}
                      min
                    </td>
                    <td>{s.active ? "Sí" : "No"}</td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleUpdate(s.id, { active: !s.active })}
                      >
                        {s.active ? "Desactivar" : "Activar"}
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
          <h3 style={{ margin: 0 }}>Crear servicio</h3>
        </div>
        <form className="grid-form" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">Nombre</span>
            <input
              className="control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Servicio"
            />
          </label>
          <label className="field">
            <span className="field-label">Duración (min)</span>
            <input
              className="control"
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              placeholder="30"
            />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px" }}>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear servicio"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setForm({ name: "", durationMinutes: "" })}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
