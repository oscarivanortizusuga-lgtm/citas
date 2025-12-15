import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "./AuthContext";
import { useBusiness } from "./BusinessContext";

const AppointmentsContext = createContext(null);

export function AppointmentsProvider({ children }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { token, logout } = useAuth();
  const { businessSlug } = useBusiness();

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!token) {
        setAppointments([]);
        setLoading(false);
        setError(false);
        return;
      }
      try {
        setLoading(true);
        setError(false);
        console.log("API_BASE_URL (appointments) =", API_BASE_URL);
        const res = await fetch(`${API_BASE_URL}/api/appointments`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) {
          logout();
          throw new Error("Unauthorized");
        }
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
  }, [token, logout]);

  const addAppointment = async (appointmentData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/${businessSlug}/appointments`, {
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
      if (!token) throw new Error("No autenticado");
      const res = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(partialData),
      });
      if (res.status === 401) {
        logout();
        throw new Error("No autenticado");
      }
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
