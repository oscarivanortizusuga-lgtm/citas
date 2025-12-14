import React, { useState } from "react";
import { ServiceSelector } from "./components/ServiceSelector";
import { DateSelector } from "./components/DateSelector";
import { TimeSelector } from "./components/TimeSelector";
import { Confirmation } from "./components/Confirmation";
import { useAppointments } from "./context/AppointmentsContext";
import { useAuth } from "./context/AuthContext";
import "./App.css";

function App() {
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const { addAppointment } = useAppointments();
  const { user, logout } = useAuth();

  const sessionLabel = user
    ? `Sesión: ${user.username} (${user.role}${user.workerName ? ` · ${user.workerName}` : ""})`
    : "Sesión: invitado";

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

export default App;
