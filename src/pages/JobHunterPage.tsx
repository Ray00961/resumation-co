import { useMemo, useState } from "react";
import { supabase } from "../supabase";

type ResultType = "official_job" | "external_job_board" | "career_page" | "noise";

type JobResult = {
  title?: string;
  jobTitle?: string;
  company?: string;
  sourceType?: ResultType;
  type?: ResultType;
  ats?: string | null;
  url: string;
};

type SearchJobsResponse = {
  results?: JobResult[];
  jobs?: JobResult[];
  data?: JobResult[] | SearchJobsResponse;
  officialJobs?: JobResult[];
  official_jobs?: JobResult[];
  official?: JobResult[];
  externalJobs?: JobResult[];
  external_jobs?: JobResult[];
  external?: JobResult[];
  careerPages?: JobResult[];
  career_pages?: JobResult[];
  careerPagesResults?: JobResult[];
};

const INDUSTRIES = [
  "Hospitality",
  "Retail",
  "Engineering",
  "Healthcare",
  "Education",
  "Technology",
  "Finance",
  "Construction",
  "Logistics",
  "Food & Beverage",
];

const COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Lebanon",
  "Egypt",
];

const SEARCH_TIMEOUT_MS = 60000;

export default function JobHunterPage() {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const visible = results.filter((r) => getType(r) !== "noise");

    return {
      official: visible.filter((r) => getType(r) === "official_job"),
      external: visible.filter((r) => getType(r) === "external_job_board"),
      careerPages: visible.filter((r) => getType(r) === "career_page"),
    };
  }, [results]);

  function toggleCountry(country: string) {
    setCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  }

  async function handleSearch() {
    const cleanJobTitle = jobTitle.trim();

    if (!cleanJobTitle) {
      setError("Job title is required.");
      return;
    }

    if (!industry) {
      setError("Industry is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setDebugMessage("Calling search-jobs...");
    setResults([]);

    const payload = {
      jobTitle: cleanJobTitle,
      title: cleanJobTitle,
      industry,
      countries,
      country: countries[0] || null,
    };

    console.log("AI Hunter search payload:", payload);

    try {
      const response = await withTimeout(
        supabase.functions.invoke("search-jobs", {
          body: payload,
        }),
        SEARCH_TIMEOUT_MS
      );

      console.log("AI Hunter raw response:", response);

      if (response.error) {
        throw response.error;
      }

      const normalizedResults = normalizeResults(response.data as SearchJobsResponse);

      setResults(normalizedResults);
      setDebugMessage(`Search completed. ${normalizedResults.length} visible/raw results received.`);
    } catch (err: any) {
      console.error("AI Hunter search error:", err);

      const message =
        err?.message ||
        err?.context?.message ||
        "Search failed. Please check the Edge Function logs.";

      setError(message);
      setDebugMessage(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-cyan-300">Resumation AI Hunter</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Job Search Validation Screen
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Real-data prototype for testing official jobs, external jobs, and career pages
            from verified company sources.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Job Title
              </label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleSearch();
                  }
                }}
                placeholder="e.g. Waiter, Accountant, Frontend Developer"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-400"
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Searching..." : "Search Jobs"}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Optional Countries
            </label>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map((country) => {
                const active = countries.includes(country);

                return (
                  <button
                    type="button"
                    key={country}
                    onClick={() => toggleCountry(country)}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                      active
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-white/10 bg-slate-900 text-slate-300 hover:border-cyan-400"
                    }`}
                  >
                    {country}
                  </button>
                );
              })}
            </div>
          </div>

          {debugMessage && (
            <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {debugMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 space-y-8">
          <ResultSection title="🏢 Official Jobs" results={grouped.official} />
          <ResultSection title="🌐 External Jobs" results={grouped.external} />
          <ResultSection title="📄 Career Pages" results={grouped.careerPages} />
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  results,
}: {
  title: string;
  results: JobResult[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
          {results.length} results
        </span>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-500">
          No results yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result, index) => (
            <JobCard key={`${result.url}-${index}`} result={result} />
          ))}
        </div>
      )}
    </section>
  );
}

function JobCard({ result }: { result: JobResult }) {
  const title = result.jobTitle || result.title || "Untitled job";
  const type = getType(result);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h3 className="line-clamp-2 text-base font-semibold text-white">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {result.company || "Unknown company"}
        </p>
      </div>

      <div className="space-y-2 text-xs text-slate-300">
        <Info label="Source Type" value={type} />
        <Info label="ATS" value={result.ats || "Unknown"} />
        <Info label="URL" value={shortenUrl(result.url)} />
      </div>

      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        Open Job
      </a>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-20 text-slate-500">{label}:</span>
      <span className="break-all text-slate-300">{value}</span>
    </div>
  );
}

function getType(result: JobResult): ResultType {
  return result.sourceType || result.type || "noise";
}

function normalizeResults(data: SearchJobsResponse | JobResult[] | null | undefined): JobResult[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.filter(hasUrl);
  }

  if (Array.isArray(data.data)) {
    return data.data.filter(hasUrl);
  }

  if (data.data && !Array.isArray(data.data)) {
    return normalizeResults(data.data);
  }

  const flatResults = [
    ...(data.results || []),
    ...(data.jobs || []),
    ...(data.officialJobs || []),
    ...(data.official_jobs || []),
    ...(data.official || []),
    ...(data.externalJobs || []),
    ...(data.external_jobs || []),
    ...(data.external || []),
    ...(data.careerPages || []),
    ...(data.career_pages || []),
    ...(data.careerPagesResults || []),
  ];

  const uniqueByUrl = new Map<string, JobResult>();

  flatResults.filter(hasUrl).forEach((result) => {
    const type = getType(result);

    uniqueByUrl.set(result.url, {
      ...result,
      sourceType: type,
    });
  });

  return Array.from(uniqueByUrl.values());
}

function hasUrl(result: JobResult): result is JobResult {
  return Boolean(result?.url);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            `Search timed out after ${Math.round(timeoutMs / 1000)} seconds. Check Supabase Edge Function logs for search-jobs.`
          )
        );
      }, timeoutMs);
    }),
  ]);
}

function shortenUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname.slice(0, 45);
  } catch {
    return url;
  }
}
