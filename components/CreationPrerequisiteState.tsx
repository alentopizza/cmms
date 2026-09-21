import Link from "next/link";

export default function CreationPrerequisiteState({
  icon,
  eyebrow = "Proceso de creación",
  title,
  message,
  href,
  action,
}: {
  icon: string;
  eyebrow?: string;
  title: string;
  message: string;
  href: string;
  action: string;
}) {
  return <section className="card creation-prerequisite-state section">
    <div className="creation-prerequisite-icon" aria-hidden="true">{icon}</div>
    <span className="eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    <p>{message}</p>
    <Link className="button" href={href}>{action}</Link>
  </section>;
}
