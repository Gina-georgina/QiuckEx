import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "../components/ui/Badge";

const meta: Meta<typeof Badge> = { title: "Shared/Badge", component: Badge, args: { children: "Testnet" } };
export default meta;
type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {};
export const Primary: Story = { args: { variant: "primary" } };
export const Success: Story = { args: { variant: "success", children: "Paid" } };
export const Warning: Story = { args: { variant: "warning", children: "Pending" } };
export const Danger: Story = { args: { variant: "danger", children: "Expired" } };
