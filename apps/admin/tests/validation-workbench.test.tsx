import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ValidationWorkbench } from "@/components/validation-workbench";
import { mockClients } from "@tracking-connector/shared";

describe("ValidationWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders validation controls with mock clients", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/validation/runs")) {
        return Response.json({ runs: [] });
      }

      return Response.json({
        clientId: "client-nordstern",
        platform: "both",
        month: "2026-05",
        airbyte: {
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          conversionValue: 0
        },
        comparison: null,
        metrics: [],
        status: "ok"
      });
    });
    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    render(<ValidationWorkbench clients={mockClients} defaultClientId="client-nordstern" defaultMonth="2026-05" />);

    expect(screen.getByRole("heading", { name: "Validation cockpit" })).toBeInTheDocument();
    expect(screen.getByLabelText("Kunde")).toBeInTheDocument();
    expect(screen.getByLabelText("Plattform")).toBeInTheDocument();
    expect(screen.getByText("Monatsvergleich")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
