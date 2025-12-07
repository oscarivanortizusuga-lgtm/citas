import React from "react";

export function DateSelector({ selectedDate, onSelect }) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="step-badge">2</span>
        <div>
          <h2>Selecciona una fecha</h2>
          <p className="muted">Solo mostramos fechas a partir de hoy.</p>
        </div>
      </div>

      <div className="input-row">
        <label className="field">
          <span className="field-label">Fecha</span>
          <input
            type="date"
            min={today}
            value={selectedDate || ""}
            onChange={(e) => onSelect(e.target.value)}
            className="control"
          />
        </label>
      </div>
    </section>
  );
}
