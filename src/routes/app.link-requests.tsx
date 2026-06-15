import { createFileRoute } from "@tanstack/react-router";
import { LinkRequestsPage } from "@/components/funda/dashboards/LinkRequestsPage";

export const Route = createFileRoute("/app/link-requests")({
  component: LinkRequestsPage,
});

