import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TransactionRow } from "../components/ui/TransactionRow";

const meta: Meta<typeof TransactionRow> = {
  title: "Shared/TransactionRow",
  component: TransactionRow,
  parameters: { layout: "padded" },
  args: {
    counterparty: "@alice",
    amount: "25.00",
    asset: "XLM",
    direction: "in",
    status: "completed",
    timestamp: "2026-10-01T12:00:00Z",
  },
};
export default meta;
type Story = StoryObj<typeof TransactionRow>;

export const Incoming: Story = {};
export const Outgoing: Story = { args: { direction: "out", counterparty: "@bob" } };
export const Pending: Story = { args: { status: "pending" } };
export const Failed: Story = { args: { status: "failed", direction: "out" } };
