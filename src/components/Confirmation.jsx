import React from "react";

export function Confirmation({ service, date, time, onConfirm }) {
  if (!service || !date || !time) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="step-badge">4</span>
        <div>
          <h2>Confirmación</h2>
          <p className="muted">Revisa los detalles antes de confirmar.</p>
        </div>
      </div>

      <div className="summary">
        <div className="summary-row">
          <span className="summary-label">Servicio</span>
          <span className="summary-value">{service.name}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Fecha</span>
          <span className="summary-value">{date}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Hora</span>
          <span className="summary-value">{time}</span>
        </div>
      </div>

      <button type="button" onClick={onConfirm} className="primary-button">
        Confirmar cita
      </button>
    </section>
  );
}
