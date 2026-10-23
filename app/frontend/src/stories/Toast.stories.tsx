import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toast } from "../components/ui/Toast";

const meta: Meta<typeof Toast> = { title: "Shared/Toast", component: Toast, args: { message: "Payment link copied" } };
export default meta;
type Story = StoryObj<typeof Toast>;

export const Info: Story = {};
export const Success: Story = { args: { variant: "success", message: "Payment received" } };
export const Error: Story = { args: { variant: "error", message: "Transaction failed" } };
export const Dismissible: Story = { args: { onDismiss: () => {} } };
