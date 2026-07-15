"use client";

import { useState, useTransition } from "react";
import { updateLeadSummary } from "@/app/leads/actions";

export default function EditableSummary({
  leadId,
  initialSummary,
}: {
  leadId: string;
  initialSummary: string | null;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialSummary ?? "");
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setDraft(summary ?? "");
    setIsEditing(true);
  }

  function cancel() {
    setIsEditing(false);
  }

  function save() {
    startTransition(async () => {
      const result = await updateLeadSummary(leadId, draft);
      setSummary(result.summary);
      setIsEditing(false);
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500">Summary</h2>
        {!isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            autoFocus
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
            placeholder="Write a paragraph summary (background, experience, icebreaker material)…"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-gray-800">
          {summary ?? "No summary yet."}
        </p>
      )}
    </div>
  );
}
