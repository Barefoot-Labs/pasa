import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/funda/dashboards/SimplePage";
export const Route = createFileRoute("/_app/classes")({
  component: () => <StubPage title="Classes" sub="Class groups and timetables." />,
});
