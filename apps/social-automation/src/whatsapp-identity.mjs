const isWhatsAppJid = (value) => /^\d{5,}@(lid|s\.whatsapp\.net)$/.test(String(value || ''));

export async function resolveWhatsAppSenderIds({ bridgeUrl, chatId, senderId, isPrivate = false, fetchImpl = fetch }) {
  const fallback = [String(senderId || '')].filter(Boolean);
  if (isPrivate || !bridgeUrl || !chatId || !isWhatsAppJid(senderId)) return fallback;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetchImpl(`${String(bridgeUrl).replace(/\/$/, '')}/chat/${encodeURIComponent(chatId)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    const details = Array.isArray(payload?.participantDetails) ? payload.participantDetails : [];
    const match = details.find((participant) => [participant?.id, participant?.phoneNumber].map(String).includes(String(senderId)));
    return [...new Set([senderId, match?.id, match?.phoneNumber].map(String).filter(isWhatsAppJid))];
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
