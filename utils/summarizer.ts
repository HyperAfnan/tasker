import { GoogleGenAI } from "@google/genai";
import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { SanitizedMessage } from "./messageFetcher";

export const SummaryZodSchema = z.object({
  summary: z
    .string()
    .describe(
      "A concise, comprehensive overview of what was discussed in the channel chatter.",
    ),
  conclusion: z
    .string()
    .describe(
      "Key conclusions, decisions reached, action items, or final outcomes.",
    ),
  topics_covered: z
    .array(z.string())
    .describe("Distinct key topics, themes, or issues addressed."),
  flow_of_topics: z
    .array(z.string())
    .describe(
      "Chronological narrative progression of how the conversation transitioned from topic to topic.",
    ),
});

export type SummaryResult = z.infer<typeof SummaryZodSchema>;

/**
 * Generates the clean JSON schema definition for Gemini's responseSchema.
 */
export function getSummaryJsonSchema() {
  const schemaObj = zodToJsonSchema(SummaryZodSchema) as any;
  const { $schema, ...cleanSchema } = schemaObj;
  return cleanSchema;
}

/**
 * Invokes Gemini 2.5 Flash with structured output enforcement to summarize messages.
 */
export async function generateSummary(
  messages: SanitizedMessage[],
  apiKey: string = process.env.GEMINI_API_KEY || "",
  model: string = process.env.GEMINI_MODEL || "gemini-3.5-flash",
): Promise<SummaryResult> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }

  if (messages.length === 0) {
    throw new Error("No eligible messages found to summarize.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const schema = getSummaryJsonSchema();

  // Format message transcripts for LLM context
  const transcript = messages
    .map((m) => `[${m.timestamp}] ${m.author}: ${m.content}`)
    .join("\n");

  const prompt = `Here is the transcript of recent messages from a Discord channel:\n\n${transcript}\n\nPlease analyze the discussion and provide a structured summary adhering strictly to the JSON schema.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction:
        "You are a senior discord message summarizer. Analyze the provided Discord chat transcripts and produce a structured, high-signal summary of the discussion. Focus on key decisions, important discussions, topics covered, and the natural flow of conversation. Be objective, accurate, and concise.",
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Received an empty response from Gemini API.");
  }

  try {
    const parsed = JSON.parse(responseText);
    return SummaryZodSchema.parse(parsed);
  } catch (err) {
    console.error(
      "[yapperize] Failed to parse Gemini response as JSON:",
      responseText,
      err,
    );
    throw new Error(
      "Failed to parse the AI summary into the expected structured format.",
    );
  }
}

/**
 * Truncates text safely to a maximum length with an ellipsis.
 */
function safeTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Formats the summary into an attractive Discord Embed adhering to Discord API limits.
 */
export function formatSummaryEmbed(
  data: SummaryResult,
  messageCount: number,
  channelName?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`🗣️ Yapperize${channelName ? `: #${channelName}` : ""}`)
    .setTimestamp();

  // Combine summary & conclusion for description (Discord limit: 4096)
  const descriptionContent =
    `### 📝 Summary\n${data.summary}\n\n` +
    `### 🎯 Conclusion\n${data.conclusion}`;

  embed.setDescription(safeTruncate(descriptionContent, 4000));

  // Format Topics Covered (Discord field value limit: 1024)
  if (data.topics_covered && data.topics_covered.length > 0) {
    const topicsFormatted = data.topics_covered.map((t) => `• ${t}`).join("\n");
    embed.addFields({
      name: "📌 Topics Covered",
      value: safeTruncate(topicsFormatted, 1020),
    });
  }

  // Format Flow of Topics (Discord field value limit: 1024)
  if (data.flow_of_topics && data.flow_of_topics.length > 0) {
    const flowFormatted = data.flow_of_topics
      .map((f, i) => `${i + 1}. ${f}`)
      .join("\n");
    embed.addFields({
      name: "🔄 Flow of Topics",
      value: safeTruncate(flowFormatted, 1020),
    });
  }

  embed.setFooter({
    text: `Analyzed ${messageCount} message${messageCount === 1 ? "" : "s"} • Gemini 3.5 Flash`,
  });

  return embed;
}
