/**
 * Design tokens — single TypeScript entry point for colours, typography and
 * spacing. Values are read from packages/design-tokens/tokens.json, the same
 * source tailwind.config.ts consumes, so tokens and Tailwind classes can never
 * drift apart.
 */
import tokens from "../../../packages/design-tokens/tokens.json";

export const colors = {
  primary: tokens.color.brand.primary,
  secondary: tokens.color.brand.secondary,
  destructive: tokens.color.brand.destructive,
  muted: tokens.color.brand.muted,
  neutral: tokens.color.neutral,
} as const;

export const typography = {
  fontSize: tokens.fontSize,
  fontWeight: tokens.fontWeight,
} as const;

export const spacing = tokens.spacing;
export const borderRadius = tokens.borderRadius;

export const designTokens = { colors, typography, spacing, borderRadius } as const;
export type DesignTokens = typeof designTokens;
export default designTokens;
