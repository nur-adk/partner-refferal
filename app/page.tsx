import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [leadCount, decisionMakerCount] = await Promise.all([
    prisma.lead.count(),
    prisma.decisionMaker.count(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
        Partner Referral Lead Sourcing
      </h1>
      <p className="mt-2 text-gray-600">
        Internal tool for finding fractional CMOs and senior fractional
        marketing leaders as partner referral prospects.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-2xl font-semibold text-gray-900">{leadCount}</p>
          <p className="text-sm text-gray-500">Leads sourced</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-2xl font-semibold text-gray-900">{decisionMakerCount}</p>
          <p className="text-sm text-gray-500">Decision-maker profiles</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/leads"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          View leads
        </Link>
        <Link
          href="/upload"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Upload CSV
        </Link>
      </div>
    </main>
  );
}
