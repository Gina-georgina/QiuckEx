import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "../components/ui/Input";

const meta: Meta<typeof Input> = { title: "Shared/Input", component: Input, args: { label: "Username", placeholder: "alice" } };
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: "3–20 lowercase characters" } };
export const WithError: Story = { args: { error: "Username is already taken" } };
