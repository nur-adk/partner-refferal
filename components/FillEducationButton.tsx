"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrichMissingEducation } from "@/app/leads/actions";

// Bulk, one-click free education enrichment for every lead still missing it.
// Pulls from LinkedIn profiles (no key, no cost); best-effort since LinkedIn
// throttles bursts, so it reports how many filled vs. still empty.
export default function FillEducationButton({ missingCount }: { missingCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (missingCount === 0) return null;

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await enrichMissingEducation();
      const parts = [`Filled ${r.filled} of ${r.attempted}.`];
      if (r.blocked > 0) parts.push(`${r.blocked} hidden by LinkedIn — retry later.`);
      setMsg(parts.join(" "));
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        title="Look up education from each lead's LinkedIn profile — free, no API key"
      >
        {isPending ? "Finding education…" : `Fill missing education (${missingCount})`}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
