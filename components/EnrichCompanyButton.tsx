"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrichMissingCompanies } from "@/app/leads/actions";

// Bulk company enrichment for leads missing an industry. Uses Apollo's org
// endpoints (credit-free) to fill industry + company context from each lead's
// company. Best-effort: self-employed/consultancy names may not resolve.
export default function EnrichCompanyButton({ missingCount }: { missingCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (missingCount === 0) return null;

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await enrichMissingCompanies();
      setMsg(`Enriched ${r.filled} of ${r.attempted} from their company.`);
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
        title="Look up each lead's company via Apollo to fill industry — credit-free"
      >
        {isPending ? "Enriching companies…" : `Enrich from company (${missingCount})`}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
