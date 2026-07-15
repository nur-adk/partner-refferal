"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLeadsSeen } from "@/app/leads/actions";

// Clears the "new" highlight from the latest search batch.
export default function MarkSeenButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markLeadsSeen();
          router.refresh();
        })
      }
      className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
    >
      {isPending ? "Clearing…" : "Mark as seen"}
    </button>
  );
}
