import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectorWorkbench } from "@/components/connector-workbench";
import { getAdminDashboardData } from "@/lib/admin/repository";

describe("ConnectorWorkbench", () => {
  it("renders clients, Airbyte sync controls and Looker views", async () => {
    render(<ConnectorWorkbench initialData={await getAdminDashboardData()} />);

    expect(screen.getByRole("heading", { name: "Monthly reporting control" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nordstern Bikes/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Run sync" }).length).toBeGreaterThan(0);
    expect(screen.getByText("marketing_reporting.vw_paid_ads_daily")).toBeInTheDocument();
  });
});
