import { Link, useSearch } from "wouter";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { getSafeReturnTo } from "@shared/internalRedirect";
import { AuthModalFrame } from "@/components/AuthModalFrame";

export function PortalChooser() {
  const currentSearch = useSearch();
  const search = (() => {
    const params = new URLSearchParams(currentSearch);
    params.delete("portal");
    const target = getSafeReturnTo(params.get("returnTo"));
    if (params.has("returnTo")) {
      params.delete("returnTo");
      if (target) params.set("returnTo", target);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  })();
  const portalHref = (portal: "client" | "talent") => `/login/${portal}${search}`;

  const roleCard = (
    portal: "client" | "talent",
    title: string,
    description: string,
  ) => {
    const client = portal === "client";
    const accent = client ? "#5B7CFF" : "#F5D76E";
    const focus = client ? "focus-visible:ring-[#9BAAFF]" : "focus-visible:ring-yellow-200";
    return (
      <Link
        href={portalHref(portal)}
        className={`group flex min-h-[218px] flex-col items-center justify-center gap-3.5 rounded-xl border border-white/20 bg-white/5 p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 ${focus}`}
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ color: accent, backgroundColor: client ? "rgba(58,58,248,.18)" : "rgba(245,215,110,.12)" }}
        >
          {client ? <Building2 className="h-6 w-6" /> : <UserRound className="h-6 w-6" />}
        </span>
        <span>
          <span className="block text-base font-semibold text-white">{title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-white/75">{description}</span>
        </span>
        <span className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-white/90">
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    );
  };

  return (
    <AuthModalFrame title="Login portal selection" wide>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl" style={{ letterSpacing: "-0.02em" }}>
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
          Choose how you want to access OnSpot.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {roleCard("client", "Client", "Hire and manage outsourcing talent.")}
        {roleCard("talent", "Talent", "Find jobs and manage your career profile.")}
      </div>
    </AuthModalFrame>
  );
}
