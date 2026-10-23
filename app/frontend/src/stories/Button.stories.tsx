import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../components/Button";

const meta: Meta<typeof Button> = { title: "Shared/Button", component: Button, args: { children: "Send payment" } };
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Danger: Story = { args: { variant: "danger", children: "Cancel link" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
