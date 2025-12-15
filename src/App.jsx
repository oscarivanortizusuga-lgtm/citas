import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { ServiceSelector } from "./components/ServiceSelector";
import { DateSelector } from "./components/DateSelector";
import { TimeSelector } from "./components/TimeSelector";
import { Confirmation } from "./components/Confirmation";
import { useAppointments } from "./context/AppointmentsContext";
import { AdminPage } from "./AdminPage";
import { EmployeePage } from "./EmployeePage";
import { BusinessProvider } from "./context/BusinessContext";
import { useAuth } from "./context/AuthContext";
import { LoginForm } from "./components/LoginForm";
import "./App.css";

function BusinessLayout() {
  return (
    <BusinessProvider>
      <Outlet />
    </BusinessProvider>
  );
}

function ClientPage() {
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const { addAppointment } = useAppointments();

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;

    try {
      await addAppointment({
        serviceName: selectedService.name,
        serviceDuration: selectedService.duration,
        date: selectedDate,
        time: selectedTime,
        worker: null,
        status: "pendiente",
      });
      alert(
        `Cita confirmada:\n\nServicio: ${selectedService.name}\nFecha: ${selectedDate}\nHora: ${selectedTime}`
      );
    } catch (err) {
      console.error(err);
      alert(err?.message || "Error al crear la cita. Intenta de nuevo.");
    }
  };

  return (
    <div className="page">
      <div className="app-shell">
        <header className="page-header">
          <h1 className="brand-mark" aria-label="Magic Beauty">
            <span className="brand-letter">MA</span>
            <span className="brand-letter accent">G</span>
            <span className="brand-letter">IC</span>
            <span className="brand-sub">Beauty</span>
          </h1>
          <h2 className="page-title">Agenda tu cita</h2>
          <p className="lede">
            Selecciona un servicio, el día y la hora que prefieras.
          </p>
        </header>

        <ServiceSelector
          selectedService={selectedService}
          onSelect={setSelectedService}
        />

        {selectedService && (
          <DateSelector
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
        )}

        {selectedService && selectedDate && (
          <TimeSelector
            selectedTime={selectedTime}
            onSelect={setSelectedTime}
          />
        )}

        {selectedService && selectedDate && selectedTime && (
          <Confirmation
            service={selectedService}
            date={selectedDate}
            time={selectedTime}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
}

function AdminRoute() {
  const { user, loading } = useAuth();
  const { slug } = useParams();
  if (loading) return <p className="muted">Verificando sesión...</p>;
  if (!user || user.role !== "admin" || user.businessSlug !== slug) {
    return (
      <div className="page">
        <div className="app-shell">
          <LoginForm title="Acceso admin" />
        </div>
      </div>
    );
  }
  return <AdminPage />;
}

function EmployeeRoute() {
  const { user, loading } = useAuth();
  const { slug } = useParams();
  if (loading) return <p className="muted">Verificando sesión...</p>;
  if (!user || user.role !== "employee" || user.businessSlug !== slug) {
    return (
      <div className="page">
        <div className="app-shell">
          <LoginForm title="Acceso empleado" />
        </div>
      </div>
    );
  }
  return <EmployeePage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/b/magicbeautycol" replace />} />
        <Route path="/b/:slug" element={<BusinessLayout />}>
          <Route index element={<ClientPage />} />
          <Route path="admin" element={<AdminRoute />} />
          <Route path="empleado" element={<EmployeeRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/b/magicbeautycol" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
