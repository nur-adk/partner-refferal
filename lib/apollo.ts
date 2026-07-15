// NOTE: server-only module — imported exclusively from Server Actions. It reads
// APOLLO_API_KEY from the environment and must never be pulled into a Client
// Component bundle.
import { COUNTRY_CONFIG, countryCodeFromApollo, type LeadCountry } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Apollo.io client.
//
// The free/trial API tier splits sourcing into two calls:
//   1. SEARCH  (POST /mixed_people/api_search) — free, but returns only
//      obfuscated teasers (first name, title, org name, has_email flags).
//   2. ENRICH  (POST /people/match)            — 1 credit per person, returns
//      full name, linkedin_url, verified email, location, employment history.
//
// So "Generate" = search then enrich each result by its Apollo person id.
// ---------------------------------------------------------------------------

const APOLLO_BASE = "https://api.apollo.io/api/v1";

// Titles that define our ICP: fractional CMOs / senior fractional marketing
// leaders. `include_similar_titles` widens these to close variants.
export const DEFAULT_TITLES = [
  // Fractional / interim
  "Fractional CMO",
  "Fractional Chief Marketing Officer",
  "Fractional VP Marketing",
  "Fractional VP of Marketing",
  "Fractional Marketing Director",
  "Interim CMO",
  "Interim Chief Marketing Officer",
  // Senior marketing leadership
  "Chief Marketing Officer",
  "VP Marketing",
  "VP of Marketing",
  "SVP Marketing",
  "Head of Marketing",
  "Marketing Director",
  "Director of Marketing",
  // Adjacent decision-maker roles
  "Chief Growth Officer",
  "Head of Growth",
  "Chief Brand Officer",
  "Head of Brand",
  "Creative Director",
  "Senior Creative Strategist",
  "Head of Demand Generation",
  "VP Product Marketing",
  "Chief Revenue Officer",
];

export const DEFAULT_SENIORITIES = ["c_suite", "vp", "head", "director"];

function apiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error("APOLLO_API_KEY is not set. Add it to .env and restart the dev server.");
  }
  return key;
}

async function apolloPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey(),
    },
    body: JSON.stringify(body),
    // Never cache lead data.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// --- Search --------------------------------------------------------------

type ApolloSearchPerson = {
  id: string;
  first_name?: string;
  title?: string;
  has_email?: boolean;
  organization?: { name?: string } | null;
};

type ApolloSearchResponse = {
  total_entries: number;
  people: ApolloSearchPerson[];
};

export type SearchParams = {
  titles?: string[];
  seniorities?: string[];
  country: LeadCountry;
  // Free-text keyword (e.g. an industry name). Apollo matches it across the
  // person/company profile — an approximate industry narrowing, not an exact
  // taxonomy filter.
  keywords?: string;
  // Apollo company-size ranges as "min,max" strings (see COMPANY_SIZES).
  employeeRanges?: string[];
  page?: number;
  perPage?: number;
};

export async function searchPeople({
  titles = DEFAULT_TITLES,
  seniorities = DEFAULT_SENIORITIES,
  country,
  keywords,
  employeeRanges,
  page = 1,
  perPage = 25,
}: SearchParams): Promise<{ people: ApolloSearchPerson[]; totalEntries: number }> {
  const data = await apolloPost<ApolloSearchResponse>("/mixed_people/api_search", {
    person_titles: titles,
    include_similar_titles: true,
    person_seniorities: seniorities,
    person_locations: [COUNTRY_CONFIG[country].apolloLocation],
    ...(keywords ? { q_keywords: keywords } : {}),
    ...(employeeRanges?.length ? { organization_num_employees_ranges: employeeRanges } : {}),
    page,
    per_page: perPage,
  });
  return { people: data.people ?? [], totalEntries: data.total_entries ?? 0 };
}

// --- Organization enrichment --------------------------------------------
//
// Company data isn't locked down the way personal LinkedIn profiles are, so
// this is a reliable in-app way to enrich a lead from its company: pass a domain
// (or a name we resolve to a domain) and get back the company's industry,
// keywords, description, size, and location. Uses the org endpoints, which don't
// consume people-match credits.

type ApolloOrganization = {
  name?: string;
  website_url?: string;
  primary_domain?: string;
  industry?: string;
  keywords?: string[];
  estimated_num_employees?: number;
  short_description?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
};

export type OrgInfo = {
  name: string | null;
  website: string | null;
  industry: string | null; // Apollo's own industry string
  keywords: string[];
  description: string | null;
  employees: number | null;
  location: string | null;
};

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return m && m.includes(".") ? m : null;
}

// Find a company's primary domain by name (used when a lead has a company name
// but no website). Returns null if Apollo has no confident match.
async function resolveDomainByName(name: string): Promise<string | null> {
  try {
    const data = await apolloPost<{ organizations?: ApolloOrganization[] }>(
      "/organizations/search",
      { q_organization_name: name, per_page: 1 },
    );
    return data.organizations?.[0]?.primary_domain ?? null;
  } catch {
    return null;
  }
}

function normalizeOrg(o: ApolloOrganization): OrgInfo {
  return {
    name: o.name?.trim() || null,
    website: o.website_url?.trim() || (o.primary_domain ? `https://${o.primary_domain}` : null),
    industry: o.industry?.trim() || null,
    keywords: (o.keywords ?? []).filter(Boolean),
    description: o.short_description?.trim() || null,
    employees: typeof o.estimated_num_employees === "number" ? o.estimated_num_employees : null,
    location: [o.city, o.state, o.country].filter(Boolean).join(", ") || null,
  };
}

// Enrich a company by website domain and/or name. Returns null if neither
// resolves to something Apollo knows.
export async function enrichOrganization(input: {
  domain?: string | null;
  name?: string | null;
}): Promise<OrgInfo | null> {
  let domain = domainFromUrl(input.domain);
  if (!domain && input.name) domain = await resolveDomainByName(input.name);
  if (!domain) return null;

  try {
    const res = await fetch(
      `${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey(),
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { organization?: ApolloOrganization };
    return data.organization ? normalizeOrg(data.organization) : null;
  } catch {
    return null;
  }
}

// --- Enrich --------------------------------------------------------------

type ApolloEmploymentItem = {
  organization_name?: string;
  title?: string;
  start_date?: string | null;
  end_date?: string | null;
  current?: boolean;
};

export type ApolloEnrichedPerson = {
  id: string;
  name?: string;
  first_name?: string;
  title?: string;
  headline?: string;
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
  organization?: { name?: string; website_url?: string } | null;
  employment_history?: ApolloEmploymentItem[];
};

type ApolloMatchResponse = { person: ApolloEnrichedPerson | null };

// Enrich by Apollo person id (from a search result). Costs 1 credit.
// `reveal_personal_emails: false` keeps us to work-email enrichment only.
export async function enrichById(id: string): Promise<ApolloEnrichedPerson | null> {
  const data = await apolloPost<ApolloMatchResponse>("/people/match", {
    id,
    reveal_personal_emails: false,
    reveal_phone_number: false,
  });
  return data.person;
}

// Enrich by a pasted LinkedIn URL — the seed for "Similar To".
export async function enrichByLinkedin(linkedinUrl: string): Promise<ApolloEnrichedPerson | null> {
  const data = await apolloPost<ApolloMatchResponse>("/people/match", {
    linkedin_url: linkedinUrl,
    reveal_personal_emails: false,
    reveal_phone_number: false,
  });
  return data.person;
}

// --- Mapping -------------------------------------------------------------

// Comma-separates an enriched person's employer names (most useful signal for
// the warm-connection check against decision-maker profiles).
function pastEmployersFrom(person: ApolloEnrichedPerson): string | null {
  const names = (person.employment_history ?? [])
    .map((e) => e.organization_name?.trim())
    .filter((n): n is string => Boolean(n));
  // De-dupe while preserving order.
  const unique = [...new Set(names)];
  return unique.length ? unique.join(", ") : null;
}

export type ApolloLeadData = {
  apolloId: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
  email: string | null;
  personalWebsite: string | null;
  company: string | null;
  companyWebsite: string | null;
  summary: string | null;
  university: string | null;
  pastEmployers: string | null;
  country: LeadCountry;
};

// Earliest 4-digit year across an employment history, if any.
function earliestYear(person: ApolloEnrichedPerson): number | null {
  const years = (person.employment_history ?? [])
    .map((e) => e.start_date?.slice(0, 4))
    .filter((y): y is string => !!y && /^\d{4}$/.test(y))
    .map(Number);
  return years.length ? Math.min(...years) : null;
}

// A non-redundant experience nugget: career span + distinct company count,
// e.g. "~15 years of experience across 7 companies". Avoids re-listing the
// employers (those live in their own field).
function experienceNugget(person: ApolloEnrichedPerson, firstName: string): string | null {
  const companies = new Set(
    (person.employment_history ?? [])
      .map((e) => e.organization_name?.trim().toLowerCase())
      .filter(Boolean),
  );
  const start = earliestYear(person);
  const years = start ? new Date().getFullYear() - start : null;

  if (years && years >= 2 && companies.size >= 2) {
    return `${firstName} has ~${years} years of experience across ${companies.size} companies`;
  }
  if (companies.size >= 2) {
    return `${firstName} has worked across ${companies.size} companies`;
  }
  return null;
}

// Builds an icebreaker-ready summary. Leads with the person's own LinkedIn
// headline (the niche/informative bit), adds an experience nugget, then folds
// in university and email so the blurb is self-contained. Deliberately does
// NOT re-list past employers — that's a separate field.
function buildSummary(
  person: ApolloEnrichedPerson,
  opts: { title: string | null; orgName: string | null; email: string | null; university: string | null },
): string | null {
  const name = person.name?.trim() || "This person";
  const firstName = person.first_name?.trim() || name.split(" ")[0];
  const location = [person.city, person.state].map((s) => s?.trim()).filter(Boolean).join(", ");
  // Strip trailing punctuation so we don't produce "brand positioning..".
  const headline = person.headline?.trim().replace(/[.\s]+$/, "");

  const parts: string[] = [];

  // Role line with location.
  const role =
    opts.title && opts.orgName
      ? `${name} is ${opts.title} at ${opts.orgName}`
      : opts.title
        ? `${name} is ${opts.title}`
        : name;
  parts.push(location ? `${role}, based in ${location}.` : `${role}.`);

  // Their own positioning — the niche/informative part — if it adds anything
  // beyond the title we already stated.
  if (headline && headline.toLowerCase() !== (opts.title ?? "").toLowerCase()) {
    parts.push(`In their own words: “${headline}.”`);
  }

  const nugget = experienceNugget(person, firstName);
  if (nugget) parts.push(`${nugget}.`);

  if (opts.university) parts.push(`Studied at ${opts.university}.`);
  if (opts.email) parts.push(`Reachable at ${opts.email}.`);

  return parts.length ? parts.join(" ") : null;
}

// Maps an enriched Apollo person into our Lead shape. Apollo's people/match
// doesn't return education, so `university` stays null (populate via CSV/manual
// edit). `personalWebsite` isn't provided either; only the company site is.
export function enrichedToLeadData(person: ApolloEnrichedPerson): ApolloLeadData {
  const orgName = person.organization?.name?.trim() || null;
  const title = person.title?.trim() || null;
  const email = person.email_status === "unavailable" ? null : person.email?.trim() || null;
  const university = null; // Apollo match doesn't return education.
  const employers = pastEmployersFrom(person);

  return {
    apolloId: person.id,
    name: person.name?.trim() || "Unknown",
    title,
    linkedinUrl: person.linkedin_url?.trim() || null,
    email,
    personalWebsite: null,
    company: orgName,
    companyWebsite: person.organization?.website_url?.trim() || null,
    summary: buildSummary(person, { title, orgName, email, university }),
    university,
    pastEmployers: employers,
    country: countryCodeFromApollo(person.country),
  };
}
