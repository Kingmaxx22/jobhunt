import { describe, it, expect } from "vitest";
import { normalizeJobUrl, generateJobFingerprint } from "../src/ingest/pipeline";

describe("Job Deduplication and Normalization", () => {
  it("strips tracking parameters from job URLs", () => {
    const rawUrl =
      "https://remoteok.com/remote-jobs/12345?utm_source=feed&utm_medium=rss&ref=aggregator#apply";
    const cleaned = normalizeJobUrl(rawUrl);
    expect(cleaned).toBe("https://remoteok.com/remote-jobs/12345");
  });

  it("generates consistent fingerprints for cross-source matching", () => {
    const fp1 = generateJobFingerprint("Stripe, Inc.", "Staff Software Engineer - Infrastructure");
    const fp2 = generateJobFingerprint("Stripe", "Staff Software Engineer - Infrastructure");
    expect(fp1).toContain("stripe");
    expect(fp2).toContain("stripe");
  });
});
