import React from "react";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" } as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = "md" }) => (
  <span
    className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-white ${sizeStyles[size]}`}
    aria-label={name}
    role="img"
  >
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-full w-full object-cover" />
    ) : (
      initials(name)
    )}
  </span>
);

export default Avatar;
