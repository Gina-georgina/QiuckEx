// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { TransactionDetailModal, STELLAR_EXPERT_TX_URL } from "../TransactionDetailModal";
import type { ActivityFeedItem } from "@/hooks/activityFeedApi";

const tx: ActivityFeedItem = {
  id: "abc123hash",
  amount: "42.5",
  asset: "USDC",
  memo: "invoice-7",
  date: "Just now",
  status: "Settled",
  source: "GSOURCEADDRESS",
  destination: "GDESTADDRESS",
  timestamp: "2026-01-02T03:04:05.000Z",
  fee: "0.00001",
  ledger: 123456,
};

describe("TransactionDetailModal", () => {
  it("renders nothing without a transaction", () => {
    const { container } = render(<TransactionDetailModal transaction={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows all transaction fields and an explorer link", () => {
    render(<TransactionDetailModal transaction={tx} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Transaction details" })).toBeInTheDocument();
    for (const text of ["abc123hash", "42.5", "GSOURCEADDRESS", "GDESTADDRESS", "invoice-7", "0.00001 XLM", "123456"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText(/USDC/)).toBeInTheDocument();
    expect(screen.getByText(/Timestamp/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view on stellar expert/i });
    expect(link).toHaveAttribute("href", `${STELLAR_EXPERT_TX_URL}abc123hash`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("closes via the close button, ESC and backdrop click", () => {
    const onClose = vi.fn();
    render(<TransactionDetailModal transaction={tx} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close transaction details/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("transaction-detail-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when clicking inside the dialog", () => {
    const onClose = vi.fn();
    render(<TransactionDetailModal transaction={tx} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
