import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Building2, UserRound } from "lucide-react";

type ChooserKind = "login" | "signup";

interface PortalChooserProps {
  kind: ChooserKind;
}

export function PortalChooser({ kind }: PortalChooserProps) {
  const isLogin = kind === "login";
  const search = typeof window === "undefined" ? "" : window.location.search;
  const portalHref = (portal: "client" | "talent") =>
    `${isLogin ? "/login" : "/signup"}/${portal}${search}`;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-16"
      style={{
        background: "linear-gradient(135deg, #FCFDFF 0%, #F6F8FF 20%, #EEF4FF 45%, #E7F0FF 70%, #F8F9FF 100%)",
      }}
    >
      <div className="w-full max-w-2xl text-center">
        <Link href="/">
          <span className="text-3xl font-bold tracking-tight cursor-pointer select-none text-[#6D5EF7]">
            OnSpot
          </span>
        </Link>
        <p className="text-[#94A3B8] text-xs mt-1.5 tracking-widest uppercase font-medium">
          Work Without Limits
        </p>

        <div
          className="mt-10 rounded-3xl p-6 sm:p-10"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.65)",
            boxShadow: "0 20px 60px rgba(33,40,79,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
          }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172554]">
            {isLogin ? "Welcome back" : "Create your OnSpot account"}
          </h1>
          <p className="mt-2 text-[#64748B] text-sm sm:text-base">
            {isLogin ? "Choose how you want to access OnSpot." : "Choose how you'll use OnSpot."}
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href={portalHref("client")}>
              <span className="group flex h-full cursor-pointer flex-col items-center rounded-2xl border border-[#D7DCEF] bg-white p-6 text-center transition-all hover:-translate-y-1 hover:border-[#6D5EF7] hover:shadow-lg">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#6D5EF7]/10 text-[#6D5EF7]">
                  <Building2 className="h-7 w-7" />
                </span>
                <span className="mt-4 text-lg font-semibold text-[#172554]">
                  Client
                </span>
                <span className="mt-2 text-sm leading-relaxed text-[#64748B]">
                  {isLogin ? "Hire and manage outsourcing talent." : "Hire talent and build your team."}
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6D5EF7]">
                  Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </span>
            </Link>

            <Link href={portalHref("talent")}>
              <span className="group flex h-full cursor-pointer flex-col items-center rounded-2xl border border-[#D7DCEF] bg-white p-6 text-center transition-all hover:-translate-y-1 hover:border-[#D97706] hover:shadow-lg">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D97706]/10 text-[#D97706]">
                  <UserRound className="h-7 w-7" />
                </span>
                <span className="mt-4 text-lg font-semibold text-[#172554]">
                  Talent
                </span>
                <span className="mt-2 text-sm leading-relaxed text-[#64748B]">
                  {isLogin ? "Find jobs and manage your career profile." : "Find work and grow your career."}
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D97706]">
                  Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </span>
            </Link>
          </div>

          <Link href="/">
            <span className="mt-8 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[#6D5EF7] hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </span>
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[#94A3B8]">
        &copy; {new Date().getFullYear()} OnSpot. All rights reserved.
      </p>
    </div>
  );
}