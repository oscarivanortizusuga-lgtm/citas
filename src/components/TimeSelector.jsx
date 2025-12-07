import React from "react";

function generateTimeSlots() {
  const times = [];
  let hour = 9;
  let minutes = 0;

  while (hour < 18 || (hour === 18 && minutes === 0)) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    times.push(`${hh}:${mm}`);

    minutes += 30;
    if (minutes === 60) {
      minutes = 0;
      hour += 1;
    }
  }

  return times;
}

const timeSlots = generateTimeSlots();

export function TimeSelector({ selectedTime, onSelect }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="step-badge">3</span>
        <div>
          <h2>Selecciona una hora</h2>
          <p className="muted">Bloques de 30 minutos entre 09:00 y 18:00.</p>
        </div>
      </div>

      <div className="time-grid">
        {timeSlots.map((time) => {
          const isActive = selectedTime === time;
          return (
            <button
              key={time}
              type="button"
              onClick={() => onSelect(time)}
              className={`time-slot ${isActive ? "is-active" : ""}`}
              aria-pressed={isActive}
            >
              {time}
            </button>
          );
        })}
      </div>
    </section>
  );
}
