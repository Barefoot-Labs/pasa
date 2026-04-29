import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export function FundaLogo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold text-lg">
      <div className="size-9 rounded-lg bg-accent grid place-items-center text-accent-foreground shadow-sm">
        <GraduationCap className="size-5" strokeWidth={2.5} />
      </div>
      <span className={light ? "text-white" : "text-foreground"}>
        Funda<span className="text-accent">.</span>
      </span>
    </Link>
  );
}
