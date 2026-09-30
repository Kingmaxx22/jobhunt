import type { NormalizedJob } from "./types";

export interface HardFilterPrefs {
  remote_only?: boolean;
  min_salary?: number | null;
  blocklist_keywords?: string[];
  allow_locations?: string[];
  block_companies?: string[];
  employment_types?: string[];
}

export function parsePrefs(json: string | null): HardFilterPrefs {
  if (!json) return {};
  try {
    return JSON.parse(json) as HardFilterPrefs;
  } catch {
    return {};
  }
}

/** Job passes a single prefs set. Empty prefs = pass. */
export function passesPrefs(job: NormalizedJob, prefs: HardFilterPrefs): { pass: boolean; reason?: string } {
  const haystack = `${job.title} ${job.description || ""}`.toLowerCase();
  const location = (job.location || "").toLowerCase();

  if (prefs.block_companies && job.company) {
    const c = job.company.toLowerCase();
    if (prefs.block_companies.some((b) => b.toLowerCase() === c)) {
      return { pass: false, reason: "blocked company" };
    }
  }

  if (prefs.blocklist_keywords?.some((k) => k && haystack.includes(k.toLowerCase()))) {
    return { pass: false, reason: "blocklisted keyword" };
  }

  if (prefs.employment_types && prefs.employment_types.length > 0 && job.employment_type) {
    const allowed = prefs.employment_types.map((t) => t.toLowerCase());
    if (!allowed.includes(job.employment_type.toLowerCase())) {
      return { pass: false, reason: "employment type excluded" };
    }
  }

  if (prefs.allow_locations && prefs.allow_locations.length > 0) {
    const allowed = prefs.allow_locations.map((l) => l.toLowerCase());
    const locOk = allowed.some((a) => location.includes(a) || a.includes(location));
    const remoteOk = allowed.some((a) => ["remote", "worldwide", "anywhere"].includes(a));
    if (!locOk && !(remoteOk && (!location || location.includes("remote") || location.includes("worldwide") || location.includes("anywhere")))) {
      return { pass: false, reason: "location not allowed" };
    }
  } else if (prefs.remote_only) {
    const onsite = location.includes("on-site") || location.includes("onsite") || location.includes("hybrid");
    const remote = !location || location.includes("remote") || location.includes("worldwide") || location.includes("anywhere");
    if (onsite && !remote) return { pass: false, reason: "not remote" };
  }

  if (prefs.min_salary && prefs.min_salary > 0) {
    // Only reject when we KNOW the pay ceiling is below the floor.
    if (job.salary_max !== null && job.salary_max < prefs.min_salary) {
      return { pass: false, reason: "below salary floor" };
    }
  }

  return { pass: true };
}

const EN_WORDS = new Set(
  "the and with for from are you your will have has our work team experience skills remote job role apply hiring looking join help requirements responsibilities about company benefits salary preferred strong ability including within through their them they this that will join develop build design lead senior engineer manager".split(" ")
);
const ID_WORDS = new Set(
  "yang dan dengan untuk dari adalah dalam oleh sebagai kerja lowongan dicari dibutuhkan kami anda perusahaan gaji pengalaman minimal maksimal lulusan penempatan kualifikasi syarat bisa akan tidak sangat juga dapat orang tim bergabung kirim lamaran".split(" ")
);

/**
 * Global language gate: keep English or Indonesian postings only.
 * Density heuristic over title+description; short texts pass (can't judge).
 */
export function passesLanguage(job: NormalizedJob): { pass: boolean; reason?: string } {
  const text = `${job.title} ${(job.description || "").replace(/<[^>]*>/g, " ")}`
    .toLowerCase()
    .substring(0, 3000);
  const tokens = text.split(/[^a-z]+/).filter((t) => t.length >= 2);
  if (tokens.length < 15) return { pass: true };
  let hits = 0;
  for (const t of tokens) {
    if (EN_WORDS.has(t) || ID_WORDS.has(t)) hits += 1;
  }
  if (hits >= Math.max(3, tokens.length * 0.03)) return { pass: true };
  return { pass: false, reason: "language not English/Indonesian" };
}

/** Keep job if it passes ANY active profile (per-profile matching). No profiles = keep all. */
export function passesAnyProfile(job: NormalizedJob, prefsList: HardFilterPrefs[]): { pass: boolean; reason?: string } {
  if (prefsList.length === 0) return { pass: true };
  let lastReason = "";
  for (const prefs of prefsList) {
    const r = passesPrefs(job, prefs);
    if (r.pass) return { pass: true };
    lastReason = r.reason || lastReason;
  }
  return { pass: false, reason: lastReason };
}
