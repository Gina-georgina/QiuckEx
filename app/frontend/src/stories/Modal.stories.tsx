import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Modal } from "../components/ui/Modal";

const meta: Meta<typeof Modal> = {
  title: "Shared/Modal",
  component: Modal,
  parameters: { layout: "fullscreen" },
  args: { open: true, title: "Confirm payment", onClose: () => {}, children: <p>Send 25 XLM to @alice?</p> },
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const Open: Story = {};
