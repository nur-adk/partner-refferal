import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditableSummary from "@/components/EditableSummary";
import EditableUniversity from "@/components/EditableUniversity";
import EditableIndustry from "@/components/EditableIndustry";
import { findWarmConnections, parseDecisionMaker } from "@/lib/warmConnections";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });

  if (!lead) {
    notFound();
  }

  const decisionMakers = (await prisma.decisionMaker.findMany()).map(parseDecisionMaker);
  const warmConnections = findWarmConnections(lead, decisionMakers);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/leads" className="text-sm font-medium text-blue-600 hover:underline">
        &larr; Back to leads
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{lead.name}</h1>
            <p className="text-gray-600">{lead.title ?? "No title on file"}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            {lead.country}
          </span>
        </div>

        <WarmConnections connections={warmConnections} />

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <EditableUniversity leadId={lead.id} initialUniversity={lead.university} />
          <EditableIndustry leadId={lead.id} initialIndustry={lead.industry} />
          <Field label="Company" value={lead.company} />
          <Field label="Past Employers" value={lead.pastEmployers} />
          <Field label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
          <Field label="LinkedIn" value={lead.linkedinUrl} href={lead.linkedinUrl ?? undefined} />
          <Field label="Personal Website" value={lead.personalWebsite} href={lead.personalWebsite ?? undefined} />
          <Field label="Company Website" value={lead.companyWebsite} href={lead.companyWebsite ?? undefined} />
          <Field label="Source" value={lead.source === "manual" ? "Manual" : "Tool-generated"} />
        </dl>

        <EditableSummary leadId={lead.id} initialSummary={lead.summary} />
      </div>
    </main>
  );
}

function WarmConnections({
  connections,
}: {
  connections: import("@/lib/warmConnections").WarmConnection[];
}) {
  // Group connections by decision-maker for a tidy readout.
  const byPerson = new Map<string, string[]>();
  for (const c of connections) {
    const list = byPerson.get(c.decisionMaker) ?? [];
    list.push(c.label);
    byPerson.set(c.decisionMaker, list);
  }

  const hasConnections = connections.length > 0;

  return (
    <section
      className={
        hasConnections
          ? "mt-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 shadow-sm"
          : "mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4"
      }
    >
      <div className="flex items-center gap-2">
        <h2 className={hasConnections ? "text-sm font-bold text-amber-900" : "text-sm font-semibold text-gray-900"}>
          {hasConnections ? "⭐ Warm Connections — you have a way in" : "Warm Connections"}
        </h2>
        {hasConnections ? (
          <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
            {connections.length} found
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            None
          </span>
        )}
      </div>

      {connections.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          No shared university or employer overlap with the outreach team (Hugh, Ayema, Sadie,
          Michelle).
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {[...byPerson.entries()].map(([person, labels]) => (
            <li key={person}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                via {person}
              </p>
              <ul className="mt-1 space-y-1">
                {labels.map((label) => (
                  <li key={label} className="text-sm text-gray-800">
                    <span className="mr-1.5">🔗</span>
                    {label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">
        {!value ? (
          "—"
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
