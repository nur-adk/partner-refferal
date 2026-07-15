import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { LEAD_SOURCES } from "@/lib/constants";

type CsvRow = Record<string, string>;

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Column names vary between exports (e.g. "Current Title" vs "title",
// "Fit Summary" vs "summary"), so accept a set of aliases per field and take
// the first that has a value.
function pick(row: CsvRow, ...aliases: string[]): string | null {
  for (const a of aliases) {
    const v = clean(row[a]);
    if (v) return v;
  }
  return null;
}

// Canonical dedupe key: LinkedIn profile slug if present, else the name.
function dedupeKey(linkedinUrl: string | null, name: string): string {
  const slug = linkedinUrl?.toLowerCase().match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  return slug ? `li:${slug}` : `name:${name.trim().toLowerCase()}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No CSV file was provided." }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { error: `Failed to parse CSV: ${parsed.errors[0].message}` },
      { status: 400 },
    );
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV file has no data rows." }, { status: 400 });
  }

  type LeadInput = {
    name: string;
    title: string | null;
    linkedinUrl: string | null;
    email: string | null;
    personalWebsite: string | null;
    companyWebsite: string | null;
    summary: string | null;
    university: string | null;
    pastEmployers: string | null;
    source: (typeof LEAD_SOURCES)[number];
    country: string;
  };

  const errors: string[] = [];
  const toCreate: LeadInput[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // account for header row + 1-indexing
    const name = pick(row, "name", "full_name");
    if (!name) {
      errors.push(`Row ${rowNumber}: missing required "name" field — skipped.`);
      return;
    }

    const rawSource = pick(row, "source")?.toLowerCase().replace(/[\s-]+/g, "_");
    const source = LEAD_SOURCES.includes(rawSource as (typeof LEAD_SOURCES)[number])
      ? (rawSource as (typeof LEAD_SOURCES)[number])
      : "manual";

    toCreate.push({
      name,
      title: pick(row, "title", "current_title"),
      linkedinUrl: pick(row, "linkedin_url", "linkedin"),
      email: pick(row, "email"),
      personalWebsite: pick(row, "personal_website"),
      companyWebsite: pick(row, "company_website"),
      summary: pick(row, "summary", "fit_summary"),
      university: pick(row, "university", "education"),
      pastEmployers: pick(row, "past_employers"),
      source,
      // US-only for now; CSV import doesn't yet accept a country column.
      country: "US",
    });
  });

  // Dedupe against what's already stored (and within the file itself): a row
  // that matches an existing lead by LinkedIn slug or name updates that record's
  // still-empty fields instead of inserting a second copy.
  const existing = await prisma.lead.findMany({
    select: { id: true, name: true, linkedinUrl: true },
  });
  const existingByKey = new Map(existing.map((l) => [dedupeKey(l.linkedinUrl, l.name), l.id]));

  let created = 0;
  let updated = 0;
  const seenInFile = new Set<string>();

  for (const lead of toCreate) {
    const key = dedupeKey(lead.linkedinUrl, lead.name);
    if (seenInFile.has(key)) continue; // duplicate rows within the same file
    seenInFile.add(key);

    const existingId = existingByKey.get(key);
    if (existingId) {
      // Re-import updates in place: a CSV value overwrites, but a blank CSV
      // cell (undefined) leaves the stored value — so app-curated fields like
      // university survive a re-upload that doesn't include that column.
      await prisma.lead.update({
        where: { id: existingId },
        data: {
          title: lead.title ?? undefined,
          summary: lead.summary ?? undefined,
          university: lead.university ?? undefined,
          email: lead.email ?? undefined,
          linkedinUrl: lead.linkedinUrl ?? undefined,
          personalWebsite: lead.personalWebsite ?? undefined,
          companyWebsite: lead.companyWebsite ?? undefined,
          pastEmployers: lead.pastEmployers ?? undefined,
        },
      });
      updated++;
    } else {
      const row = await prisma.lead.create({ data: lead });
      existingByKey.set(key, row.id);
      created++;
    }
  }

  return NextResponse.json({
    created,
    updated,
    skipped: errors.length,
    errors,
  });
}
