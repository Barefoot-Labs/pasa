import { createFileRoute } from "@tanstack/react-router";
import { ClassesPage } from "@/components/funda/dashboards/ClassesPage";

export const Route = createFileRoute("/app/classes")({
  component: ClassesPage,
});
