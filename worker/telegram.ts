/** Sends one message through the owner's own bot. Never throws. */
export async function sendTelegram(token: string, chatId: string, html: string): Promise<boolean> {
  if (!token || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type MsgLine = { name: string; variant_text: string | null; price: number; quantity: number };

/** The order as a Telegram message (HTML mode). Used for new orders and for "send again". */
export function orderMessage(
  o: { id: number; order_number: string; name: string; phone: string; address: string; note: string; total: number },
  lines: MsgLine[],
  symbol: string,
  origin: string,
): string {
  const money = (q: number) => `${(q / 100).toFixed(2)} ${symbol}`;
  return [
    `🛒 <b>Yeni sifariş #${o.order_number}</b>`,
    "",
    `👤 ${escHtml(o.name)}`,
    `📞 ${o.phone}`,
    o.address ? `📍 ${escHtml(o.address)}` : "",
    "",
    ...lines.map((l) => `• ${escHtml(l.name)}${l.variant_text ? ` (${escHtml(l.variant_text)})` : ""} × ${l.quantity} — ${money(l.price * l.quantity)}`),
    "",
    `💰 Cəmi: <b>${money(o.total)}</b>`,
    o.note ? `📝 Qeyd: ${escHtml(o.note)}` : "",
    "",
    `Admin paneldə bax: ${origin}/admin/#/orders/${o.id}`,
  ]
    .filter((x, i, a) => x !== "" || a[i - 1] !== "")
    .join("\n");
}
