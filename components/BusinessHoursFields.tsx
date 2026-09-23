"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_BUSINESS_HOURS,
  type BusinessDaySchedule,
} from "@/lib/business-hours";

const DAYS = [
  { value: 1, label: "Lun", full: "Lunes" },
  { value: 2, label: "Mar", full: "Martes" },
  { value: 3, label: "Mié", full: "Miércoles" },
  { value: 4, label: "Jue", full: "Jueves" },
  { value: 5, label: "Vie", full: "Viernes" },
  { value: 6, label: "Sáb", full: "Sábado" },
  { value: 7, label: "Dom", full: "Domingo" },
];

function buildSchedule(
  schedule: BusinessDaySchedule[] | null | undefined,
  days: number[] | null | undefined,
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
) {
  const selected = new Set((days?.length ? days : DEFAULT_BUSINESS_HOURS.days).map(Number));
  const open = String(openTime || DEFAULT_BUSINESS_HOURS.openTime).slice(0, 5);
  const close = String(closeTime || DEFAULT_BUSINESS_HOURS.closeTime).slice(0, 5);
  const byDay = new Map((schedule || []).map(item => [Number(item.day), item]));

  return DAYS.map(day => {
    const current = byDay.get(day.value);
    return {
      day: day.value,
      enabled: current ? Boolean(current.enabled) : selected.has(day.value),
      openTime: String(current?.openTime || open).slice(0, 5),
      closeTime: String(current?.closeTime || close).slice(0, 5),
    };
  });
}

export default function BusinessHoursFields({
  prefix = "business_",
  days = DEFAULT_BUSINESS_HOURS.days,
  openTime = DEFAULT_BUSINESS_HOURS.openTime,
  closeTime = DEFAULT_BUSINESS_HOURS.closeTime,
  schedule,
  disabled = false,
  title = "Horario de atención",
  description = "Configura los días activos y, si lo necesitas, horarios distintos para fines de semana u otros días.",
}: {
  prefix?: string;
  days?: number[] | null;
  openTime?: string | null;
  closeTime?: string | null;
  schedule?: BusinessDaySchedule[] | null;
  disabled?: boolean;
  title?: string;
  description?: string;
}) {
  const initial = useMemo(
    () => buildSchedule(schedule, days, openTime, closeTime),
    [schedule, days, openTime, closeTime],
  );
  const [rows, setRows] = useState<BusinessDaySchedule[]>(initial);

  function patch(day: number, next: Partial<BusinessDaySchedule>) {
    setRows(current => current.map(item => item.day === day ? { ...item, ...next } : item));
  }

  const activeCount = rows.filter(item => item.enabled).length;

  return <fieldset className="business-hours-fields form-span-2" disabled={disabled}>
    <legend>{title}</legend>
    <p>{description}</p>
    <input type="hidden" name={`${prefix}schedule_json`} value={JSON.stringify(rows)} />

    <div className="business-hours-summary">
      <span>{activeCount} día{activeCount === 1 ? "" : "s"} activo{activeCount === 1 ? "" : "s"}</span>
      <small>Activa solo los días en que realmente hay atención.</small>
    </div>

    <div className="business-hours-schedule">
      {DAYS.map(day => {
        const row = rows.find(item => item.day === day.value)!;
        return <div className={`business-hours-day-row ${row.enabled ? "is-open" : "is-closed"}`} key={day.value}>
          <label className="business-hours-day-toggle">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={event => patch(day.value, { enabled: event.target.checked })}
            />
            <span>{row.enabled ? "Abierto" : "Cerrado"}</span>
          </label>
          <strong>{day.full}</strong>
          <div className="business-hours-day-times">
            <label>
              <span>Apertura</span>
              <input
                type="time"
                value={row.openTime}
                disabled={!row.enabled || disabled}
                onChange={event => patch(day.value, { openTime: event.target.value })}
              />
            </label>
            <span className="business-hours-time-separator">a</span>
            <label>
              <span>Cierre</span>
              <input
                type="time"
                value={row.closeTime}
                disabled={!row.enabled || disabled}
                onChange={event => patch(day.value, { closeTime: event.target.value })}
              />
            </label>
          </div>
        </div>;
      })}
    </div>
  </fieldset>;
}
