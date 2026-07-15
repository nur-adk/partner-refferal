import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LeadsTable, { type LeadRow } from "@/components/LeadsTable";
import GeneratePanel from "@/components/GeneratePanel";
import FillEducationButton from "@/components/FillEducationButton";
import EnrichCompanyButton from "@/components/EnrichCompanyButton";
import MarkSeenButton from "@/components/MarkSeenButton";
import { findWarmConnections, parseDecisionMaker } from "@/lib/warmConnections";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      title: true,
      university: true,
      industry: true,
      company: true,
      pastEmployers: true,
      source: true,
      country: true,
      rating: true,
      favorite: true,
      isNew: true,
      createdAt: true,
    },
  });

  const decisionMakers = (await prisma.decisionMaker.findMany()).map(parseDecisionMaker);

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    title: lead.title,
    university: lead.university,
    industry: lead.industry,
    source: lead.source,
    country: lead.country,
    rating: lead.rating,
    favorite: lead.favorite,
    isNew: lead.isNew,
    createdAt: lead.createdAt.toISOString(),
    warmConnections: findWarmConnections(lead, decisionMakers).length,
  }));

  const favorites = rows.filter((r) => r.favorite);
  const newLeads = rows.filter((r) => r.isNew);

  // Leads with no university yet — candidates for the free LinkedIn lookup.
  const missingEducation = leads.filter((l) => !l.university).length;
  // Leads that have a company but no industry — candidates for Apollo org enrich.
  const missingIndustry = leads.filter((l) => l.company && !l.industry).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">US-based fractional CMO / marketing leader prospects.</p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Upload CSV
        </Link>
      </div>

      <GeneratePanel />

      {rows.length > 0 && (missingEducation > 0 || missingIndustry > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <EnrichCompanyButton missingCount={missingIndustry} />
          <FillEducationButton missingCount={missingEducation} />
        </div>
      )}

      {newLeads.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-green-300 bg-green-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-green-900">
              ✨ Newly found ({newLeads.length}) — from your latest search
            </h2>
            <MarkSeenButton />
          </div>
          <ul className="divide-y divide-green-200 rounded-md border border-green-200 bg-white">
            {newLeads.map((n) => (
              <li key={n.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{n.name}</span>
                  {n.title && <span className="text-gray-500"> · {n.title}</span>}
                  {n.industry && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      {n.industry}
                    </span>
                  )}
                  {n.warmConnections > 0 && (
                    <span className="ml-1.5 text-xs" title="warm connection">
                      🔗 {n.warmConnections}
                    </span>
                  )}
                </div>
                <Link
                  href={`/leads/${n.id}`}
                  className="ml-3 shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {favorites.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-bold text-amber-900">⭐ Favorites ({favorites.length})</h2>
          <ul className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/leads/${f.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-sm text-gray-800 hover:bg-amber-100"
                >
                  <span className="font-medium">{f.name}</span>
                  {f.title && <span className="text-gray-500">· {f.title}</span>}
                  {f.warmConnections > 0 && <span title="warm connection">🔗</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          No leads yet. Use <span className="font-medium text-gray-700">Generate</span> above, or{" "}
          <Link href="/upload" className="font-medium text-blue-600 hover:underline">
            upload a CSV
          </Link>
          .
        </div>
      ) : (
        <LeadsTable leads={rows} />
      )}
    </main>
  );
}
