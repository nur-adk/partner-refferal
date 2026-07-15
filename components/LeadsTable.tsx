"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, TITLE_CATEGORIES, categorizeTitle } from "@/lib/constants";
import { setLeadRating, toggleLeadFavorite, deleteLead } from "@/app/leads/actions";

const PAGE_SIZE = 10; // leads per page

export type LeadRow = {
  id: string;
  name: string;
  title: string | null;
  university: string | null;
  industry: string | null;
  source: string;
  country: string;
  createdAt: string;
  warmConnections: number;
  rating: string | null;
  favorite: boolean;
  isNew: boolean;
};

type SortKey = "name" | "title" | "university" | "industry" | "createdAt";
type SortDirection = "asc" | "desc";

export default function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [titleCategory, setTitleCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  // Only offer industries/title-categories that actually appear in the data.
  const availableIndustries = useMemo(
    () => INDUSTRIES.filter((i) => leads.some((l) => l.industry === i)),
    [leads],
  );
  const availableCategories = useMemo(
    () => TITLE_CATEGORIES.map((c) => c.label).filter((label) => leads.some((l) => categorizeTitle(l.title) === label)),
    [leads],
  );

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      if (favoritesOnly && !lead.favorite) return false;
      if (industry && lead.industry !== industry) return false;
      if (titleCategory && categorizeTitle(lead.title) !== titleCategory) return false;
      if (q) {
        const hit = [lead.name, lead.title, lead.university, lead.industry]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [leads, query, industry, titleCategory, favoritesOnly, sortKey, sortDirection]);

  // Pagination — split the filtered/sorted list into pages of PAGE_SIZE. Newest
  // leads sit at the top (default sort is createdAt desc).
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1); // any change to the result set jumps back to page 1
  }, [query, industry, titleCategory, favoritesOnly, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredAndSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // When actively searching, a match that's an already-seen lead (not from the
  // latest generate) gets a yellow "seen — potential match" flag.
  const searching = query.trim().length > 0;

  const selectCls =
    "rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, title, university…"
          className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectCls}>
          <option value="">All industries</option>
          {availableIndustries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select value={titleCategory} onChange={(e) => setTitleCategory(e.target.value)} className={selectCls}>
          <option value="">All roles</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={
            favoritesOnly
              ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
              : "rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          }
        >
          {favoritesOnly ? "★ Favorites" : "☆ Favorites"}
        </button>
        <p className="whitespace-nowrap text-sm text-gray-500">
          {filteredAndSorted.length} of {leads.length}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label="Name" columnKey="name" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Title" columnKey="title" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Industry" columnKey="industry" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
              <SortableHeader label="University" columnKey="university" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
              <th className="px-4 py-3 text-left font-medium text-gray-500">Review</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map((lead) => {
              const seenMatch = searching && !lead.isNew;
              return (
              <tr
                key={lead.id}
                className={
                  lead.isNew
                    ? "border-l-4 border-green-400 bg-green-50 hover:bg-green-100"
                    : seenMatch
                      ? "border-l-4 border-yellow-400 bg-yellow-50 hover:bg-yellow-100"
                      : "hover:bg-gray-50"
                }
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {lead.isNew ? (
                      <span className="inline-flex items-center rounded-full bg-green-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-900">
                        New
                      </span>
                    ) : seenMatch ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-900">
                        Seen · potential match
                      </span>
                    ) : null}
                    {lead.name}
                    {lead.warmConnections > 0 && (
                      <span
                        title={`${lead.warmConnections} warm connection${lead.warmConnections === 1 ? "" : "s"} with the outreach team`}
                        className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                      >
                        🔗 {lead.warmConnections}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{lead.title ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{lead.industry ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{lead.university ?? "—"}</td>
                <td className="px-4 py-3">
                  <LeadActions lead={lead} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
              );
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  No leads match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

// Numbered page controls (1 2 3 …) with Prev/Next, windowed so long lists stay tidy.
function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  // Show up to a window of pages around the current one.
  const WINDOW = 7;
  let start = Math.max(1, page - Math.floor(WINDOW / 2));
  const end = Math.min(totalPages, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const cell = "min-w-[2rem] rounded-md border px-2 py-1 text-sm font-medium";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${cell} border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40`}
      >
        ‹ Prev
      </button>

      {start > 1 && (
        <>
          <PageButton n={1} active={page === 1} onChange={onChange} />
          {start > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}

      {nums.map((n) => (
        <PageButton key={n} n={n} active={n === page} onChange={onChange} />
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
          <PageButton n={totalPages} active={page === totalPages} onChange={onChange} />
        </>
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`${cell} border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40`}
      >
        Next ›
      </button>
    </div>
  );
}

function PageButton({
  n,
  active,
  onChange,
}: {
  n: number;
  active: boolean;
  onChange: (p: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(n)}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "min-w-[2rem] rounded-md border border-gray-900 bg-gray-900 px-2 py-1 text-sm font-medium text-white"
          : "min-w-[2rem] rounded-md border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
      }
    >
      {n}
    </button>
  );
}

// Thumbs up/down, favorite star, and delete — all optimistic via router.refresh().
function LeadActions({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Delete ${lead.name}? This can't be undone.`)) return;
    act(() => deleteLead(lead.id));
  }

  const btn = "rounded p-1 text-base leading-none transition disabled:opacity-40";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        title="Thumbs up"
        onClick={() => act(() => setLeadRating(lead.id, "up"))}
        className={`${btn} ${lead.rating === "up" ? "bg-green-100" : "hover:bg-gray-100 grayscale"}`}
      >
        👍
      </button>
      <button
        type="button"
        disabled={isPending}
        title="Thumbs down"
        onClick={() => act(() => setLeadRating(lead.id, "down"))}
        className={`${btn} ${lead.rating === "down" ? "bg-red-100" : "hover:bg-gray-100 grayscale"}`}
      >
        👎
      </button>
      <button
        type="button"
        disabled={isPending}
        title={lead.favorite ? "Unfavorite" : "Favorite"}
        onClick={() => act(() => toggleLeadFavorite(lead.id))}
        className={`${btn} ${lead.favorite ? "" : "hover:bg-gray-100 grayscale"}`}
      >
        {lead.favorite ? "⭐" : "☆"}
      </button>
      <button
        type="button"
        disabled={isPending}
        title="Delete lead"
        onClick={onDelete}
        className={`${btn} hover:bg-red-50`}
      >
        🗑️
      </button>
    </div>
  );
}

function SortableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === columnKey;
  return (
    <th className="px-4 py-3 text-left font-medium text-gray-500">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="flex items-center gap-1 hover:text-gray-900"
      >
        {label}
        <span className="text-gray-400">
          {isActive ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
