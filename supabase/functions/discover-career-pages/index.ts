import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  career_page_url: string | null;
  career_page_url_original: string | null;
  ats_type: string | null;
};

type CareerPageType =
  | "ats_portal"
  | "career_portal"
  | "recruitment_form"
  | "job_post"
  | "career_blog"
  | "job_board"
  | "unknown";

type HtmlSignals = {
  fetched: boolean;
  statusCode: number | null;
  title: string;
  textSample: string;
  matched: string[];
  hasCareerContent: boolean;
  hasApplyContent: boolean;
  hasJobListContent: boolean;
};

type VerifyResult = {
  verifiedUrl: string | null;
  status: "verified" | "needs_review" | "invalid_url";
  confidence: number;
  source: string;
  notes: string;
  detectedAts: string | null;
  careerPageType: CareerPageType;
  careerPlatform: string;
  searchReady: boolean;
  searchReadyReason: string;
};

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

function normalizeName(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeUrl(rawValue: string): string | null {
  const raw = clean(rawValue);
  if (!raw) return null;

  try {
    const withProtocol =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `https://${raw}`;

    const url = new URL(withProtocol);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function hostnameOf(rawValue: string): string {
  const normalized = normalizeUrl(rawValue);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function pathOf(rawValue: string): string {
  const normalized = normalizeUrl(rawValue);
  if (!normalized) return "";

  try {
    return new URL(normalized).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 200) : "";
}

function detectAts(urlValue: string): string | null {
  const url = urlValue.toLowerCase();

  if (url.includes("smartrecruiters.com")) return "SmartRecruiters";
  if (url.includes("oraclecloud.com") || url.includes("candidateexperience")) return "OracleRecruiting";
  if (url.includes("myworkdayjobs.com") || url.includes("workdayjobs.com")) return "Workday";
  if (url.includes("taleo.net")) return "Taleo";
  if (url.includes("icims.com")) return "iCIMS";
  if (url.includes("greenhouse.io")) return "Greenhouse";
  if (url.includes("lever.co")) return "Lever";
  if (url.includes("careers-page.com")) return "CareersPage";
  if (url.includes("apply.workable.com")) return "Workable";
  if (url.includes("bamboohr.com")) return "BambooHR";
  if (url.includes("recruitee.com")) return "Recruitee";
  if (url.includes("successfactors")) return "SuccessFactors";
  if (url.includes("talentera.com")) return "Talentera";
  if (url.includes("betterteam.com")) return "Betterteam";
  if (url.includes("teamtailor.com")) return "Teamtailor";
  if (url.includes("ashbyhq.com")) return "Ashby";
  if (url.includes("join.com")) return "Join";
  if (url.includes("zohorecruit.com") || (url.includes("zoho") && url.includes("recruit"))) return "ZohoRecruit";

  return null;
}

function classifyCareerPageTypeFromUrl(urlValue: string, detectedAts: string | null): CareerPageType {
  const url = urlValue.toLowerCase();
  const host = hostnameOf(urlValue);
  const path = pathOf(urlValue);

  if (detectedAts) return "ats_portal";

  if (
    url.includes("career-blog") ||
    url.includes("/blog/") ||
    url.includes("/blogs/") ||
    url.includes("resume-objective") ||
    url.includes("cv-template") ||
    url.includes("resume-template")
  ) return "career_blog";

  if (
    host.includes("job4u") ||
    host.includes("indeed.") ||
    host.includes("bayt.") ||
    host.includes("naukrigulf.") ||
    host.includes("gulftalent.") ||
    host.includes("linkedin.")
  ) return "job_board";

  if (
    path.includes("single-career") ||
    path.includes("job-detail") ||
    path.includes("job-details") ||
    path.includes("jobdescription") ||
    path.includes("job-description") ||
    path.includes("/job/") ||
    (path.includes("/jobs/") && /\/jobs\/[^/]+/.test(path))
  ) return "job_post";

  if (
    path.includes("recruitment-form") ||
    path.includes("/form/") ||
    path.includes("application-form") ||
    path.includes("apply-form")
  ) return "recruitment_form";

  if (
    host.startsWith("career.") ||
    host.startsWith("careers.") ||
    host.startsWith("jobs.") ||
    host.endsWith(".jobs") ||
    path.includes("careers") ||
    path.includes("career") ||
    path.includes("job-openings") ||
    path.includes("jobs-opening") ||
    path.includes("current-openings") ||
    path.includes("openings") ||
    path.includes("vacancies") ||
    path.includes("opportunities") ||
    path.includes("join-us") ||
    path.includes("work-with-us") ||
    path.includes("recruitment")
  ) return "career_portal";

  return "unknown";
}

async function fetchHtmlSignals(url: string): Promise<HtmlSignals> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ResumationCareerVerifier/1.0; +https://www.resumation.co)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const statusCode = res.status;
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("text/html")) {
      return {
        fetched: true,
        statusCode,
        title: "",
        textSample: "",
        matched: [],
        hasCareerContent: false,
        hasApplyContent: false,
        hasJobListContent: false,
      };
    }

    const html = await res.text();
    const title = extractTitle(html);
    const text = stripHtml(html).slice(0, 30000);
    const lower = text.toLowerCase();

    const patterns = [
      "careers",
      "career",
      "apply",
      "positions available",
      "available positions",
      "current openings",
      "job openings",
      "vacancies",
      "join our team",
      "send your cv",
      "submit your cv",
      "detailed cv",
      "recruitment",
      "job search",
      "search jobs",
      "open positions",
      "interested candidates",
      "employment",
      "work with us",
    ];

    const matched = patterns.filter((p) => lower.includes(p));

    return {
      fetched: true,
      statusCode,
      title,
      textSample: text.slice(0, 500),
      matched,
      hasCareerContent:
        matched.includes("careers") ||
        matched.includes("career") ||
        matched.includes("join our team") ||
        matched.includes("work with us") ||
        matched.includes("employment"),
      hasApplyContent:
        matched.includes("apply") ||
        matched.includes("send your cv") ||
        matched.includes("submit your cv") ||
        matched.includes("interested candidates") ||
        matched.includes("detailed cv"),
      hasJobListContent:
        matched.includes("positions available") ||
        matched.includes("available positions") ||
        matched.includes("current openings") ||
        matched.includes("job openings") ||
        matched.includes("vacancies") ||
        matched.includes("open positions") ||
        matched.includes("search jobs"),
    };
  } catch {
    return {
      fetched: false,
      statusCode: null,
      title: "",
      textSample: "",
      matched: [],
      hasCareerContent: false,
      hasApplyContent: false,
      hasJobListContent: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function refineTypeWithHtml(type: CareerPageType, html: HtmlSignals): CareerPageType {
  if (!html.fetched) return type;

  if (type === "career_blog" || type === "job_post" || type === "ats_portal" || type === "job_board") {
    return type;
  }

  if (html.hasCareerContent && (html.hasApplyContent || html.hasJobListContent)) {
    return "career_portal";
  }

  if (html.hasApplyContent && html.hasJobListContent) {
    return "career_portal";
  }

  if (html.hasApplyContent && type === "unknown") {
    return "recruitment_form";
  }

  return type;
}

function isSearchReady(type: CareerPageType): boolean {
  return (
    type === "ats_portal" ||
    type === "career_portal" ||
    type === "recruitment_form" ||
    type === "job_board"
  );
}

function reasonForSearchReady(type: CareerPageType, searchReady: boolean): string {
  if (searchReady && type === "ats_portal") return "ATS platform detected; searchable via platform/domain queries.";
  if (searchReady && type === "career_portal") return "Career portal detected from URL or page content.";
  if (searchReady && type === "recruitment_form") return "Recruitment/application form detected.";
  if (searchReady && type === "job_board") return "External job board detected.";

  if (type === "job_post") return "Single job post only; not a reusable career search page.";
  if (type === "career_blog") return "Career blog/article detected; not a job search page.";
  if (type === "unknown") return "Could not identify a searchable career portal from URL or page content.";

  return "Not search ready.";
}

async function verifyCareerUrl(company: CompanyRow): Promise<VerifyResult> {
  const originalUrl =
    normalizeUrl(company.career_page_url_original || "") ||
    normalizeUrl(company.career_page_url || "");

  if (!originalUrl) {
    return {
      verifiedUrl: null,
      status: "invalid_url",
      confidence: 0,
      source: "url_parser",
      notes: "Missing or invalid career_page_url.",
      detectedAts: null,
      careerPageType: "unknown",
      careerPlatform: "Unknown",
      searchReady: false,
      searchReadyReason: "Invalid or missing URL.",
    };
  }

  const urlLower = originalUrl.toLowerCase();
  const host = hostnameOf(originalUrl);
  const detectedAts = detectAts(originalUrl);

  const htmlSignals = await fetchHtmlSignals(originalUrl);

  let careerPageType = classifyCareerPageTypeFromUrl(originalUrl, detectedAts);
  careerPageType = refineTypeWithHtml(careerPageType, htmlSignals);

  const careerPlatform =
    detectedAts || (careerPageType === "job_board" ? "JobBoard" : "Custom");

  let score = 0;
  const reasons: string[] = [];

  if (detectedAts) {
    score += 60;
    reasons.push(`Detected ATS/platform: ${detectedAts}`);
  }

  const strongSignals = [
    "careers",
    "career",
    "jobs",
    "job",
    "job-openings",
    "jobs-opening",
    "current-openings",
    "openings",
    "vacancies",
    "vacancy",
    "apply",
    "recruitment",
    "candidate",
    "candidateexperience",
    "hcmui",
    "position",
    "positions",
    "opportunities",
    "join-us",
    "joinus",
    "work-with-us",
    "workwithus",
  ];

  const matchedUrlSignals = strongSignals.filter((signal) => urlLower.includes(signal));

  if (matchedUrlSignals.length > 0) {
    score += Math.min(55, matchedUrlSignals.length * 18);
    reasons.push(`URL signals: ${matchedUrlSignals.join(", ")}`);
  }

  if (
    host.endsWith(".jobs") ||
    host.includes(".jobs.") ||
    host.includes("jobs.") ||
    host.includes("careers.") ||
    host.includes("career.") ||
    host.includes("apply.")
  ) {
    score += 35;
    reasons.push("Career-like hostname detected.");
  }

  if (host && company.domain) {
    const companyHost = hostnameOf(company.domain);
    if (companyHost && (host.includes(companyHost) || companyHost.includes(host))) {
      score += 15;
      reasons.push("URL host matches company domain.");
    }
  }

  const companyName = normalizeName(company.name);
  const compactUrl = normalizeName(originalUrl);

  if (companyName && compactUrl.includes(companyName)) {
    score += 10;
    reasons.push("URL contains company name.");
  }

  if (htmlSignals.fetched) {
    reasons.push(`HTML fetched: ${htmlSignals.statusCode}`);
    if (htmlSignals.matched.length > 0) {
      score += Math.min(45, htmlSignals.matched.length * 10);
      reasons.push(`HTML signals: ${htmlSignals.matched.join(", ")}`);
    }
  } else {
    reasons.push("HTML fetch failed or timed out.");
  }

  if (careerPageType === "career_blog") {
    score = Math.min(score, 20);
    reasons.push("Detected career blog/article, not a job search page.");
  }

  if (careerPageType === "job_post") {
    score = Math.min(score, 35);
    reasons.push("Detected single job post, not a reusable career portal.");
  }

  if (careerPageType === "job_board") {
    score = Math.min(Math.max(score, 50), 70);
    reasons.push("Detected external job board.");
  }

  if (careerPageType === "recruitment_form") {
    score = Math.max(score, 55);
    reasons.push("Detected recruitment form.");
  }

  if (careerPageType === "career_portal") {
    score = Math.max(score, 55);
  }

  score = Math.max(0, Math.min(100, score));

  const searchReady = isSearchReady(careerPageType);

  const status =
    searchReady && score >= 45
      ? "verified"
      : "needs_review";

  return {
    verifiedUrl: originalUrl,
    status,
    confidence: score,
    source: detectedAts || careerPlatform || "career_url_html_signals",
    notes: reasons.join(" | ") || "No strong career/job signals found.",
    detectedAts,
    careerPageType,
    careerPlatform,
    searchReady,
    searchReadyReason: reasonForSearchReady(careerPageType, searchReady),
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ ok: false, error: "Missing Supabase environment variables." }, 500);
    }

    const body = await req.json().catch(() => ({}));

    const limit = Math.max(1, Math.min(Number(body.limit ?? 50), 100));
    const status = clean(body.status || "pending");
    const dryRun = Boolean(body.dryRun ?? false);
    const onlyNullType = Boolean(body.onlyNullType ?? false);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let query = supabase
      .from("companies")
      .select("id, name, domain, career_page_url, career_page_url_original, ats_type")
      .eq("career_url_status", status)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (onlyNullType) {
      query = query.is("career_page_type", null);
    }

    const { data: companies, error: fetchError } = await query;

    if (fetchError) {
      return jsonResponse({ ok: false, error: "Failed to fetch companies.", details: fetchError.message }, 500);
    }

    const rows = (companies ?? []) as CompanyRow[];

    const processed = [];
    const updates = [];

    for (const company of rows) {
      const result = await verifyCareerUrl(company);

      const updatePayload = {
        id: company.id,
        career_page_url_verified: result.verifiedUrl,
        career_url_status: result.status,
        career_url_confidence: result.confidence,
        career_url_source: result.source,
        career_url_checked_at: new Date().toISOString(),
        career_url_notes: result.notes,
        ats_type: result.detectedAts || company.ats_type || "Custom",
        career_page_type: result.careerPageType,
        career_platform: result.careerPlatform,
        search_ready: result.searchReady,
        search_ready_reason: result.searchReadyReason,
        updated_at: new Date().toISOString(),
      };

      updates.push(updatePayload);

      processed.push({
        id: company.id,
        name: company.name,
        inputUrl: company.career_page_url_original || company.career_page_url,
        ...result,
      });
    }

    if (!dryRun && updates.length > 0) {
      for (const update of updates) {
        const { id, ...payload } = update;

        const { error: updateError } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", id);

        if (updateError) {
          return jsonResponse({
            ok: false,
            error: "Failed to update company.",
            companyId: id,
            details: updateError.message,
          }, 500);
        }
      }
    }

    return jsonResponse({
      ok: true,
      dryRun,
      requestedStatus: status,
      onlyNullType,
      limit,
      fetched: rows.length,
      updated: dryRun ? 0 : updates.length,
      processed,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: "Unexpected error.",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});