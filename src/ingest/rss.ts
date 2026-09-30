import { decodeXML } from "entities";

export interface ParsedJob {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  location: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  published_at: string | null;
}

function cleanTitle(title: string): { company: string | null; title: string } {
  let cleaned = title.trim();
  let company: string | null = null;
  
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    company = parts[0].trim();
    cleaned = parts.slice(1).join(":").trim();
  }
  
  return { company, title: cleaned };
}

function extractTagContent(xml: string, tag: string): string | null {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const start = xml.indexOf(openTag);
  if (start === -1) return null;
  
  // Search for the end tag starting from `start` position to prevent catastrophic backtracking
  const end = xml.indexOf(closeTag, start);
  if (end === -1) return null;
  
  const content = xml.slice(start + openTag.length, end).trim();
  
  if (content.startsWith("<![CDATA[") && content.endsWith("]]>")) {
    return decodeXML(content.slice(9, -3).trim());
  }
  return decodeXML(content);
}

export function parseRss(xmlText: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  let startIndex = 0;
  
  while (true) {
    const itemStart = xmlText.indexOf("<item>", startIndex);
    if (itemStart === -1) break;
    const itemEnd = xmlText.indexOf("</item>", itemStart);
    if (itemEnd === -1) break;
    
    const itemContent = xmlText.slice(itemStart + 6, itemEnd);
    startIndex = itemEnd + 7;
    
    const rawTitle = extractTagContent(itemContent, "title") || "Untitled";
    const { company, title } = cleanTitle(rawTitle);
    const link = extractTagContent(itemContent, "link") || "";
    const guid = extractTagContent(itemContent, "guid") || link;
    const description = extractTagContent(itemContent, "description") || null;
    const category = extractTagContent(itemContent, "category") || null;
    const pubDate = extractTagContent(itemContent, "pubDate");
    const region = extractTagContent(itemContent, "region") || null;
    const type = extractTagContent(itemContent, "type") || null;
    
    let publishedAt: string | null = null;
    if (pubDate) {
      const d = new Date(pubDate);
      if (!isNaN(d.valueOf())) {
        publishedAt = d.toISOString();
      }
    }

    jobs.push({
      id: guid,
      title,
      company: company || category, 
      description,
      url: link,
      location: region,
      employment_type: type,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      published_at: publishedAt,
    });
  }
  
  return jobs;
}
