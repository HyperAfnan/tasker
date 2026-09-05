import * as chrono from 'chrono-node';
import { SnowflakeUtil } from 'discord.js';

export interface SanitizedMessage {
  id: string;
  author: string;
  timestamp: string;
  content: string;
}

export interface FetchOptions {
  timeframe?: string;
  messageId?: string;
  limit?: number;
}

/**
 * Parses a natural language timeframe into a past Date, and converts it to a Discord Snowflake.
 * Uses chrono-node with forwardDate: false relative to the current reference date.
 */
export function parseTimeframeToSnowflake(
  timeframe: string,
  referenceDate: Date = new Date()
): { date: Date; snowflake: string } | null {
  if (!timeframe || !timeframe.trim()) return null;

  const parsedDate = chrono.parseDate(timeframe.trim(), referenceDate, { forwardDate: false });
  if (!parsedDate) return null;

  // Discord epoch starts in 2015; ensure date is not before Discord epoch
  const discordEpoch = new Date('2015-01-01T00:00:00.000Z');
  const validDate = parsedDate < discordEpoch ? discordEpoch : parsedDate;

  const snowflake = SnowflakeUtil.generate({ timestamp: validDate }).toString();
  return { date: validDate, snowflake };
}

/**
 * Validates whether a message is an eligible user message.
 * Filters out bots, empty payloads, and system messages (only type 0: Default and 19: Reply allowed).
 */
export function isEligibleMessage(message: any): boolean {
  if (!message) return false;

  // Filter out bot traffic
  if (message.author?.bot) return false;

  // Filter out system notifications: only type 0 (Default) or 19 (Reply) are allowed
  if (message.type !== 0 && message.type !== 19) return false;

  // Filter out empty payloads (must have content or attachments)
  const hasText = Boolean(message.cleanContent && message.cleanContent.trim().length > 0);
  const hasAttachments = Boolean(message.attachments && (message.attachments.size > 0 || message.attachments.length > 0));
  if (!hasText && !hasAttachments) return false;

  return true;
}

/**
 * Sanitizes a message, extracting human-readable cleanContent and fetching any .txt attachments.
 */
export async function sanitizeMessage(message: any): Promise<SanitizedMessage> {
  const author = message.member?.displayName || message.author?.username || 'Unknown User';
  const timestamp = message.createdAt ? new Date(message.createdAt).toISOString() : new Date().toISOString();
  let content = message.cleanContent?.trim() || '';

  // Check for attachments and download .txt files
  if (message.attachments) {
    const attachments = message.attachments.values ? Array.from(message.attachments.values()) : message.attachments;
    for (const att of attachments as any[]) {
      const isTxt = att.name?.toLowerCase().endsWith('.txt') || att.contentType?.startsWith('text/plain');
      if (isTxt && att.url) {
        try {
          const res = await fetch(att.url);
          if (res.ok) {
            const rawText = await res.text();
            // Cap text file length to 20,000 characters to avoid flooding LLM context
            const safeText = rawText.length > 20000 ? `${rawText.slice(0, 20000)}... [truncated]` : rawText;
            content += `\n[Attachment: ${att.name || 'document.txt'}]\n${safeText}`;
          }
        } catch (err) {
          console.warn(`[yapperize] Failed to fetch .txt attachment ${att.name}:`, err);
        }
      }
    }
  }

  return {
    id: message.id,
    author,
    timestamp,
    content: content.trim(),
  };
}

/**
 * Fetches batches of messages from a channel up to the specified limit, using either
 * after (temporal snowflake or message_id) or before (iterating backward from present).
 */
export async function fetchAndSanitizeMessages(
  channel: any,
  options: FetchOptions = {}
): Promise<{ messages: SanitizedMessage[]; totalScanned: number; boundaryDate?: Date }> {
  const maxLimit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  let afterSnowflake: string | undefined;
  let boundaryDate: Date | undefined;

  // 1. Resolve temporal boundary if timeframe provided
  if (options.timeframe) {
    const temporal = parseTimeframeToSnowflake(options.timeframe);
    if (!temporal) {
      throw new Error(`Could not parse timeframe: "${options.timeframe}". Try "2 hours ago", "yesterday", or "30 minutes ago".`);
    }
    afterSnowflake = temporal.snowflake;
    boundaryDate = temporal.date;
  } else if (options.messageId) {
    // If messageId provided directly, use it as boundary
    afterSnowflake = options.messageId.trim();
  }

  const rawMessages: any[] = [];
  let totalScanned = 0;

  if (afterSnowflake) {
    // Jump to boundary and fetch forward chronologically
    let cursor = afterSnowflake;
    while (rawMessages.length < maxLimit) {
      const fetchBatchSize = Math.min(100, maxLimit - rawMessages.length);
      const batch: any = await channel.messages.fetch({ limit: fetchBatchSize, after: cursor });

      if (!batch || batch.size === 0) break;
      totalScanned += batch.size;

      // Sort batch chronologically (ascending snowflake)
      const sortedBatch = Array.from(batch.values() as any[]).sort((a: any, b: any) =>
        BigInt(a.id) < BigInt(b.id) ? -1 : 1
      );

      for (const msg of sortedBatch) {
        if (isEligibleMessage(msg)) {
          rawMessages.push(msg);
          if (rawMessages.length >= maxLimit) break;
        }
      }

      // Update cursor to highest snowflake in this batch
      const highestMsg = sortedBatch[sortedBatch.length - 1];
      if (!highestMsg || highestMsg.id === cursor) break;
      cursor = highestMsg.id;

      if (batch.size < fetchBatchSize) break;
    }
  } else {
    // Iterate backward from present
    let cursor: string | undefined = undefined;
    while (rawMessages.length < maxLimit) {
      const fetchBatchSize = Math.min(100, maxLimit - rawMessages.length);
      const fetchOptions: any = { limit: fetchBatchSize };
      if (cursor) fetchOptions.before = cursor;

      const batch: any = await channel.messages.fetch(fetchOptions);
      if (!batch || batch.size === 0) break;
      totalScanned += batch.size;

      // Sort descending to iterate backward
      const sortedBatch = Array.from(batch.values() as any[]).sort((a: any, b: any) =>
        BigInt(a.id) > BigInt(b.id) ? -1 : 1
      );

      for (const msg of sortedBatch) {
        if (isEligibleMessage(msg)) {
          rawMessages.push(msg);
          if (rawMessages.length >= maxLimit) break;
        }
      }

      const lowestMsg = sortedBatch[sortedBatch.length - 1];
      if (!lowestMsg || lowestMsg.id === cursor) break;
      cursor = lowestMsg.id;

      if (batch.size < fetchBatchSize) break;
    }

    // Sort chronologically from oldest to newest for the AI
    rawMessages.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  }

  // Sanitize kept messages in parallel (extracting cleanContent & downloading .txt attachments)
  const sanitized = await Promise.all(rawMessages.map((msg) => sanitizeMessage(msg)));

  // Filter out any messages that ended up empty after sanitization
  const validMessages = sanitized.filter((m) => m.content.length > 0);

  return {
    messages: validMessages,
    totalScanned,
    boundaryDate,
  };
}
