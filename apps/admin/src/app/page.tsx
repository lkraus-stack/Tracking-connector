import { ConnectorWorkbench } from "@/components/connector-workbench";
import { getAdminDashboardData } from "@/lib/admin/repository";

export default async function Home() {
  const dashboard = await getAdminDashboardData();

  return <ConnectorWorkbench initialData={dashboard} />;
}
