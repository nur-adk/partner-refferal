"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadIndustry, enrichLeadCompany } from "@/app/leads/actions";
import { INDUSTRIES } from "@/lib/constants";

// Inline industry picker for a lead. Backed by the curated INDUSTRIES list (via
// a datalist) but free-text, so an unlisted vertical can still be typed in.
export default function EditableIndustry({
  leadId,
  initialIndustry,
}: {
  leadId: string;
  initialIndustry: string | null;
}) {
  const router = useRouter();
  const [industry, setIndustry] = useState(initialIndustry);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialIndustry ?? "");
  const [isPending, startTransition] = useTransition();
  const [findMsg, setFindMsg] = useState<string | null>(null);

  // Look up the lead's company via Apollo (credit-free) to fill industry.
  function findFromCompany() {
    setFindMsg(null);
    startTransition(async () => {
      const r = await enrichLeadCompany(leadId);
      if (r.filled && r.industry) {
        setIndustry(r.industry);
        router.refresh();
      } else {
        setFindMsg("Apollo couldn't resolve this company — add it manually.");
      }
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateLeadIndustry(leadId, draft);
      setIndustry(result.industry);
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Industry</dt>
      {isEditing ? (
        <div className="mt-1">
          <input
            list="industry-options"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            placeholder="e.g. Luxury Hospitality"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
          />
          <datalist id="industry-options">
            {INDUSTRIES.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dd className="mt-1 text-sm text-gray-800">
          <div className="flex items-center gap-2">
            <span>{industry ?? "—"}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(industry ?? "");
                setIsEditing(true);
              }}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {industry ? "Edit" : "Add"}
            </button>
            {!industry && (
              <button
                type="button"
                onClick={findFromCompany}
                disabled={isPending}
                className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                {isPending ? "Looking up company…" : "Find from company"}
              </button>
            )}
          </div>
          {findMsg && <p className="mt-1 text-xs text-gray-500">{findMsg}</p>}
        </dd>
      )}
    </div>
  );
}
