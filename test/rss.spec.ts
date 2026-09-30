import { describe, it, expect } from "vitest";
import { parseRss } from "../src/ingest/rss";

describe("parseRss", () => {
  it("successfully parses We Work Remotely RSS format", () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>We Work Remotely</title>
    <item>
      <title>Discord: Senior Software Engineer, Application Security</title>
      <region>Anywhere in the World</region>
      <type>Full-Time</type>
      <description>&lt;p&gt;We are looking for an engineer&lt;/p&gt;</description>
      <pubDate>Tue, 29 Sep 2026 11:56:21 +0000</pubDate>
      <guid>https://weworkremotely.com/remote-jobs/discord-app-sec</guid>
      <link>https://weworkremotely.com/remote-jobs/discord-app-sec</link>
    </item>
  </channel>
</rss>`;

    const jobs = parseRss(sampleXml);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual({
      id: "https://weworkremotely.com/remote-jobs/discord-app-sec",
      title: "Senior Software Engineer, Application Security",
      company: "Discord",
      description: "<p>We are looking for an engineer</p>",
      url: "https://weworkremotely.com/remote-jobs/discord-app-sec",
      location: "Anywhere in the World",
      employment_type: "Full-Time",
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      published_at: "2026-09-29T11:56:21.000Z",
    });
  });

  it("handles CDATA and HTML entities properly", () => {
    const sampleXml = `<rss><channel><item>
      <title><![CDATA[ACME & Co: Full Stack &amp; Backend Developer]]></title>
      <link>https://example.com/job/1</link>
      <description><![CDATA[<p>Rock &amp; Roll</p>]]></description>
      <pubDate>2026-01-01T00:00:00Z</pubDate>
    </item></channel></rss>`;

    const jobs = parseRss(sampleXml);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe("ACME & Co");
    expect(jobs[0].title).toBe("Full Stack & Backend Developer");
    expect(jobs[0].description).toBe("<p>Rock & Roll</p>");
  });
});
