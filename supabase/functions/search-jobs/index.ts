import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  ats_type: string | null;
  industry: string | null;
  country: string | null;
  career_page_url_verified: string | null;
  career_platform: string | null;
  career_page_type: string | null;
  career_url_confidence: number | null;
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
  age?: string;
};

type QueryCandidate = {
  query: string;
  priority: number;
  strategy: string;
};

type SourceType =
  | "official_job"
  | "external_job_board"
  | "career_page"
  | "noise";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeUrl(value: string): string {
  const raw = clean(value);
  if (!raw) return "";

  try {
    const withProtocol =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `https://${raw}`;

    const url = new URL(withProtocol);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function hostnameOf(value: string): string {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return normalized
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

function siteTargetFromUrl(value: string): string {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    return `${url.hostname.replace(/^www\./i, "")}${url.pathname}`
      .replace(/\/$/, "")
      .toLowerCase();
  } catch {
    return hostnameOf(value);
  }
}

function words(value: string): string[] {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function cleanCompanyName(name: string): string {
  return clean(name)
    .replace(/^Www\s+/i, "")
    .replace(/\.(Wd\d|Myworkdayjobs|Taleo|Recruitee|Zohorecruit|Com|Net|Org)$/gi, "")
    .replace(/\b(Wd\d|Myworkdayjobs|Taleo|Recruitee|Zohorecruit|Oraclecloud|Careerspage)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function platformPriority(company: CompanyRow): number {
  const platform = clean(company.career_platform || company.ats_type);

  const atsPriority: Record<string, number> = {
    Workday: 100,
    SmartRecruiters: 98,
    OracleRecruiting: 96,
    Taleo: 94,
    iCIMS: 92,
    SuccessFactors: 90,
    CareersPage: 88,
    Greenhouse: 86,
    Lever: 84,
    Workable: 82,
    ZohoRecruit: 80,
    Talentera: 78,
    Recruitee: 76,
    BambooHR: 74,
    JobBoard: 70,
    Custom: 50,
  };

  return atsPriority[platform] ?? 50;
}

function addQuery(list: QueryCandidate[], query: string, priority: number, strategy: string) {
  const q = clean(query);
  if (!q) return;
  list.push({ query: q, priority, strategy });
}

function buildBrandQueries(companyName: string, jobTitle: string): QueryCandidate[] {
  const q: QueryCandidate[] = [];
  if (!companyName) return q;

  addQuery(q, `"${companyName}" "${jobTitle}"`, 100, "brand_exact");
  addQuery(q, `"${companyName}" jobs "${jobTitle}"`, 96, "brand_jobs");
  addQuery(q, `"${companyName}" careers "${jobTitle}"`, 94, "brand_careers");
  addQuery(q, `${companyName} ${jobTitle} jobs`, 88, "brand_unquoted_jobs");

  return q;
}

function buildATSQueries(company: CompanyRow, companyName: string, jobTitle: string): QueryCandidate[] {
  const q: QueryCandidate[] = [];
  const platform = clean(company.career_platform || company.ats_type);
  const verifiedUrl = clean(company.career_page_url_verified);
  const host = verifiedUrl ? hostnameOf(verifiedUrl) : "";
  const siteTarget = verifiedUrl ? siteTargetFromUrl(verifiedUrl) : "";

  if (platform === "SmartRecruiters") {
    addQuery(q, `site:careers.smartrecruiters.com "${companyName}" "${jobTitle}"`, 98, "smartrecruiters_careers_brand");
    addQuery(q, `site:jobs.smartrecruiters.com "${companyName}" "${jobTitle}"`, 98, "smartrecruiters_jobs_brand");
    addQuery(q, `site:careers.smartrecruiters.com ${companyName} ${jobTitle}`, 90, "smartrecruiters_loose");
  }

  if (platform === "CareersPage") {
    if (siteTarget.includes("careers-page.com")) {
      addQuery(q, `site:${siteTarget} "${jobTitle}"`, 98, "careers_page_site_exact");
      addQuery(q, `site:${siteTarget} ${jobTitle}`, 90, "careers_page_site_loose");
    }
    addQuery(q, `site:careers-page.com "${companyName}" "${jobTitle}"`, 92, "careers_page_brand");
  }

  if (platform === "Workday") {
    if (host) {
      addQuery(q, `site:${host} "${jobTitle}"`, 96, "workday_host_exact");
      addQuery(q, `site:${host} ${jobTitle}`, 88, "workday_host_loose");
    }
    addQuery(q, `"${companyName}" "myworkdayjobs" "${jobTitle}"`, 92, "workday_brand");
  }

  if (platform === "Taleo") {
    if (host) {
      addQuery(q, `site:${host} "${jobTitle}"`, 96, "taleo_host_exact");
      addQuery(q, `site:${host} ${jobTitle}`, 88, "taleo_host_loose");
    }
    addQuery(q, `"${companyName}" "taleo" "${jobTitle}"`, 90, "taleo_brand");
  }

  if (platform === "OracleRecruiting") {
    if (host) {
      addQuery(q, `site:${host} "${jobTitle}"`, 96, "oracle_host_exact");
      addQuery(q, `site:${host} ${jobTitle}`, 88, "oracle_host_loose");
    }
    addQuery(q, `"${companyName}" "oraclecloud" "${jobTitle}"`, 90, "oracle_brand");
  }

  if (["iCIMS", "SuccessFactors", "Greenhouse", "Lever", "Workable", "Recruitee", "ZohoRecruit", "Talentera", "BambooHR"].includes(platform)) {
    if (host) {
      addQuery(q, `site:${host} "${jobTitle}"`, 94, "ats_host_exact");
      addQuery(q, `site:${host} ${jobTitle}`, 86, "ats_host_loose");
    }
    addQuery(q, `"${companyName}" "${platform}" "${jobTitle}"`, 88, "ats_brand");
  }

  return q;
}

function buildDomainQueries(company: CompanyRow, jobTitle: string): QueryCandidate[] {
  const q: QueryCandidate[] = [];
  const domainHost = company.domain ? hostnameOf(company.domain) : "";
  const verifiedUrl = clean(company.career_page_url_verified);
  const host = verifiedUrl ? hostnameOf(verifiedUrl) : "";

  if (domainHost) {
    addQuery(q, `site:${domainHost} "${jobTitle}"`, 82, "domain_exact");
    addQuery(q, `site:${domainHost} jobs "${jobTitle}"`, 78, "domain_jobs");
    addQuery(q, `site:${domainHost} careers "${jobTitle}"`, 76, "domain_careers");
  }

  if (
    host &&
    (host.startsWith("jobs.") ||
      host.startsWith("careers.") ||
      host.startsWith("career.") ||
      host.endsWith(".jobs"))
  ) {
    addQuery(q, `site:${host} "${jobTitle}"`, 90, "strong_job_host_exact");
    addQuery(q, `site:${host} ${jobTitle}`, 84, "strong_job_host_loose");
  }

  return q;
}

function buildCareerPortalQueries(company: CompanyRow, jobTitle: string): QueryCandidate[] {
  const q: QueryCandidate[] = [];
  const verifiedUrl = clean(company.career_page_url_verified);
  const siteTarget = verifiedUrl ? siteTargetFromUrl(verifiedUrl) : "";
  const careerPageType = clean(company.career_page_type);

  if (siteTarget && careerPageType === "career_portal") {
    addQuery(q, `site:${siteTarget} "${jobTitle}"`, 72, "career_portal_exact");
    addQuery(q, `site:${siteTarget} ${jobTitle}`, 68, "career_portal_loose");
  }

  return q;
}

function mergeRankedQueries(groups: QueryCandidate[], limit: number): QueryCandidate[] {
  const seen = new Set<string>();

  return groups
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const key = item.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function buildQueries(company: CompanyRow, jobTitle: string): QueryCandidate[] {
  const companyName = cleanCompanyName(company.name);

  const candidates = [
    ...buildBrandQueries(companyName, jobTitle),
    ...buildATSQueries(company, companyName, jobTitle),
    ...buildDomainQueries(company, jobTitle),
    ...buildCareerPortalQueries(company, jobTitle),
  ];

  return mergeRankedQueries(candidates, 10);
}

function getResultHostname(link: string): string {
  return hostnameOf(link);
}

function isSameOrSubdomain(host: string, expected: string): boolean {
  const h = host.replace(/^www\./i, "").toLowerCase();
  const e = expected.replace(/^www\./i, "").toLowerCase();

  return h === e || h.endsWith(`.${e}`) || e.endsWith(`.${h}`);
}

function getOfficialHosts(company: CompanyRow): string[] {
  const hosts = new Set<string>();

  if (company.domain) {
    const domainHost = hostnameOf(company.domain);
    if (domainHost) hosts.add(domainHost);
  }

  if (company.career_page_url_verified) {
    const careerHost = hostnameOf(company.career_page_url_verified);
    if (careerHost) hosts.add(careerHost);
  }

  return Array.from(hosts);
}

function classifySourceType(result: BraveResult, company: CompanyRow): {
  sourceType: SourceType;
  sourceTrust: number;
  resultDomain: string;
  isOfficialSource: boolean;
} {
  const title = clean(result.title).toLowerCase();
  const link = clean(result.url);
  const snippet = clean(result.description).toLowerCase();
  const resultDomain = getResultHostname(link);
  const fullText = `${title} ${link.toLowerCase()} ${snippet}`;

  const officialHosts = getOfficialHosts(company);
  const isOfficialSource = officialHosts.some((host) =>
    isSameOrSubdomain(resultDomain, host)
  );

  const externalJobBoards = [
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
    "ziprecruiter.com",
    "talent.com",
    "talentify.io",
    "bebee.com",
    "basecareer.co",
    "bayt.com",
    "gulftalent.com",
    "naukrigulf.com",
    "jobzella.com",
    "monstergulf.com",
  ];

  const noiseDomains = [
    "reddit.com",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "quora.com",
    "medium.com",
    "wikipedia.org",
    "salary.com",
    "payscale.com",
    "loyaltylobby.com",
  ];

  const noiseTextSignals = [
    "privacy policy",
    "terms of use",
    "cookie policy",
    "help center",
    "support center",
    "customer service",
    "salary",
    "salaries",
    "hourly rate",
    "blog",
    "forum",
    "reddit",
    "news",
    "article",
    "review",
    "reviews",
    "employee review",
    "company review",
    "glassdoor review",
    "what is",
    "career guide",
    "how to become",
    "salary guide",
    "housekeeping policy",
    "service information",
  ];

  const externalJobKeywords = [
    "job",
    "jobs",
    "vacancy",
    "vacancies",
    "hiring",
    "apply",
    "position",
    "positions",
    "opening",
    "openings",
    "employment",
  ];

  if (
    noiseDomains.some((domain) => isSameOrSubdomain(resultDomain, domain)) ||
    noiseTextSignals.some((signal) => fullText.includes(signal))
  ) {
    return {
      sourceType: "noise",
      sourceTrust: 0,
      resultDomain,
      isOfficialSource,
    };
  }

  if (isOfficialSource) {
    const careerPageSignals = [
      "search jobs",
      "job search",
      "search results",
      "career portal",
      "careers at",
      "open positions",
      "current openings",
      "available jobs",
      "find your next job",
      "explore opportunities",
    ];

    if (careerPageSignals.some((signal) => fullText.includes(signal))) {
      return {
        sourceType: "career_page",
        sourceTrust: 60,
        resultDomain,
        isOfficialSource,
      };
    }

    return {
      sourceType: "official_job",
      sourceTrust: 100,
      resultDomain,
      isOfficialSource,
    };
  }

  const isExternalBoard = externalJobBoards.some((domain) =>
    isSameOrSubdomain(resultDomain, domain)
  );

  if (isExternalBoard) {
    const hasJobKeyword = externalJobKeywords.some((k) =>
      fullText.includes(k)
    );

    if (!hasJobKeyword) {
      return {
        sourceType: "noise",
        sourceTrust: 0,
        resultDomain,
        isOfficialSource: false,
      };
    }

    return {
      sourceType: "external_job_board",
      sourceTrust: 70,
      resultDomain,
      isOfficialSource: false,
    };
  }

  return {
    sourceType: "noise",
    sourceTrust: 0,
    resultDomain,
    isOfficialSource: false,
  };
}

function classifyAndScoreJob(result: BraveResult, jobTitle: string, company: CompanyRow) {
  const title = clean(result.title);
  const link = clean(result.url);
  const snippet = clean(result.description);

  const titleLower = title.toLowerCase();
  const linkLower = link.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  const fullText = `${titleLower} ${linkLower} ${snippetLower}`;

  const source = classifySourceType(result, company);

  let score = 0;
  let jobType: "job_post" | "job_search_page" | "career_portal" | "irrelevant" = "irrelevant";

  const jobWords = words(jobTitle);
  const matchedWords = jobWords.filter((w) => fullText.includes(w));

  if (matchedWords.length > 0) score += matchedWords.length * 20;
  if (titleLower.includes(jobTitle.toLowerCase())) score += 45;

  const realJobSignals = [
    "/job/",
    "/jobs/",
    "job details",
    "job description",
    "apply",
    "responsibilities",
    "requirements",
    "qualifications",
    "supervisor",
    "attendant",
    "manager",
    "coordinator",
    "team leader",
    "officer",
    "agent",
    "chef",
    "engineer",
    "technician",
    "housekeeper",
  ];

  const searchPageSignals = [
    "search jobs",
    "job search",
    "search results",
    "save this search",
    "selection limit reached",
    "find your next job",
    "explore opportunities",
  ];

  const careerPortalSignals = [
    "careers at",
    "career portal",
    "open positions",
    "available jobs",
    "current openings",
  ];

  if (realJobSignals.some((s) => fullText.includes(s))) score += 30;
  if (linkLower.match(/\/job\/|\/jobs\/|jobdetails|job-details|job_detail/i)) score += 35;

  if (searchPageSignals.some((s) => fullText.includes(s))) score -= 35;
  if (careerPortalSignals.some((s) => fullText.includes(s))) score -= 20;

  if (titleLower === "job search" || titleLower.includes("search jobs")) score -= 50;
  if (titleLower.includes("careers - search")) score -= 45;

  if (source.sourceType === "official_job") score += 20;
  if (source.sourceType === "external_job_board") score += 5;
  if (source.sourceType === "career_page") score = Math.min(score, 45);
  if (source.sourceType === "noise") score = 0;

  const rejectTitlePatterns = [
    "review",
    "reviews",
    "what is",
    "salary",
    "salaries",
    "career guide",
    "employee review",
    "glassdoor review",
    "how much",
    "how to become",
  ];

  if (rejectTitlePatterns.some((x) => titleLower.includes(x))) {
    score = 0;
    jobType = "irrelevant";
  }

  score = Math.max(0, Math.min(100, score));

  if (source.sourceType === "noise") {
    jobType = "irrelevant";
  } else if (source.sourceType === "career_page") {
    jobType = "career_portal";
  } else if (score >= 60) {
    jobType = "job_post";
  } else if (searchPageSignals.some((s) => fullText.includes(s))) {
    jobType = "job_search_page";
  } else if (careerPortalSignals.some((s) => fullText.includes(s))) {
    jobType = "career_portal";
  }

  const isRealJob =
    (source.sourceType === "official_job" || source.sourceType === "external_job_board") &&
    jobType === "job_post" &&
    score >= 55;

  return {
    jobScore: score,
    jobType,
    isRealJob,
    matchedWords,
    sourceType: source.sourceType,
    sourceTrust: source.sourceTrust,
    resultDomain: source.resultDomain,
    isOfficialSource: source.isOfficialSource,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const BRAVE_SEARCH_API_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BRAVE_SEARCH_API_KEY) {
      return jsonResponse({ ok: false, error: "Missing required environment variables." }, 500);
    }

    const body = await req.json().catch(() => ({}));

    const jobTitle = clean(body.jobTitle || "Housekeeping");
    const industry = clean(body.industry || "");
    const companyLimit = Math.max(1, Math.min(Number(body.companyLimit ?? 20), 75));
    const queryLimitPerCompany = Math.max(1, Math.min(Number(body.queryLimitPerCompany ?? 4), 10));
    const resultLimit = Math.max(1, Math.min(Number(body.resultLimit ?? 30), 100));
    const maxResultsPerCompany = Math.max(1, Math.min(Number(body.maxResultsPerCompany ?? 3), 10));
    const includeWeakResults = Boolean(body.includeWeakResults ?? false);
    const includeCareerPages = Boolean(body.includeCareerPages ?? false);

    if (!jobTitle) {
      return jsonResponse({ ok: false, error: "jobTitle is required." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let companiesQuery = supabase
      .from("companies")
      .select(`
        id,
        name,
        domain,
        ats_type,
        industry,
        country,
        career_page_url_verified,
        career_platform,
        career_page_type,
        career_url_confidence
      `)
      .eq("search_ready", true)
      .limit(companyLimit * 3);

    if (industry) {
      companiesQuery = companiesQuery.ilike("industry", `%${industry}%`);
    }

    const { data: companies, error: companiesError } = await companiesQuery;

    if (companiesError) {
      return jsonResponse({ ok: false, error: "Failed to fetch companies.", details: companiesError.message }, 500);
    }

    const rows = ((companies ?? []) as CompanyRow[])
      .sort((a, b) => {
        const priorityDiff = platformPriority(b) - platformPriority(a);
        if (priorityDiff !== 0) return priorityDiff;
        return Number(b.career_url_confidence ?? 0) - Number(a.career_url_confidence ?? 0);
      })
      .slice(0, companyLimit);

    const allResults: Array<{
      title: string;
      link: string;
      snippet: string;
      companyName: string;
      companyDomain: string | null;
      companyId: string;
      atsType: string | null;
      careerPlatform: string | null;
      query: string;
      queryStrategy: string;
      source: "brave";
      pageAge: string | null;
      jobScore: number;
      jobType: string;
      isRealJob: boolean;
      matchedWords: string[];
      sourceType: SourceType;
      sourceTrust: number;
      resultDomain: string;
      isOfficialSource: boolean;
    }> = [];

    const queriesUsed: Array<{ query: string; strategy: string; companyName: string }> = [];
    const seenLinks = new Set<string>();
    const resultsPerCompany = new Map<string, number>();

    for (const company of rows) {
      if (allResults.length >= resultLimit) break;

      const queries = buildQueries(company, jobTitle).slice(0, queryLimitPerCompany);

      for (const queryItem of queries) {
        if (allResults.length >= resultLimit) break;

        const currentCompanyCount = resultsPerCompany.get(company.id) ?? 0;
        if (currentCompanyCount >= maxResultsPerCompany) break;

        queriesUsed.push({
          query: queryItem.query,
          strategy: queryItem.strategy,
          companyName: company.name,
        });

        const braveUrl = new URL("https://api.search.brave.com/res/v1/web/search");
        braveUrl.searchParams.set("q", queryItem.query);
        braveUrl.searchParams.set("count", "10");

        const braveRes = await fetch(braveUrl.toString(), {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
          },
        });

        const braveText = await braveRes.text();

        if (!braveRes.ok) {
          return jsonResponse(
            {
              ok: false,
              error: "Brave Search API request failed.",
              status: braveRes.status,
              query: queryItem.query,
              details: braveText,
            },
            502,
          );
        }

        const braveData = JSON.parse(braveText);
        const braveResults = (braveData?.web?.results ?? []) as BraveResult[];

        for (const item of braveResults) {
          const title = clean(item.title);
          const link = clean(item.url);
          const snippet = clean(item.description);

          if (!link || seenLinks.has(link)) continue;

          const scoring = classifyAndScoreJob(item, jobTitle, company);

          if (scoring.sourceType === "noise") continue;
          if (!includeCareerPages && scoring.sourceType === "career_page") continue;
          if (!includeWeakResults && !scoring.isRealJob) continue;

          const companyCount = resultsPerCompany.get(company.id) ?? 0;
          if (companyCount >= maxResultsPerCompany) break;

          seenLinks.add(link);
          resultsPerCompany.set(company.id, companyCount + 1);

          allResults.push({
            title,
            link,
            snippet,
            companyName: company.name,
            companyDomain: company.domain,
            companyId: company.id,
            atsType: company.ats_type,
            careerPlatform: company.career_platform,
            query: queryItem.query,
            queryStrategy: queryItem.strategy,
            source: "brave",
            pageAge: clean(item.page_age || item.age) || null,
            ...scoring,
          });

          if (allResults.length >= resultLimit) break;
        }
      }
    }

    allResults.sort((a, b) => {
      if (b.sourceTrust !== a.sourceTrust) return b.sourceTrust - a.sourceTrust;
      return b.jobScore - a.jobScore;
    });

    return jsonResponse({
      ok: true,
      provider: "brave",
      input: {
        jobTitle,
        industry,
        companyLimit,
        queryLimitPerCompany,
        resultLimit,
        maxResultsPerCompany,
        includeWeakResults,
        includeCareerPages,
      },
      companiesSearched: rows.length,
      queriesUsed,
      resultCount: allResults.length,
      companyResultCounts: Object.fromEntries(resultsPerCompany.entries()),
      results: allResults,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Unexpected error.",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});