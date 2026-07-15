// Warm-connection detection: given a lead and the outreach team's decision-maker
// profiles, find shared universities and overlapping employers. Pure functions,
// no I/O — cheap enough to run on every lead render (no API cost).

export type EducationEntry = { school: string; degree?: string; years?: string };
export type EmployerEntry = { company: string; title?: string; years?: string };

export type DecisionMakerProfile = {
  name: string;
  education: EducationEntry[];
  pastEmployers: EmployerEntry[];
};

// What a lead exposes for matching. `university` is a single field (CSV/Apollo);
// `pastEmployers` is the comma-separated string stored on the Lead model.
export type LeadMatchInput = {
  university: string | null;
  pastEmployers: string | null;
};

export type WarmConnection = {
  decisionMaker: string;
  type: "university" | "employer";
  // Human-readable, ready to drop onto the record, e.g.
  // "Both attended University of Chicago (Hugh: 2012–2014)".
  label: string;
};

// Corporate/edu suffixes and filler that shouldn't affect a match.
const NOISE_WORDS = new Set([
  "inc", "llc", "ltd", "corp", "corporation", "co", "company", "group", "the",
]);

// Generic employer names that would produce meaningless overlaps.
const GENERIC_EMPLOYERS = new Set(["freelance", "self employed", "self-employed"]);

function canonicalTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NOISE_WORDS.has(w));
}

function isSubset(sub: string[], sup: string[]): boolean {
  const set = new Set(sup);
  return sub.every((w) => set.has(w));
}

// Small connecting words dropped when forming an acronym: "University of
// California Los Angeles" -> UCLA (not UOCLA).
const ACRONYM_STOPWORDS = new Set(["of", "and", "at", "for", "in", "de", "la"]);

// The acronym of a multi-word name, e.g. ["university","california","los",
// "angeles"] -> "ucla". Returns "" for single-token names.
function acronymOf(tokens: string[]): string {
  const significant = tokens.filter((t) => !ACRONYM_STOPWORDS.has(t));
  if (significant.length < 2) return "";
  return significant.map((t) => t[0]).join("");
}

// Two names refer to the same org/school if their canonical token sets are
// equal, or one (with >= 2 meaningful tokens) is a subset of the other. The
// 2-token floor stops single generic words (e.g. "chicago") from over-matching.
function namesMatch(a: string, b: string): boolean {
  const ta = canonicalTokens(a);
  const tb = canonicalTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;

  const keyA = ta.join(" ");
  const keyB = tb.join(" ");
  if (keyA === keyB) return true;

  if (ta.length >= 2 && isSubset(ta, tb)) return true;
  if (tb.length >= 2 && isSubset(tb, ta)) return true;

  // Acronym bridge: one side is a single short token (e.g. "UCLA") equal to the
  // other side's acronym ("University of California Los Angeles" -> UCLA). Guard
  // with length >= 3 so two-letter acronyms don't over-match.
  if (ta.length === 1 && ta[0].length >= 3 && ta[0] === acronymOf(tb)) return true;
  if (tb.length === 1 && tb[0].length >= 3 && tb[0] === acronymOf(ta)) return true;
  return false;
}

function splitEmployers(pastEmployers: string | null): string[] {
  if (!pastEmployers) return [];
  return pastEmployers
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !GENERIC_EMPLOYERS.has(s.toLowerCase()));
}

// A lead may have attended several schools. We store them semicolon-separated
// (";") rather than comma, because school names contain commas themselves
// (e.g. "University of California, Los Angeles").
function splitUniversities(university: string | null): string[] {
  if (!university) return [];
  return university
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function withYears(name: string, dmName: string, years?: string): string {
  return years ? `${name} (${dmName}: ${years})` : name;
}

// Find every warm connection between a lead and one decision-maker.
function connectionsForDecisionMaker(
  lead: LeadMatchInput,
  dm: DecisionMakerProfile,
): WarmConnection[] {
  const found: WarmConnection[] = [];

  // Shared university (a lead may list several schools).
  const leadSchools = splitUniversities(lead.university);
  const seenSchool = new Set<string>();
  outer: for (const leadSchool of leadSchools) {
    for (const edu of dm.education) {
      if (namesMatch(leadSchool, edu.school) && !seenSchool.has(edu.school.toLowerCase())) {
        seenSchool.add(edu.school.toLowerCase());
        found.push({
          decisionMaker: dm.name,
          type: "university",
          label: `Both attended ${withYears(edu.school, dm.name, edu.years)}`,
        });
        break outer; // one university hit per DM is enough
      }
    }
  }

  // Overlapping employers.
  const leadEmployers = splitEmployers(lead.pastEmployers);
  const seen = new Set<string>();
  for (const leadCo of leadEmployers) {
    for (const emp of dm.pastEmployers) {
      if (namesMatch(leadCo, emp.company) && !seen.has(emp.company.toLowerCase())) {
        seen.add(emp.company.toLowerCase());
        found.push({
          decisionMaker: dm.name,
          type: "employer",
          label: `Both worked at ${withYears(emp.company, dm.name, emp.years)}`,
        });
      }
    }
  }

  return found;
}

// Find warm connections between one lead and all decision-makers.
export function findWarmConnections(
  lead: LeadMatchInput,
  decisionMakers: DecisionMakerProfile[],
): WarmConnection[] {
  return decisionMakers.flatMap((dm) => connectionsForDecisionMaker(lead, dm));
}

// Parse a DecisionMaker DB row (education/pastEmployers stored as JSON strings)
// into a typed profile, tolerating null/legacy-empty values.
export function parseDecisionMaker(row: {
  name: string;
  education: string | null;
  pastEmployers: string | null;
}): DecisionMakerProfile {
  const parse = <T>(raw: string | null): T[] => {
    if (!raw) return [];
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? (value as T[]) : [];
    } catch {
      return [];
    }
  };
  return {
    name: row.name,
    education: parse<EducationEntry>(row.education),
    pastEmployers: parse<EmployerEntry>(row.pastEmployers),
  };
}
