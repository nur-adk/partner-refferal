"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  searchPeople,
  enrichById,
  enrichByLinkedin,
  enrichedToLeadData,
  enrichOrganization,
  DEFAULT_SENIORITIES,
  type ApolloLeadData,
  type OrgInfo,
} from "@/lib/apollo";
import {
  ENABLED_SEARCH_COUNTRIES,
  TITLE_CATEGORIES,
  guessIndustry,
  mapApolloIndustry,
  type LeadCountry,
} from "@/lib/constants";
import { lookupEducation } from "@/lib/education";

// Hard cap on how many people we enrich in one action call. Each enrichment
// costs an Apollo credit, so we bound it to avoid burning credits by accident.
const MAX_ENRICH = 25;

export async function updateLeadSummary(leadId: string, summary: string) {
  const trimmed = summary.trim();

  await prisma.lead.update({
    where: { id: leadId },
    data: { summary: trimmed ? trimmed : null },
  });

  revalidatePath(`/leads/${leadId}`);

  return { summary: trimmed ? trimmed : null };
}

export async function updateLeadUniversity(leadId: string, university: string) {
  const trimmed = university.trim();

  await prisma.lead.update({
    where: { id: leadId },
    data: { university: trimmed ? trimmed : null },
  });

  // Revalidate both the record and the list (the 🔗 warm-connection badge and
  // University column there are recomputed from this value).
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");

  return { university: trimmed ? trimmed : null };
}

export async function updateLeadIndustry(leadId: string, industry: string) {
  const trimmed = industry.trim();
  await prisma.lead.update({
    where: { id: leadId },
    data: { industry: trimmed ? trimmed : null },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { industry: trimmed ? trimmed : null };
}

// Thumbs up/down. Passing the currently-set value clears it (toggle off).
export async function setLeadRating(leadId: string, rating: "up" | "down") {
  const current = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { rating: true },
  });
  const next = current?.rating === rating ? null : rating;
  await prisma.lead.update({ where: { id: leadId }, data: { rating: next } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { rating: next };
}

// Star / un-star a lead for the Favorites view.
export async function toggleLeadFavorite(leadId: string) {
  const current = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { favorite: true },
  });
  const next = !current?.favorite;
  await prisma.lead.update({ where: { id: leadId }, data: { favorite: next } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { favorite: next };
}

// Permanently remove a lead. The UI confirms before calling this.
export async function deleteLead(leadId: string) {
  await prisma.lead.delete({ where: { id: leadId } });
  revalidatePath("/leads");
  return { ok: true };
}

// Clear the "new" flag on every lead — the user has acknowledged the last batch.
export async function markLeadsSeen() {
  await prisma.lead.updateMany({ where: { isNew: true }, data: { isNew: false } });
  revalidatePath("/leads");
  return { ok: true };
}

// One-line company blurb appended to a lead's summary, marked so we don't
// append it twice on re-enrichment.
const COMPANY_TAG = "Company —";
function companyBlurb(org: OrgInfo): string | null {
  if (!org.name) return null;
  const bits: string[] = [];
  if (org.description) bits.push(org.description);
  const meta = [
    org.employees ? `${org.employees.toLocaleString()} employees` : null,
    org.location,
  ].filter(Boolean);
  if (meta.length) bits.push(`(${meta.join(", ")})`);
  return `${COMPANY_TAG} ${org.name}: ${bits.join(" ")}`.trim();
}

export type CompanyEnrichResult = {
  ok: boolean;
  filled: boolean;
  industry?: string | null;
  company?: string | null;
  error?: string;
};

// Enrich one lead from its company via Apollo's org endpoints (free of
// people-match credits). Fills industry when missing, backfills the company
// website, and appends a short company blurb to the summary.
export async function enrichLeadCompany(leadId: string): Promise<CompanyEnrichResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { company: true, companyWebsite: true, industry: true, summary: true },
  });
  if (!lead) return { ok: false, filled: false, error: "Lead not found." };

  const org = await enrichOrganization({ domain: lead.companyWebsite, name: lead.company });
  if (!org) return { ok: true, filled: false };

  // Trust Apollo's authoritative industry (mapped onto our picklist); only fall
  // back to a keyword guess if Apollo has no industry for the company.
  const fromApollo = mapApolloIndustry(org.industry);
  const guessed = guessIndustry([...org.keywords, org.description].filter(Boolean).join(" "));
  const industry = lead.industry || fromApollo || guessed;

  const blurb = companyBlurb(org);
  const summary =
    blurb && !(lead.summary ?? "").includes(COMPANY_TAG)
      ? [lead.summary, blurb].filter(Boolean).join("\n\n")
      : lead.summary;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      industry,
      companyWebsite: lead.companyWebsite || org.website,
      summary,
    },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true, filled: true, industry, company: org.name };
}

// Bulk: enrich every lead that has a company but no industry yet.
export async function enrichMissingCompanies(): Promise<{
  ok: boolean;
  attempted: number;
  filled: number;
}> {
  const leads = await prisma.lead.findMany({
    where: {
      OR: [{ industry: null }, { industry: "" }],
      NOT: { company: null },
    },
    select: { id: true },
  });

  let filled = 0;
  for (const lead of leads) {
    const r = await enrichLeadCompany(lead.id);
    if (r.filled) filled += 1;
    await new Promise((res) => setTimeout(res, 200));
  }
  if (filled > 0) revalidatePath("/leads");
  return { ok: true, attempted: leads.length, filled };
}

export type EducationEnrichResult = {
  ok: boolean;
  university?: string | null;
  blocked?: boolean; // LinkedIn masked/omitted — worth a spaced-out retry
  error?: string;
};

// Look up one lead's education from its LinkedIn profile (free, no key) and save
// it. Used by the per-lead "Find education" button.
export async function enrichLeadEducation(leadId: string): Promise<EducationEnrichResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { linkedinUrl: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };

  const { university, blocked } = await lookupEducation(lead.linkedinUrl);
  if (university) {
    await prisma.lead.update({ where: { id: leadId }, data: { university } });
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  }
  return { ok: true, university, blocked };
}

// Fill education for every lead that doesn't have one yet. Runs sequentially
// with a small delay so LinkedIn is less likely to throttle the batch. Returns
// how many were filled vs. still empty.
export async function enrichMissingEducation(): Promise<{
  ok: boolean;
  attempted: number;
  filled: number;
  blocked: number;
}> {
  const leads = await prisma.lead.findMany({
    where: {
      OR: [{ university: null }, { university: "" }],
      NOT: { linkedinUrl: null },
    },
    select: { id: true, linkedinUrl: true },
  });

  let filled = 0;
  let blocked = 0;
  for (const lead of leads) {
    const { university, blocked: wasBlocked } = await lookupEducation(lead.linkedinUrl);
    if (university) {
      await prisma.lead.update({ where: { id: lead.id }, data: { university } });
      filled += 1;
    } else if (wasBlocked) {
      blocked += 1;
    }
    // Be polite to LinkedIn between requests.
    await new Promise((r) => setTimeout(r, 500));
  }

  if (filled > 0) {
    revalidatePath("/leads");
  }
  return { ok: true, attempted: leads.length, filled, blocked };
}

export type GenerateResult = {
  ok: boolean;
  error?: string;
  searchMatches?: number; // total people matching the filters in Apollo
  enriched?: number; // how many we spent credits enriching
  created?: number; // new leads inserted
  duplicates?: number; // skipped because already in the DB
};

// Persist a batch of enriched Apollo people as tool-generated leads, skipping
// anyone whose Apollo id (or LinkedIn URL) is already stored. Returns counts.
async function persistLeads(
  leads: ApolloLeadData[],
  extra: { similarToLinkedinUrl?: string; industry?: string } = {},
): Promise<{ created: number; duplicates: number }> {
  let created = 0;
  let duplicates = 0;

  for (const lead of leads) {
    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          { apolloId: lead.apolloId },
          ...(lead.linkedinUrl ? [{ linkedinUrl: lead.linkedinUrl }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) {
      duplicates += 1;
      continue;
    }

    // Best-effort free education enrichment from the LinkedIn profile. Apollo
    // doesn't return education, so this is our only automatic source; failures
    // (LinkedIn masking/throttling) are non-fatal — the lead is still created
    // and can be enriched later via the "Find education" button.
    let university = lead.university;
    if (!university && lead.linkedinUrl) {
      try {
        const edu = await lookupEducation(lead.linkedinUrl);
        if (edu.university) university = edu.university;
      } catch {
        /* ignore — enrichment is optional */
      }
    }

    const row = await prisma.lead.create({
      data: {
        ...lead,
        university,
        isNew: true,
        // Tag with the searched industry if the user picked one; otherwise fall
        // back to a best-effort guess from the lead's own text.
        industry: extra.industry ?? lead.industry ?? guessIndustry([lead.title, lead.summary].filter(Boolean).join(" ")),
        source: "tool_generated",
        similarToLinkedinUrl: extra.similarToLinkedinUrl ?? null,
      },
    });

    // Best-effort company enrichment (Apollo org endpoints, credit-free): fills
    // industry/company context. Non-fatal — the lead already exists if this fails.
    try {
      await enrichLeadCompany(row.id);
    } catch {
      /* ignore — enrichment is optional */
    }
    created += 1;
  }

  return { created, duplicates };
}

// "Generate" — search for fractional CMOs in an enabled country, then enrich
// the first `count` results and store them as leads.
export async function generateLeads(input: {
  country: LeadCountry;
  count: number;
  roles?: string[]; // TITLE_CATEGORIES labels; narrows person_titles (union)
  industry?: string; // an INDUSTRIES label; narrows via keyword + tags results
}): Promise<GenerateResult> {
  if (!ENABLED_SEARCH_COUNTRIES.includes(input.country)) {
    return { ok: false, error: `Search isn't enabled for ${input.country} yet.` };
  }

  const count = Math.min(Math.max(1, Math.floor(input.count)), MAX_ENRICH);

  // Narrow titles to the union of the picked role buckets, else the full ICP set.
  const picked = input.roles?.length
    ? TITLE_CATEGORIES.filter((c) => input.roles!.includes(c.label))
    : [];
  const titles = picked.length ? [...new Set(picked.flatMap((c) => c.searchTitles))] : undefined;

  try {
    // Only the latest run is "new" — clear the flag from any prior batch first.
    await prisma.lead.updateMany({ where: { isNew: true }, data: { isNew: false } });

    const { people, totalEntries } = await searchPeople({
      country: input.country,
      titles,
      keywords: input.industry || undefined,
      page: 1,
      perPage: count,
    });

    const enriched: ApolloLeadData[] = [];
    for (const person of people.slice(0, count)) {
      const full = await enrichById(person.id);
      if (full) enriched.push(enrichedToLeadData(full));
    }

    const { created, duplicates } = await persistLeads(enriched, {
      industry: input.industry || undefined,
    });
    revalidatePath("/leads");

    return {
      ok: true,
      searchMatches: totalEntries,
      enriched: enriched.length,
      created,
      duplicates,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Search failed." };
  }
}

// "Similar To" — enrich the pasted LinkedIn seed to learn its title/seniority/
// country, then search for matching people and enrich a batch. `page` lets
// "3 More Similar" pull the next page from the same seed without re-enriching it.
export async function generateSimilarLeads(input: {
  linkedinUrl: string;
  count: number;
  page?: number;
}): Promise<GenerateResult & { seedName?: string; seedTitle?: string }> {
  const url = input.linkedinUrl.trim();
  if (!/linkedin\.com\/in\//i.test(url)) {
    return { ok: false, error: "Please paste a LinkedIn profile URL (linkedin.com/in/…)." };
  }

  const count = Math.min(Math.max(1, Math.floor(input.count)), MAX_ENRICH);
  const page = Math.max(1, Math.floor(input.page ?? 1));

  try {
    // A fresh "Similar To" (page 1) starts a new batch; "3 More Similar"
    // (page > 1) adds to the same batch, so only clear on page 1.
    if (page === 1) {
      await prisma.lead.updateMany({ where: { isNew: true }, data: { isNew: false } });
    }

    const seed = await enrichByLinkedin(url);
    if (!seed) {
      return { ok: false, error: "Apollo couldn't find that LinkedIn profile." };
    }

    const seedData = enrichedToLeadData(seed);
    const titles = seed.title ? [seed.title] : undefined;
    const seniorities = seed.seniority ? [seed.seniority] : DEFAULT_SENIORITIES;

    const { people, totalEntries } = await searchPeople({
      country: seedData.country,
      titles,
      seniorities,
      page,
      perPage: count,
    });

    // Don't re-enrich the seed person if they appear in their own results.
    const candidates = people.filter((p) => p.id !== seed.id).slice(0, count);

    const enriched: ApolloLeadData[] = [];
    for (const person of candidates) {
      const full = await enrichById(person.id);
      if (full) enriched.push(enrichedToLeadData(full));
    }

    const { created, duplicates } = await persistLeads(enriched, {
      similarToLinkedinUrl: url,
    });
    revalidatePath("/leads");

    return {
      ok: true,
      seedName: seed.name,
      seedTitle: seed.title,
      searchMatches: totalEntries,
      enriched: enriched.length,
      created,
      duplicates,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Similar search failed." };
  }
}
