import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/funda/dashboards/SimplePage";
export const Route = createFileRoute("/_app/staff")({
  component: () => <StubPage title="Staff" sub="Manage teachers and admin staff." />,
});
