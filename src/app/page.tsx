import { ConnectorWorkbench } from "@/components/connector-workbench";
import { getDashboardData } from "@/lib/reporting/repository";

export default async function Home() {
  const dashboard = await getDashboardData();

  return <ConnectorWorkbench initialData={dashboard} />;
}
