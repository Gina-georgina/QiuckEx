import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar } from "../components/ui/Avatar";

const meta: Meta<typeof Avatar> = { title: "Shared/Avatar", component: Avatar, args: { name: "Ada Lovelace" } };
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Initials: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
