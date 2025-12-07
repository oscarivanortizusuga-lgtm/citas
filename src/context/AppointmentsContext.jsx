import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const [appointments, setAppointments] = useState(() => {
    try {
      const stored = localStorage.getItem("appointments_data");
      if (stored) return JSON.parse(stored);
    } catch (_) {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem("appointments_data", JSON.stringify(appointments));
    } catch (_) {
      // ignore write errors
    }
  }, [appointments]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "appointments_data" && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          setAppointments(parsed);
        } catch (_) {
          // ignore parse errors
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const addAppointment = (appointment) => {
    setAppointments((prev) => [...prev, appointment]);
  };

  const updateAppointment = (id, partialData) => {
    setAppointments((prev) =>
      prev.map((appt) => (appt.id === id ? { ...appt, ...partialData } : appt))
    );
  };

  const value = useMemo(
    () => ({
      appointments,
      addAppointment,
      updateAppointment,
    }),
    [appointments]
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
