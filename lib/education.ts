// Free, no-key education lookup, keyed on a lead's LinkedIn URL.
//
// LinkedIn public profile pages embed a JSON-LD blob (schema.org Person) whose
// `alumniOf` array lists the person's schools as structured data. We fetch the
// page and read that — exact school names, no search engine, no API key, no
// cost. This is what powers automatic education enrichment (the "Generate" flow
// and the per-lead "Find education" action).
//
// It is best-effort by nature: LinkedIn masks or omits this data for a portion
// of logged-out requests and throttles bursts, so some leads come back empty and
// can be retried or filled by hand via the inline University editor. What it
// does return is accurate, which is why we prefer it over snippet scraping.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// Normalize a stored LinkedIn URL to the canonical https .../in/<slug> form.
export function normalizeLinkedinUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/^http:/i, "https:");
  return /linkedin\.com\/in\//i.test(trimmed) ? trimmed : null;
}

// Pull school names out of a LinkedIn profile page's JSON-LD `alumniOf`.
// LinkedIn masks some entries for logged-out viewers by replacing characters
// with asterisks — we drop those and keep only fully-legible names.
export function parseSchoolsFromHtml(html: string): string[] {
  const names = [...html.matchAll(/"EducationalOrganization","name":"([^"]+)"/g)].map(
    (m) => decodeEntities(m[1]),
  );
  const clean = names.filter((n) => n && !n.includes("*"));
  // De-dupe, preserve order.
  return [...new Set(clean)];
}

export type EducationLookupResult = {
  university: string | null; // semicolon-joined schools, or null
  schools: string[];
  blocked: boolean; // true when LinkedIn returned but masked/omitted the data
};

// Fetch a lead's LinkedIn profile and extract their school(s).
export async function lookupEducation(
  linkedinUrl: string | null,
  timeoutMs = 9000,
): Promise<EducationLookupResult> {
  const url = normalizeLinkedinUrl(linkedinUrl);
  if (!url) return { university: null, schools: [], blocked: false };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (res.ok) html = await res.text();
  } catch {
    return { university: null, schools: [], blocked: false };
  } finally {
    clearTimeout(t);
  }

  const schools = parseSchoolsFromHtml(html).slice(0, 2);
  if (schools.length) {
    return { university: schools.join("; "), schools, blocked: false };
  }
  // Data present but masked → tell the caller it's worth a spaced-out retry.
  const masked = /"EducationalOrganization","name":"[^"]*\*/.test(html);
  return { university: null, schools: [], blocked: masked };
}
