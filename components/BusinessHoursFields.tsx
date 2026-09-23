import { DEFAULT_BUSINESS_HOURS } from "@/lib/business-hours";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

export default function BusinessHoursFields({
  prefix = "business_",
  days = DEFAULT_BUSINESS_HOURS.days,
  openTime = DEFAULT_BUSINESS_HOURS.openTime,
  closeTime = DEFAULT_BUSINESS_HOURS.closeTime,
  disabled = false,
  title = "Horario de atención",
  description = "Define los días y la franja horaria habitual de atención.",
}: {
  prefix?: string;
  days?: number[] | null;
  openTime?: string | null;
  closeTime?: string | null;
  disabled?: boolean;
  title?: string;
  description?: string;
}) {
  const selected = new Set((days?.length ? days : DEFAULT_BUSINESS_HOURS.days).map(Number));
  const open = String(openTime || DEFAULT_BUSINESS_HOURS.openTime).slice(0, 5);
  const close = String(closeTime || DEFAULT_BUSINESS_HOURS.closeTime).slice(0, 5);

  return <fieldset className="business-hours-fields form-span-2" disabled={disabled}>
    <legend>{title}</legend>
    <p>{description}</p>
    <div className="business-hours-days">
      {DAYS.map(day => <label key={day.value}>
        <input
          type="checkbox"
          name={`${prefix}days`}
          value={day.value}
          defaultChecked={selected.has(day.value)}
        />
        <span>{day.label}</span>
      </label>)}
    </div>
    <div className="business-hours-time-grid">
      <div className="field">
        <label>Apertura</label>
        <input type="time" name={`${prefix}open_time`} defaultValue={open} required={!disabled} />
      </div>
      <div className="field">
        <label>Cierre</label>
        <input type="time" name={`${prefix}close_time`} defaultValue={close} required={!disabled} />
      </div>
    </div>
  </fieldset>;
}
