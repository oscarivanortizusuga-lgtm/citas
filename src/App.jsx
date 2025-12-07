import React, { useState } from "react";
import { ServiceSelector } from "./components/ServiceSelector";
import { DateSelector } from "./components/DateSelector";
import { TimeSelector } from "./components/TimeSelector";
import { Confirmation } from "./components/Confirmation";
import { useAppointments } from "./context/AppointmentsContext";
import "./App.css";

function App() {
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const { addAppointment } = useAppointments();

  const handleConfirm = () => {
    if (!selectedService || !selectedDate || !selectedTime) return;

    addAppointment({
      id: Date.now().toString(),
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

export default App;
