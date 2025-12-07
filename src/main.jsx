import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AdminPage } from "./AdminPage.jsx";
import { EmployeePage } from "./EmployeePage.jsx";
import { AppointmentsProvider } from "./context/AppointmentsContext.jsx";

const defaultUsers = [
  { username: "admin", role: "admin", password: "admin123" },
];

const loadUsers = () => {
  try {
    const stored = localStorage.getItem("appointments_users");
    if (stored) return JSON.parse(stored);
  } catch (_) {
    // ignore parse errors
  }
  return defaultUsers;
};

const saveUsers = (users) => {
  localStorage.setItem("appointments_users", JSON.stringify(users));
};

const loadSessionAuth = () => {
  try {
    const saved = sessionStorage.getItem("admin_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.user) {
        return { role: "admin", user: parsed.user, error: "" };
      }
    }
  } catch (_) {
    // ignore
  }
  return { role: null, user: null, error: "" };
};

const parseHash = (hash) => {
  const clean = hash.replace(/^#/, "").replace(/^\//, "");
  if (!clean) return { view: "client" };

  const [first, second] = clean.split("/").filter(Boolean);
  if (first === "admin") return { view: "admin" };
  if (first === "empleado" || first === "employee") {
    return { view: "employee", worker: second || "" };
  }
  return { view: "client" };
};

function RootRouter() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const [users, setUsers] = useState(() => {
    const list = loadUsers();
    saveUsers(list);
    return list;
  });
  const [auth, setAuth] = useState(() => loadSessionAuth());
  const [form, setForm] = useState({ user: "", password: "" });

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    if (!auth.role) {
      const session = loadSessionAuth();
      if (session.role) {
        setAuth(session);
      }
    }
  }, [route.view]);

  const navigate = (target) => {
    window.location.hash = target ? `/${target}` : "";
    setRoute(parseHash(window.location.hash));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const record = users.find((u) => u.username === form.user && u.role === "admin");
    if (record && record.password === form.password) {
      setAuth({ role: "admin", user: record.username, error: "" });
      sessionStorage.setItem("admin_session", JSON.stringify({ user: record.username }));
    } else {
      setAuth((prev) => ({ ...prev, error: "Usuario o contraseña incorrectos" }));
    }
  };

  const handleLogout = () => {
    setAuth({ role: null, user: null, error: "" });
    setForm({ user: "", password: "" });
    sessionStorage.removeItem("admin_session");
    navigate("empleado");
  };

  const createUser = ({ username, role, password }) => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { ok: false, error: "El usuario es obligatorio" };
    }
    if (users.some((u) => u.username === trimmed)) {
      return { ok: false, error: "El usuario ya existe" };
    }
    if (role === "admin" && !password) {
      return { ok: false, error: "La contraseña es obligatoria para admin" };
    }
    const userToAdd = { username: trimmed, role, password: role === "admin" ? password : "" };
    const updated = [...users, userToAdd];
    setUsers(updated);
    saveUsers(updated);
    return { ok: true };
  };

  const renderView = () => {
    if (route.view === "admin") {
      if (auth.role !== "admin") {
        return (
          <div className="page">
            <div className="app-shell">
              <header className="page-header" style={{ alignItems: "flex-start", textAlign: "left" }}>
                <h1 className="page-title">Acceso admin</h1>
                <p className="lede">Ingresa tus credenciales para administrar las citas.</p>
              </header>
              <div className="panel" style={{ maxWidth: "420px" }}>
                <form onSubmit={handleLogin} className="input-row" style={{ flexDirection: "column" }}>
                  <label className="field">
                    <span className="field-label">Usuario</span>
                    <input
                      className="control"
                      value={form.user}
                      onChange={(e) => setForm({ ...form, user: e.target.value })}
                      placeholder="admin"
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
                    />
                  </label>
                  {auth.error ? <p className="muted" style={{ color: "#b91c1c" }}>{auth.error}</p> : null}
                  <button type="submit" className="primary-button">
                    Entrar
                  </button>
                  <button type="button" className="ghost-button" onClick={() => navigate("empleado")}>
                    Volver a empleados
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="page">
          <div className="app-shell">
            <AdminPage onLogout={handleLogout} users={users} onCreateUser={createUser} />
          </div>
        </div>
      );
    }

    if (route.view === "employee") {
      return (
        <div className="page">
          <div className="app-shell">
            <EmployeePage initialWorker={route.worker || ""} lockWorker={!!route.worker} />
          </div>
        </div>
      );
    }

    return <App />;
  };

  return renderView();
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppointmentsProvider>
      <RootRouter />
    </AppointmentsProvider>
  </StrictMode>
);
