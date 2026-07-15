"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type UploadResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/leads/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setResult(data);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileName(null);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Upload Leads</h1>
        <Link href="/leads" className="text-sm font-medium text-blue-600 hover:underline">
          View all leads &rarr;
        </Link>
      </div>

      <p className="mb-6 text-sm text-gray-600">
        Upload a CSV of manually-sourced leads. All uploaded leads are tagged
        US-based. Expected columns:{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
          name, title, linkedin_url, email, personal_website, company_website,
          summary, university, past_employers, source
        </code>
        . Only <span className="font-medium">name</span> is required.
      </p>

      <a
        href="/sample-leads.csv"
        download
        className="mb-8 inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        Download sample CSV template
      </a>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <label
          htmlFor="csv-file"
          className="mb-3 block text-sm font-medium text-gray-700"
        >
          CSV file
        </label>
        <input
          id="csv-file"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700"
        />
        {fileName && (
          <p className="mt-2 text-xs text-gray-500">Selected: {fileName}</p>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Upload CSV"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">
            Imported {result.created} lead{result.created === 1 ? "" : "s"}.
            {result.skipped > 0 && ` Skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}.`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-red-700">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          <Link href="/leads" className="mt-3 inline-block font-medium text-blue-700 hover:underline">
            View leads &rarr;
          </Link>
        </div>
      )}
    </main>
  );
}
