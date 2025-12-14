import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AdminPage } from "./AdminPage.jsx";
import { EmployeePage } from "./EmployeePage.jsx";
import { AppointmentsProvider } from "./context/AppointmentsContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { LoginForm } from "./components/LoginForm.jsx";

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
  const { user, logout, loading: authLoading } = useAuth();

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (target) => {
    window.location.hash = target ? `/${target}` : "";
    setRoute(parseHash(window.location.hash));
  };

  const sessionLabel = user
    ? `Sesión: ${user.username} (${user.role}${user.workerName ? ` · ${user.workerName}` : ""})`
    : "Sesión: invitado";

  const SessionBar = () => (
    <div
      className="panel"
      style={{
        marginBottom: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      <p className="muted" style={{ margin: 0 }}>
        {sessionLabel}
      </p>
      {user ? (
        <button className="ghost-button" type="button" onClick={logout}>
          Cerrar sesión
        </button>
      ) : null}
    </div>
  );

  const renderLogin = (title) => (
    <div className="page">
      <div className="app-shell">
        <SessionBar />
        <LoginForm title={title} />
      </div>
    </div>
  );

  const renderView = () => {
    if (authLoading) {
      return (
        <div className="page">
          <div className="app-shell">
            <p className="muted">Verificando sesión...</p>
          </div>
        </div>
      );
    }

    if (route.view === "admin") {
      if (!user) {
        return renderLogin("Acceso admin");
      }
      if (user.role !== "admin") {
        return (
          <div className="page">
            <div className="app-shell">
              <SessionBar />
              <div className="panel">
                <p className="notice">Necesitas rol administrador para acceder.</p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="page">
          <div className="app-shell">
            <SessionBar />
            <AdminPage onLogout={logout} />
          </div>
        </div>
      );
    }

    if (route.view === "employee") {
      if (!user) {
        return renderLogin("Acceso empleado");
      }
      if (user.role !== "employee") {
        return (
          <div className="page">
            <div className="app-shell">
              <SessionBar />
              <div className="panel">
                <p className="notice">Necesitas rol empleado para acceder.</p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="page">
          <div className="app-shell">
            <SessionBar />
            <EmployeePage
              initialWorker={route.worker || user.workerName || ""}
              lockWorker={!!user.workerName}
            />
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
    <AuthProvider>
      <AppointmentsProvider>
        <RootRouter />
      </AppointmentsProvider>
    </AuthProvider>
  </StrictMode>
);
