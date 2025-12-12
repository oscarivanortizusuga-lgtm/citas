import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch("http://localhost:4000/api/appointments");
        if (!res.ok) throw new Error("Error al cargar citas");
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      } catch (_) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  const addAppointment = async (appointmentData) => {
    try {
      const res = await fetch("http://localhost:4000/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointmentData),
      });
      if (!res.ok) {
        let message = "Error al crear cita";
        try {
          const errJson = await res.json();
          if (errJson?.message) message = errJson.message;
        } catch (_) {
          // ignore parse errors
        }
        throw new Error(message);
      }
      const created = await res.json();
      setAppointments((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setError(true);
      throw err;
    }
  };

  const updateAppointment = async (id, partialData) => {
    try {
      const res = await fetch(`http://localhost:4000/api/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partialData),
      });
      if (!res.ok) throw new Error("Error al actualizar cita");
      const updated = await res.json();
      setAppointments((prev) =>
        prev.map((appt) => (appt.id === id ? updated : appt))
      );
      return updated;
    } catch (err) {
      setError(true);
      throw err;
    }
  };

  const value = useMemo(
    () => ({
      appointments,
      addAppointment,
      updateAppointment,
      loading,
      error,
    }),
    [appointments, loading, error]
  );

  return (
    <AppointmentsContext.Provider value={value}>
      {children}
    </AppointmentsContext.Provider>
  );
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) {
    throw new Error("useAppointments debe usarse dentro de AppointmentsProvider");
  }
  return ctx;
}
