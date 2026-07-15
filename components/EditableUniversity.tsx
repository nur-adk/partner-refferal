"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadUniversity, enrichLeadEducation } from "@/app/leads/actions";

// Inline editor for a lead's university. Apollo doesn't return education, so
// this is how a lead gets one — which is what lights up university-based warm
// connections against the outreach team. We refresh the route on save so the
// Warm Connections section recomputes immediately.
export default function EditableUniversity({
  leadId,
  initialUniversity,
}: {
  leadId: string;
  initialUniversity: string | null;
}) {
  const router = useRouter();
  const [university, setUniversity] = useState(initialUniversity);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialUniversity ?? "");
  const [isPending, startTransition] = useTransition();
  const [finding, setFinding] = useState(false);
  const [findMsg, setFindMsg] = useState<string | null>(null);

  function startEditing() {
    setDraft(university ?? "");
    setIsEditing(true);
  }

  // Free LinkedIn-based lookup — fills the field automatically when found.
  function findEducation() {
    setFindMsg(null);
    startTransition(async () => {
      setFinding(true);
      try {
        const result = await enrichLeadEducation(leadId);
        if (result.university) {
          setUniversity(result.university);
          router.refresh(); // recompute Warm Connections
        } else if (result.blocked) {
          setFindMsg("LinkedIn hid this one — try again in a bit, or add it manually.");
        } else {
          setFindMsg("No education found on LinkedIn — add it manually.");
        }
      } finally {
        setFinding(false);
      }
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateLeadUniversity(leadId, draft);
      setUniversity(result.university);
      setIsEditing(false);
      // Recompute Warm Connections (server component) with the new university.
      router.refresh();
    });
  }

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
        University
      </dt>
      {isEditing ? (
        <div className="mt-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            placeholder="e.g. University of Chicago"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
          />
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
            <span>{university ?? "—"}</span>
            <button
              type="button"
              onClick={startEditing}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {university ? "Edit" : "Add"}
            </button>
            {!university && (
              <button
                type="button"
                onClick={findEducation}
                disabled={finding}
                className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                {finding ? "Searching LinkedIn…" : "Find on LinkedIn"}
              </button>
            )}
          </div>
          {findMsg && <p className="mt-1 text-xs text-gray-500">{findMsg}</p>}
        </dd>
      )}
    </div>
  );
}
