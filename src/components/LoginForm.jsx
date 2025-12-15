import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";

export function LoginForm({ title = "Iniciar sesión", onSuccess }) {
  const { login, loading, businessSlug: savedSlug } = useAuth();
  const { businessSlug: urlSlug } = useBusiness();
  const [form, setForm] = useState({
    slug: urlSlug || savedSlug || "magicbeautycol",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.slug, form.username, form.password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || "Credenciales inválidas");
    }
  };

  return (
    <div className="panel" style={{ maxWidth: "420px" }}>
      <div className="section-heading">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="helper">Acceso requerido para ver esta sección.</p>
      </div>
      <form onSubmit={handleSubmit} className="stack">
        <label className="field">
          <span className="field-label">Negocio (slug)</span>
          <input
            className="control"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="magicbeautycol"
          />
        </label>
        <label className="field">
          <span className="field-label">Usuario</span>
          <input
            className="control"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="usuario"
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span className="field-label">Contraseña</span>
          <input
            className="control"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="muted" style={{ color: "#b91c1c" }}>{error}</p> : null}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
