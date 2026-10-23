import React from "react";

export type ToastVariant = "info" | "success" | "error";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  info: "border-primary bg-white text-neutral-900",
  success: "border-green-600 bg-green-50 text-green-900",
  error: "border-destructive bg-red-50 text-red-900",
};

export const Toast: React.FC<ToastProps> = ({ message, variant = "info", onDismiss }) => (
  <div
    role={variant === "error" ? "alert" : "status"}
    className={`flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 shadow-md ${variantStyles[variant]}`}
  >
    <span className="text-sm">{message}</span>
    {onDismiss && (
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="ml-auto text-sm opacity-70 hover:opacity-100">
        ×
      </button>
    )}
  </div>
);

export default Toast;
