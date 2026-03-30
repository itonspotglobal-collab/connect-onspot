export default function EnterpriseServicesPage() {
  const offerings = [
    {
      title: "Enterprise Service Architecture", eyebrow: "Strategic layer",
      description: "We design and operate complex service systems for organizations that need scale, governance, regional consistency, and measurable business outcomes.",
      points: ["Multi-market operating models", "Executive governance and reporting", "Service quality systems and SOPs", "AI + human workflow orchestration"],
    },
    {
      title: "Embedded Delivery Pods", eyebrow: "Execution layer",
      description: "Cross-functional delivery teams built around your growth priorities, customer operations, and transformation agenda.",
      points: ["Dedicated program leadership", "Operations, CX, and back-office pods", "Launch support and process migration", "Flexible regional deployment"],
    },
    {
      title: "Enterprise Optimization", eyebrow: "Performance layer",
      description: "Continuous improvement systems that combine analytics, automation, QA, and operating discipline to lift efficiency over time.",
      points: ["KPI dashboards and service reviews", "Process redesign and automation", "Cost and productivity optimization", "Risk, compliance, and resilience planning"],
    },
  ];

  const enterpriseCapabilities = [
    { title: "Built for complexity", body: "Ideal for organizations managing multiple teams, markets, stakeholders, and workflows that cannot be solved by staffing alone." },
    { title: "Governed at leadership level", body: "Structured oversight, operating cadence, KPI ownership, and executive visibility from day one." },
    { title: "Designed for transformation", body: "Combines people, systems, AI, process, and management architecture into one operating model." },
    { title: "Scaled without chaos", body: "Standardization, documentation, and quality controls keep expansion disciplined across geographies and functions." },
  ];

  const phases = [
    { step: "01", title: "Diagnose", text: "We map your current operating environment, friction points, dependencies, and cost of inefficiency." },
    { step: "02", title: "Architect", text: "We design the service model, governance structure, technology layer, and role ownership needed for scale." },
    { step: "03", title: "Deploy", text: "We launch the right combination of leadership, specialists, workflows, and support systems." },
    { step: "04", title: "Optimize", text: "We continuously improve performance through analytics, AI, QA, and operational reviews." },
  ];

  const comparisonRows = [
    { category: "Best for", enterprise: "Large organizations, complex operations, transformation initiatives, multi-market or multi-function needs", managed: "Companies that want a full function run for them with clear SLAs and outcome ownership", resourced: "Companies that need talent, capacity, or specialized support integrated into their own team" },
    { category: "Primary value", enterprise: "Operating model design + execution + governance + optimization", managed: "End-to-end service delivery managed by OnSpot", resourced: "Fast access to skilled people and flexible team extension" },
    { category: "Level of complexity handled", enterprise: "Highest — cross-functional, cross-market, strategic and operational", managed: "Medium to high — function-specific but fully operated", resourced: "Low to medium — role or team augmentation" },
    { category: "Ownership model", enterprise: "Shared strategic governance with OnSpot leading architecture and delivery systems", managed: "OnSpot owns the service delivery model and day-to-day operation", resourced: "Client retains operating ownership while OnSpot provides talent" },
    { category: "Leadership involvement", enterprise: "High — executive alignment, steering cadence, program governance", managed: "Moderate — performance reviews and service oversight", resourced: "Light to moderate — direct team management usually sits with client" },
    { category: "AI and process redesign", enterprise: "Core part of the model", managed: "Applied where it improves delivery", resourced: "Optional and usually client-led" },
    { category: "Customization", enterprise: "Highly tailored", managed: "Structured with tailored service design", resourced: "Role and staffing based" },
    { category: "Commercial orientation", enterprise: "Transformation and enterprise value creation", managed: "Service outcomes and operational efficiency", resourced: "Capacity, speed, and cost leverage" },
  ];

  const metrics = [
    { label: "Functions unified", value: "3–8" },
    { label: "Markets supported", value: "1–12+" },
    { label: "Operating visibility", value: "Executive" },
    { label: "Delivery model", value: "Human + AI" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(71,78,173,0.2),_transparent_35%),linear-gradient(180deg,_#ffffff_0%,_#f6f7fb_100%)]">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-24 left-[-5%] h-72 w-72 rounded-full bg-[#474ead]/20 blur-3xl" />
          <div className="absolute right-[-8%] top-20 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="grid items-end gap-14 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#474ead]/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#474ead] shadow-sm backdrop-blur">
                Enterprise Services
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl md:leading-[1.02]">
                Built for organizations that need more than outsourcing.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                Enterprise Services is where OnSpot brings together strategy, operating design, delivery teams, AI systems, and governance into one scalable model.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <button className="rounded-full bg-[#474ead] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#474ead]/20 transition hover:-translate-y-0.5 hover:shadow-xl">
                  Design Your Enterprise Model
                </button>
                <button className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                  See Delivery Architecture
                </button>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Enterprise Snapshot</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">One system. Many moving parts.</div>
                </div>
                <div className="rounded-2xl bg-[#474ead]/10 px-4 py-2 text-sm font-semibold text-[#474ead]">Premium Model</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {metrics.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:shadow-md">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                    <div className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-900">Typical use cases</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                  {["Regional CX transformation", "Back-office consolidation", "Multi-team support systems", "AI-enabled operations", "Enterprise launch programs"].map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Enterprise Services */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#474ead]">Why Enterprise Services</div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            When scale, control, and transformation matter at the same time.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            This is not simply a staffing solution or a single managed function. It is a more senior operating model for businesses that need structure across multiple moving pieces.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {enterpriseCapabilities.map((item) => (
            <div key={item.title} className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#474ead]/25 hover:shadow-xl">
              <div className="mb-5 h-10 w-10 rounded-2xl bg-[#474ead]/10 transition group-hover:scale-110" />
              <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What's Inside */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 md:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#474ead]">What's inside</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                A layered model for enterprise execution.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Each engagement can be configured around strategy, delivery, and performance systems depending on where the business needs leverage most.
              </p>
            </div>
            <div className="space-y-5">
              {offerings.map((item) => (
                <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-[#fafafe] p-6 transition hover:border-[#474ead]/20 hover:bg-white hover:shadow-lg">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#474ead]">{item.eyebrow}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {item.points.map((point) => (
                      <div key={point} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{point}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service Comparison */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#474ead]">Service comparison</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Enterprise vs Managed vs Resourced
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Clear positioning helps buyers understand which model fits their stage, complexity, and operating ambition.
            </p>
          </div>
          <div className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            Best viewed as strategic scope → delivery ownership → talent extension
          </div>
        </div>
        <div className="mt-10 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-5 text-sm font-semibold text-slate-500">Category</th>
                  <th className="px-6 py-5 text-sm font-semibold text-[#474ead]">Enterprise</th>
                  <th className="px-6 py-5 text-sm font-semibold text-slate-700">Managed</th>
                  <th className="px-6 py-5 text-sm font-semibold text-slate-700">Resourced</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={row.category} className={index !== comparisonRows.length - 1 ? "border-b border-slate-200" : ""}>
                    <td className="px-6 py-6 align-top text-sm font-semibold text-slate-900">{row.category}</td>
                    <td className="px-6 py-6 align-top text-sm leading-7 text-slate-600">{row.enterprise}</td>
                    <td className="px-6 py-6 align-top text-sm leading-7 text-slate-600">{row.managed}</td>
                    <td className="px-6 py-6 align-top text-sm leading-7 text-slate-600">{row.resourced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Engagement Phases */}
      <section className="bg-[linear-gradient(180deg,_#ffffff_0%,_#f7f8fd_100%)]">
        <div className="mx-auto max-w-7xl px-6 py-20 md:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#474ead]">Engagement model</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                How enterprise engagements move from diagnosis to scale.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                A disciplined rollout model keeps transformation grounded in execution, not just strategy decks.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {phases.map((phase) => (
                <div key={phase.step} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-sm font-semibold tracking-[0.22em] text-[#474ead]">{phase.step}</div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{phase.title}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{phase.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_30px_100px_rgba(15,23,42,0.18)] md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-200">Enterprise close</div>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                For companies entering a more serious stage of scale.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                Enterprise Services exists for leadership teams that need a stronger operating system — not just more people. OnSpot helps design the structure, supply the execution engine, and keep the model improving over time.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-sm font-semibold text-white">Ideal buyer profile</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <div>Organizations with multiple departments or geographies that need one consistent service architecture.</div>
                <div>Leaders who want stronger control, visibility, process maturity, and AI-enabled performance gains.</div>
                <div>Teams looking for a partner that can operate at both executive and execution level.</div>
              </div>
              <button className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5">
                Start an Enterprise Conversation
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
