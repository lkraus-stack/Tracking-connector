import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectorWorkbench } from "@/components/connector-workbench";
import { getDashboardSnapshot } from "@/lib/reporting/store";

describe("ConnectorWorkbench", () => {
  it("renders the ledger and selected connector receipt", () => {
    render(<ConnectorWorkbench initialData={getDashboardSnapshot()} />);

    expect(screen.getByRole("heading", { name: "Pipeline ledger" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shopify Orders/i })).toBeInTheDocument();
    expect(screen.getByText("Latest sync receipt")).toBeInTheDocument();
    expect(screen.getAllByText("analytics.shopify_orders").length).toBeGreaterThan(0);
  });
});
