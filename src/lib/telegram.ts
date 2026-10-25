/**
 * src/lib/telegram.ts
 * Telegram Alerting Service for SmartLink Git Quiz Organizers
 *
 * Dispatches high-priority notifications to lead organizers:
 * - Readiness audit failures
 * - System error rate spikes (>5%)
 * - Emergency Kill-Switch activations
 * - Dual-organizer sign-off requests
 */

export interface AlertPayload {
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  details?: Record<string, any>;
}

export async function sendTelegramAlert(payload: AlertPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const emoji =
    payload.level === "critical" ? "🚨" : payload.level === "warning" ? "⚠️" : "ℹ️";

  const formattedText = [
    `${emoji} *[SmartLink Git Quiz Alert]*`,
    `*${payload.title}*`,
    "",
    payload.message,
    payload.details ? `\`\`\`json\n${JSON.stringify(payload.details, null, 2)}\n\`\`\`` : "",
    `_Time: ${new Date().toISOString()}_`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!token || !chatId) {
    console.log("[Telegram Alert Mock]:", formattedText);
    return true;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formattedText,
        parse_mode: "Markdown",
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("[Telegram Alert] Failed to dispatch webhook:", err);
    return false;
  }
}
