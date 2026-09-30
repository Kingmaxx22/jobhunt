export interface SendTelegramMessageOptions {
  parse_mode?: "MarkdownV2" | "Markdown" | "HTML";
  disable_web_page_preview?: boolean;
}

export interface JobForMessage {
  title: string;
  company: string | null;
  location: string | null;
  employment_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  url: string;
  published_at?: string | null;
}

export interface MatchForMessage extends JobForMessage {
  match_score: number;
  match_explanation: string | null;
  profile_name?: string | null;
  lane?: string | null;
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatSalary(job: JobForMessage): string {
  if (job.salary_min || job.salary_max) {
    return `${job.salary_min ?? "?"} - ${job.salary_max ?? "?"} ${job.salary_currency ?? ""}`.trim();
  }
  return "Not listed";
}

function baseJobLines(job: JobForMessage): string {
  const lines = [
    `💼 <b>${escapeHtml(job.title)}</b>`,
    `🏢 ${escapeHtml(job.company || "Unknown")}`,
    `📍 ${escapeHtml(job.location || "Remote")}`,
  ];
  if (job.employment_type) lines.push(`🕘 ${escapeHtml(job.employment_type)}`);
  lines.push(`💰 ${escapeHtml(formatSalary(job))}`);
  if (job.published_at) lines.push(`🕒 ${escapeHtml(job.published_at)}`);
  return lines.join("\n");
}

export function formatJobMessage(job: JobForMessage): string {
  return `${baseJobLines(job)}\n\n<a href="${job.url}">🔗 Apply / View Job</a>`;
}

export function formatMatchMessage(m: MatchForMessage): string {
  const pct = Math.round(m.match_score * 100);
  const easy = m.lane === "easy";
  const header = easy
    ? `🛠 <b>Easy-entry gig (${pct}%)</b> — low barrier, side-income friendly`
    : `✨ <b>New High-Match Job (${pct}% match)</b>` +
      (m.profile_name ? ` for ${escapeHtml(m.profile_name)}` : "");
  const why = m.match_explanation
    ? `\n\n💡 <b>Why it matches:</b> ${escapeHtml(m.match_explanation)}`
    : "";
  return `${header}\n\n${baseJobLines(m)}${why}\n\n<a href="${m.url}">🔗 Apply / View Job</a>`;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  options?: SendTelegramMessageOptions & { reply_markup?: { inline_keyboard: InlineButton[][] } }
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode ?? "HTML",
    disable_web_page_preview: options?.disable_web_page_preview ?? false,
  };
  if (options?.reply_markup) payload.reply_markup = options.reply_markup;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return (await response.json()) as { ok: boolean; description?: string };
}

export async function answerTelegramCallback(token: string, callbackId: string, text?: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text: text || "Saved" }),
    });
  } catch {
    // best effort
  }
}

export function matchFeedbackKeyboard(matchId: number): { inline_keyboard: InlineButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "✅ Apply", callback_data: `fb:${matchId}:apply` },
        { text: "💾 Save", callback_data: `fb:${matchId}:save` },
        { text: "⏭ Skip", callback_data: `fb:${matchId}:skip` },
      ],
    ],
  };
}
