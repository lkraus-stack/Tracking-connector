import { ValidationWorkbench } from "@/components/validation-workbench";
import { getAdminDashboardData } from "@/lib/admin/repository";

export default async function ValidationPage() {
  const dashboard = await getAdminDashboardData();

  return (
    <ValidationWorkbench
      clients={dashboard.clients}
      defaultClientId={dashboard.clients[0]?.id ?? ""}
      defaultMonth="2026-05"
    />
  );
}
