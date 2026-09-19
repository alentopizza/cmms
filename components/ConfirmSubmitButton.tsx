"use client";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { confirmation: string };

export default function ConfirmSubmitButton({ confirmation, onClick, ...props }: Props) {
  return <button {...props} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && !window.confirm(confirmation)) event.preventDefault();
  }} />;
}
