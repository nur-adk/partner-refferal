"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateLeads, generateSimilarLeads, type GenerateResult } from "@/app/leads/actions";
import {
  ENABLED_SEARCH_COUNTRIES,
  LEAD_COUNTRIES,
  COUNTRY_CONFIG,
  INDUSTRIES,
  TITLE_CATEGORIES,
  COMPANY_SIZES,
  type LeadCountry,
} from "@/lib/constants";

const SIMILAR_BATCH = 3; // "3 More Similar"

function resultMessage(r: GenerateResult, prefix: string): string {
  if (!r.ok) return r.error ?? "Something went wrong.";
  const parts = [`${prefix}: added ${r.created ?? 0} new lead${r.created === 1 ? "" : "s"}`];
  if (r.duplicates) parts.push(`${r.duplicates} already in the list`);
  if (typeof r.searchMatches === "number") parts.push(`${r.searchMatches.toLocaleString()} total matches in Apollo`);
  return parts.join(" · ");
}

export default function GeneratePanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [country, setCountry] = useState<LeadCountry>(ENABLED_SEARCH_COUNTRIES[0] ?? "US");
  const [roles, setRoles] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [count, setCount] = useState(3);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Search page cursor — advances each Generate so we keep pulling new people.
  const [page, setPage] = useState(1);
  // Reset to page 1 whenever the search criteria change.
  useEffect(() => {
    setPage(1);
  }, [country, roles, industry, keyword, sizes, count]);

  function toggleRole(label: string) {
    setRoles((prev) => (prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]));
  }
  function toggleSize(range: string) {
    setSizes((prev) => (prev.includes(range) ? prev.filter((s) => s !== range) : [...prev, range]));
  }

  // "Similar To" state
  const [seedUrl, setSeedUrl] = useState("");
  const [activeSeed, setActiveSeed] = useState<string | null>(null); // seed a result set is currently based on
  const [seedPage, setSeedPage] = useState(1);

  function runGenerate() {
    setStatus(null);
    startTransition(async () => {
      const r = await generateLeads({
        country,
        count,
        roles: roles.length ? roles : undefined,
        industry: industry || undefined,
        keywords: keyword.trim() || undefined,
        companySizes: sizes.length ? sizes : undefined,
        page,
      });
      if (r.ok) {
        // Resume past the pages this run consumed, so repeated Generates keep
        // pulling people we don't already have.
        if (r.nextPage) setPage(r.nextPage);
        const text =
          r.created === 0 && !r.pageHadResults
            ? r.searchMatches === 0
              ? "Apollo has nobody matching this combination — the filters are too narrow. Try removing the industry or picking a broader role."
              : `No more new people here — you already have everyone Apollo lists for these filters (${(r.searchMatches ?? 0).toLocaleString()} total). Widen role, industry, size or keyword to keep going.`
            : resultMessage(r, "Generate");
        setStatus({ kind: "ok", text });
        router.refresh();
      } else {
        setStatus({ kind: "err", text: resultMessage(r, "Generate") });
      }
    });
  }

  function runSimilar(page: number) {
    setStatus(null);
    startTransition(async () => {
      const r = await generateSimilarLeads({ linkedinUrl: seedUrl, count: SIMILAR_BATCH, page });
      const label = r.ok && r.seedName ? `Similar to ${r.seedName}` : "Similar";
      setStatus({ kind: r.ok ? "ok" : "err", text: resultMessage(r, label) });
      if (r.ok) {
        setActiveSeed(seedUrl.trim());
        setSeedPage(page);
        router.refresh();
      }
    });
  }

  const canExpand = activeSeed !== null && activeSeed === seedUrl.trim();

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      {/* Generate row */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">Region</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as LeadCountry)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {LEAD_COUNTRIES.map((code) => {
              const enabled = ENABLED_SEARCH_COUNTRIES.includes(code);
              return (
                <option key={code} value={code} disabled={!enabled}>
                  {COUNTRY_CONFIG[code].label}
                  {enabled ? "" : " (coming soon)"}
                </option>
              );
            })}
          </select>
        </div>

        <div className="relative">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">Role</label>
          <details className="group mt-1">
            <summary className="flex w-48 cursor-pointer list-none items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <span className="truncate">
                {roles.length === 0
                  ? "All marketing leaders"
                  : roles.length === 1
                    ? roles[0]
                    : `${roles.length} roles selected`}
              </span>
              <span className="ml-2 text-gray-400 group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
              {roles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRoles([])}
                  className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-blue-600 hover:bg-gray-50"
                >
                  Clear ({roles.length})
                </button>
              )}
              {TITLE_CATEGORIES.map((c) => (
                <label
                  key={c.label}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(c.label)}
                    onChange={() => toggleRole(c.label)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </details>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">Industry</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">Any industry</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">Company size</label>
          <details className="group mt-1">
            <summary className="flex w-44 cursor-pointer list-none items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <span className="truncate">
                {sizes.length === 0
                  ? "Any size"
                  : sizes.length === 1
                    ? COMPANY_SIZES.find((s) => s.range === sizes[0])?.label
                    : `${sizes.length} sizes`}
              </span>
              <span className="ml-2 text-gray-400 group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
              {sizes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSizes([])}
                  className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-blue-600 hover:bg-gray-50"
                >
                  Clear ({sizes.length})
                </button>
              )}
              {COMPANY_SIZES.map((s) => (
                <label
                  key={s.range}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={sizes.includes(s.range)}
                    onChange={() => toggleSize(s.range)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </details>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">Keyword</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. SaaS, B2B, AI"
            className="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">How many</label>
          <input
            type="number"
            min={1}
            max={25}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={runGenerate}
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Working…" : page > 1 ? `Generate — page ${page}` : "Generate"}
        </button>

        {page > 1 && (
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            title="Start over from page 1"
          >
            ↺ Page 1
          </button>
        )}

        <p className="max-w-xs text-xs text-gray-400">
          Region, role, industry, size &amp; keyword filter Apollo. Each Generate pulls the
          next page, skipping people already in your list. ~1 credit per new lead.
        </p>
      </div>

      <hr className="my-4 border-gray-100" />

      {/* Similar To row */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">
          Find similar to a LinkedIn profile
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <input
            type="url"
            value={seedUrl}
            onChange={(e) => setSeedUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/…"
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => runSimilar(1)}
            disabled={isPending || !seedUrl.trim()}
            className="rounded-md border border-gray-900 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50"
          >
            Similar To
          </button>
          <button
            type="button"
            onClick={() => runSimilar(seedPage + 1)}
            disabled={isPending || !canExpand}
            title={canExpand ? "" : "Run “Similar To” first"}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            3 More Similar
          </button>
        </div>
      </div>

      {status && (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
