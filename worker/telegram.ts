export type TelegramEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

// Telegram rejects messages over 4,096 characters.
const MAX_TELEGRAM_TEXT = 4_096;

/** Sends Isaac a Telegram message. Never throws; returns whether Telegram accepted it. */
export async function sendTelegram(env: TelegramEnv, text: string, kind: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.warn(JSON.stringify({ event: 'telegram_not_configured', kind }));
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, MAX_TELEGRAM_TEXT), disable_web_page_preview: true }),
    });
    const body = await response.json().catch(() => null) as
      { ok?: boolean; description?: string; result?: { message_id?: number } } | null;
    const ok = response.ok && body?.ok === true;
    console.log(JSON.stringify({
      event: ok ? 'telegram_sent' : 'telegram_send_failed', kind, status: response.status, ok,
      messageId: body?.result?.message_id, description: ok ? undefined : body?.description,
    }));
    return ok;
  } catch (error) {
    console.error(JSON.stringify({ event: 'telegram_send_failed', kind,
      error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}
