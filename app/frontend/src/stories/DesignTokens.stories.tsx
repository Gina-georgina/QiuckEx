import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { colors, spacing, typography } from "../design-tokens";

const Tokens = () => (
  <div className="flex flex-col gap-6 p-4">
    <section>
      <h3 className="mb-2 font-semibold">Brand colours</h3>
      <div className="flex flex-wrap gap-3">
        {(["primary", "secondary", "destructive", "muted"] as const).map((name) => (
          <div key={name} className="flex flex-col items-center text-xs">
            <span className="h-12 w-12 rounded-md border" style={{ background: colors[name] }} />
            {name}
            <code>{colors[name]}</code>
          </div>
        ))}
      </div>
    </section>
    <section>
      <h3 className="mb-2 font-semibold">Font sizes</h3>
      {Object.entries(typography.fontSize).map(([k, v]) => (
        <p key={k} style={{ fontSize: v }}>{k} — {v}px</p>
      ))}
    </section>
    <section>
      <h3 className="mb-2 font-semibold">Spacing</h3>
      {Object.entries(spacing).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <code className="w-8">{k}</code>
          <span className="h-3 bg-primary" style={{ width: v }} />
        </div>
      ))}
    </section>
  </div>
);

const meta: Meta<typeof Tokens> = { title: "Foundations/Design Tokens", component: Tokens };
export default meta;
export const All: StoryObj<typeof Tokens> = {};
