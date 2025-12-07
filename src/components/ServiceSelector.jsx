import React from "react";

const services = [
  { name: "Manos o pies normal", duration: 30 },
  { name: "Pies y manos normal", duration: 60 },
  { name: "Cejas", duration: 60 },
  { name: "Pestañas", duration: 60 },
  { name: "Uñas semipermanentes", duration: 90 },
];

export function ServiceSelector({ selectedService, onSelect }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="step-badge">1</span>
        <div>
          <h2>Selecciona un servicio</h2>
          <p className="muted">Duración estimada incluida en cada opción.</p>
        </div>
      </div>

      <div className="service-grid">
        {services.map((service) => {
          const isActive = selectedService?.name === service.name;
          return (
            <button
              key={service.name}
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
    </section>
  );
}
