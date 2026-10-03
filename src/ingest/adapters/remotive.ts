import type { FeedSource, NormalizedJob } from "../types";

interface RemotiveJob {
  id: number | string;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveApiResponse {
  "0-legal-notice"?: string;
  "job-count"?: number;
  jobs?: RemotiveJob[];
}

function parseSalary(salaryStr?: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  if (!salaryStr) {
    return { min: null, max: null, currency: null };
  }

  // Detect currency symbol or code
  let currency: string | null = null;
  if (salaryStr.includes("$") || salaryStr.toUpperCase().includes("USD")) currency = "USD";
  else if (salaryStr.includes("€") || salaryStr.toUpperCase().includes("EUR")) currency = "EUR";
  else if (salaryStr.includes("£") || salaryStr.toUpperCase().includes("GBP")) currency = "GBP";

  // Match numbers e.g. 50k, 100k, 50,000 - 80,000, 50 - 75
  const matches = salaryStr.match(/(\d+(?:[.,]\d+)?)\s*(k|K)?/g);
  if (!matches || matches.length === 0) {
    return { min: null, max: null, currency };
  }

  const parseNum = (s: string): number => {
    const isK = /k/i.test(s);
    const cleaned = s.replace(/[^0-9.]/g, "");
    const val = parseFloat(cleaned);
    return isK ? val * 1000 : val;
  };

  const nums = matches.map(parseNum).filter((n) => !isNaN(n));
  if (nums.length === 1) {
    return { min: nums[0], max: nums[0], currency };
  } else if (nums.length >= 2) {
    return {
      min: Math.min(nums[0], nums[1]),
      max: Math.max(nums[0], nums[1]),
      currency,
    };
  }

  return { min: null, max: null, currency };
}

export async function fetchRemotiveApi(source: FeedSource): Promise<NormalizedJob[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Jobhunt/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    throw new Error(`Remotive API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RemotiveApiResponse;
  const rawJobs = data.jobs || [];

  return rawJobs.map((item) => {
    const salary = parseSalary(item.salary);

    return {
      id: `remotive:${item.id}`,
      title: item.title,
      company: item.company_name || null,
      description: item.description || null,
      url: item.url,
      location: item.candidate_required_location || null,
      employment_type: item.job_type || null,
      salary_min: salary.min,
      salary_max: salary.max,
      salary_currency: salary.currency,
      published_at: item.publication_date
        ? new Date(item.publication_date).toISOString()
        : null,
    };
  });
}
