import React, { useId } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, hint, error, id, className = "", ...rest }) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={[
          "rounded-md border px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
          error ? "border-destructive" : "border-neutral-300",
          className,
        ].join(" ")}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
};

export default Input;
