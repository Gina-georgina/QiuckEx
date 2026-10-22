import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QRPreview } from "../components/QRPreview";

const meta: Meta<typeof QRPreview> = {
  title: "Shared/QRCode",
  component: QRPreview,
  args: { value: "https://quickex.to/pay/alice?amount=25&asset=XLM" },
};
export default meta;
type Story = StoryObj<typeof QRPreview>;

export const Default: Story = {};
export const PaymentLink: Story = { args: { isPaymentLink: true } };
export const Branded: Story = { args: { brandColor: "#2563eb" } };
export const Empty: Story = { args: { value: undefined } };
