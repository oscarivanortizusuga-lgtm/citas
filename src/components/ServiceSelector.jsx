import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useBusiness } from "../context/BusinessContext";

export function ServiceSelector({ selectedService, onSelect }) {
  const { businessSlug } = useBusiness();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(`${API_BASE_URL}/api/public/${businessSlug}/services`);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();
        setServices(
          (data || []).map((s) => ({
            id: s.id,
            name: s.name,
            duration: s.duration || s.durationMinutes,
          }))
        );
      } catch (_) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [businessSlug]);

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="step-badge">1</span>
        <div>
          <h2>Selecciona un servicio</h2>
          <p className="muted">Duración estimada incluida en cada opción.</p>
        </div>
      </div>

      {loading ? (
        <p className="muted">Cargando servicios...</p>
      ) : error ? (
        <p className="muted" style={{ color: "#b91c1c" }}>
          Error al cargar servicios
        </p>
      ) : (
        <div className="service-grid">
          {services.map((service) => {
            const isActive = selectedService?.id === service.id;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelect(service)}
                className={`service-card ${isActive ? "is-active" : ""}`}
                aria-pressed={isActive}
              >
                <div className="service-header">
                  <span className="service-name">{service.name}</span>
                  <span className="pill">{service.duration} min</span>
                </div>
                <p className="service-note">
                  Tiempo sugerido para garantizar una experiencia cuidada.
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
