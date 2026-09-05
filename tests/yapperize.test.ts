import { describe, expect, it, mock } from 'bun:test';
import { MessageFlags } from 'discord.js';
import yapperizeCommand from '../commands/yapperize';
import {
  fetchAndSanitizeMessages,
  isEligibleMessage,
  parseTimeframeToSnowflake,
  sanitizeMessage,
} from '../utils/messageFetcher';
import {
  formatSummaryEmbed,
  getSummaryJsonSchema,
  SummaryZodSchema,
} from '../utils/summarizer';

describe('Yapperize Slash Command Definition', () => {
  it('should export valid command metadata and SlashCommandBuilder with channel autocomplete', () => {
    expect(yapperizeCommand.name).toBe('yapperize');
    expect(yapperizeCommand.description).toBeDefined();
    expect(yapperizeCommand.description).toContain('Gemini 3.5 Flash');
    expect(yapperizeCommand.data).toBeDefined();

    const json = yapperizeCommand.data.toJSON();
    expect(json.name).toBe('yapperize');
    expect(json.options?.length).toBe(4);

    const channelOpt = json.options?.find((o: any) => o.name === 'channel');
    expect(channelOpt).toBeDefined();
    expect(channelOpt?.required).toBe(false);
    expect(channelOpt?.autocomplete).toBe(true);

    const timeframeOpt = json.options?.find((o: any) => o.name === 'timeframe');
    expect(timeframeOpt).toBeDefined();
    expect(timeframeOpt?.required).toBe(false);

    const messageIdOpt = json.options?.find((o: any) => o.name === 'message_id');
    expect(messageIdOpt).toBeDefined();
    expect(messageIdOpt?.required).toBe(false);

    const limitOpt = json.options?.find((o: any) => o.name === 'limit') as any;
    expect(limitOpt).toBeDefined();
    expect(limitOpt?.min_value).toBe(1);
    expect(limitOpt?.max_value).toBe(500);
  });
});

describe('Channel Autocomplete Handler', () => {
  it('should suggest matching text channels where user and bot have view permissions', async () => {
    const respondMock = mock(async (choices: any[]) => {});

    const mockChannels = new Map([
      [
        '111',
        {
          id: '111',
          name: 'general',
          isTextBased: () => true,
          permissionsFor: (target: any) => ({
            has: (perms: any) => true,
          }),
        },
      ],
      [
        '222',
        {
          id: '222',
          name: 'secret-ops',
          isTextBased: () => true,
          permissionsFor: (target: any) => ({
            has: (perms: any) => false, // Bot/user lacks permission
          }),
        },
      ],
      [
        '333',
        {
          id: '333',
          name: 'general-discussion',
          isTextBased: () => true,
          permissionsFor: (target: any) => ({
            has: (perms: any) => true,
          }),
        },
      ],
    ]);

    const mockInteraction: any = {
      guild: {
        channels: {
          cache: mockChannels,
        },
      },
      client: {
        user: { id: 'bot-123' },
      },
      user: { id: 'user-456' },
      options: {
        getFocused: mock((withDetails: boolean) => ({
          name: 'channel',
          value: 'gen',
        })),
      },
      respond: respondMock,
    };

    await yapperizeCommand.autocomplete(mockInteraction);

    expect(respondMock).toHaveBeenCalledTimes(1);
    const choices = respondMock.mock.calls[0][0] as any[];
    expect(choices.length).toBe(2);
    expect(choices[0].name).toBe('#general');
    expect(choices[0].value).toBe('111');
    expect(choices[1].name).toBe('#general-discussion');
    expect(choices[1].value).toBe('333');
  });

  it('should return empty list when guild is missing (e.g. DM)', async () => {
    const respondMock = mock(async (choices: any[]) => {});

    const mockInteraction: any = {
      guild: null,
      options: {
        getFocused: mock(() => ({
          name: 'channel',
          value: '',
        })),
      },
      respond: respondMock,
    };

    await yapperizeCommand.autocomplete(mockInteraction);

    expect(respondMock).toHaveBeenCalledTimes(1);
    expect(respondMock.mock.calls[0][0]).toEqual([]);
  });
});

describe('Temporal Parsing and Snowflake Generation', () => {
  it('should parse relative time strings like "2 hours ago" into the past and return a Snowflake', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const result = parseTimeframeToSnowflake('2 hours ago', now);

    expect(result).not.toBeNull();
    expect(result!.date.getTime()).toBeLessThan(now.getTime());
    // Approx 2 hours prior
    const diffHours = (now.getTime() - result!.date.getTime()) / (1000 * 60 * 60);
    expect(Math.round(diffHours)).toBe(2);
    expect(typeof result!.snowflake).toBe('string');
    expect(result!.snowflake.length).toBeGreaterThan(10);
  });

  it('should return null for unparseable random strings', () => {
    const result = parseTimeframeToSnowflake('supercalifragilistic');
    expect(result).toBeNull();
  });

  it('should return null for empty or whitespace strings', () => {
    expect(parseTimeframeToSnowflake('')).toBeNull();
    expect(parseTimeframeToSnowflake('   ')).toBeNull();
  });
});

describe('Message Eligibility and Sanitization', () => {
  it('should filter out bot messages', () => {
    const botMsg = {
      author: { bot: true, username: 'BotUser' },
      type: 0,
      cleanContent: 'Hello from bot',
    };
    expect(isEligibleMessage(botMsg)).toBe(false);
  });

  it('should filter out system messages (e.g. pinned message notifications type 6)', () => {
    const pinMsg = {
      author: { bot: false, username: 'RegularUser' },
      type: 6,
      cleanContent: 'Pinned a message.',
    };
    expect(isEligibleMessage(pinMsg)).toBe(false);
  });

  it('should filter out empty messages with no content and no attachments', () => {
    const emptyMsg = {
      author: { bot: false, username: 'RegularUser' },
      type: 0,
      cleanContent: '',
      attachments: new Map(),
    };
    expect(isEligibleMessage(emptyMsg)).toBe(false);
  });

  it('should accept valid default messages (type 0) and replies (type 19)', () => {
    const defaultMsg = {
      author: { bot: false, username: 'Alice' },
      type: 0,
      cleanContent: 'Let us build this feature!',
    };
    const replyMsg = {
      author: { bot: false, username: 'Bob' },
      type: 19,
      cleanContent: 'Sounds like a great plan.',
    };
    expect(isEligibleMessage(defaultMsg)).toBe(true);
    expect(isEligibleMessage(replyMsg)).toBe(true);
  });

  it('should sanitize message content and resolve member display names', async () => {
    const msg = {
      id: '123456789012345678',
      author: { username: 'alice_discord' },
      member: { displayName: 'Alice In Tech' },
      createdAt: new Date('2026-09-05T10:00:00.000Z'),
      cleanContent: 'Hey @Bob, check this out',
      type: 0,
    };

    const sanitized = await sanitizeMessage(msg);
    expect(sanitized.id).toBe('123456789012345678');
    expect(sanitized.author).toBe('Alice In Tech');
    expect(sanitized.content).toBe('Hey @Bob, check this out');
    expect(sanitized.timestamp).toBe('2026-09-05T10:00:00.000Z');
  });

  it('should download and append .txt attachment content to the message', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any) => ({
      ok: true,
      text: async () => 'Notes from our meeting: Ship v1 tomorrow.',
    })) as any;

    const msg = {
      id: '987654321098765432',
      author: { username: 'charlie' },
      cleanContent: 'Attached the notes.',
      type: 0,
      attachments: [
        {
          name: 'notes.txt',
          contentType: 'text/plain',
          url: 'https://cdn.discordapp.com/attachments/123/notes.txt',
        },
      ],
    };

    const sanitized = await sanitizeMessage(msg);
    expect(sanitized.content).toContain('Attached the notes.');
    expect(sanitized.content).toContain('[Attachment: notes.txt]');
    expect(sanitized.content).toContain('Notes from our meeting: Ship v1 tomorrow.');

    globalThis.fetch = originalFetch;
  });
});

describe('Batch Pagination and Message Fetching', () => {
  it('should fetch and filter messages backwards when no boundary is given', async () => {
    const mockChannel = {
      messages: {
        fetch: mock(async (opts: any) => {
          return new Map([
            [
              '1002',
              {
                id: '1002',
                type: 0,
                author: { bot: false, username: 'Bob' },
                cleanContent: 'Second message',
                createdAt: new Date('2026-09-05T11:00:00Z'),
              },
            ],
            [
              '1001',
              {
                id: '1001',
                type: 0,
                author: { bot: true, username: 'SpamBot' },
                cleanContent: 'Bot message',
                createdAt: new Date('2026-09-05T10:59:00Z'),
              },
            ],
            [
              '1000',
              {
                id: '1000',
                type: 0,
                author: { bot: false, username: 'Alice' },
                cleanContent: 'First message',
                createdAt: new Date('2026-09-05T10:58:00Z'),
              },
            ],
          ]);
        }),
      },
    };

    const result = await fetchAndSanitizeMessages(mockChannel, { limit: 10 });
    expect(result.messages.length).toBe(2);
    // Preserves chronological order (oldest to newest)
    expect(result.messages[0].content).toBe('First message');
    expect(result.messages[1].content).toBe('Second message');
  });

  it('should fetch chronologically using after parameter when timeframe is provided', async () => {
    const mockFetch = mock(async (opts: any) => {
      expect(opts.after).toBeDefined();
      return new Map([
        [
          '2001',
          {
            id: '2001',
            type: 0,
            author: { bot: false, username: 'Dave' },
            cleanContent: 'Message after timeframe',
            createdAt: new Date('2026-09-05T11:30:00Z'),
          },
        ],
      ]);
    });

    const mockChannel = { messages: { fetch: mockFetch } };
    const result = await fetchAndSanitizeMessages(mockChannel, { timeframe: '1 hour ago' });
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].content).toBe('Message after timeframe');
    expect(result.boundaryDate).toBeDefined();
  });
});

describe('Gemini Schema and Structured Output Validation', () => {
  it('should validate complete structured output with SummaryZodSchema', () => {
    const validData = {
      summary: 'The team discussed the upcoming Q4 product launch and deployment deadlines.',
      conclusion: 'Final consensus reached to cut release branch on Friday and freeze features.',
      topics_covered: ['Deployment Timeline', 'Bug Fixes', 'QA Signoff'],
      flow_of_topics: ['Discussion started on deadlines', 'Evaluated open blockers', 'Agreed on Friday freeze'],
    };

    const parsed = SummaryZodSchema.parse(validData);
    expect(parsed.summary).toBe(validData.summary);
    expect(parsed.topics_covered.length).toBe(3);
  });

  it('should generate a valid clean JSON schema without $schema for Gemini responseSchema', () => {
    const schema = getSummaryJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties.summary).toBeDefined();
    expect(schema.properties.conclusion).toBeDefined();
    expect(schema.properties.topics_covered).toBeDefined();
    expect(schema.properties.flow_of_topics).toBeDefined();
    expect((schema as any).$schema).toBeUndefined();
  });
});

describe('Discord Embed Presentation', () => {
  it('should build an embed with summary, conclusion, topics, and flow fields for Gemini 3.5 Flash', () => {
    const summaryData = {
      summary: 'Discussion about the database migration plan.',
      conclusion: 'Migration scheduled for 2 AM UTC Sunday.',
      topics_covered: ['Database Backup', 'Zero-downtime strategy'],
      flow_of_topics: ['Identified migration risks', 'Outlined failover steps'],
    };

    const embed = formatSummaryEmbed(summaryData, 42, 'dev-discussion');
    const json = embed.toJSON();

    expect(json.title).toBe('🗣️ Yapperize: #dev-discussion');
    expect(json.description).toContain('Discussion about the database migration plan.');
    expect(json.description).toContain('Migration scheduled for 2 AM UTC Sunday.');
    expect(json.fields?.length).toBe(2);

    const topicsField = json.fields?.find((f) => f.name.includes('Topics Covered'));
    expect(topicsField?.value).toContain('• Database Backup');
    expect(topicsField?.value).toContain('• Zero-downtime strategy');

    const flowField = json.fields?.find((f) => f.name.includes('Flow of Topics'));
    expect(flowField?.value).toContain('1. Identified migration risks');
    expect(flowField?.value).toContain('2. Outlined failover steps');

    expect(json.footer?.text).toContain('42 messages');
    expect(json.footer?.text).toContain('Gemini 3.5 Flash');
  });

  it('should safely truncate oversized descriptions and field values', () => {
    const longText = 'A'.repeat(5000);
    const summaryData = {
      summary: longText,
      conclusion: longText,
      topics_covered: [longText],
      flow_of_topics: [longText],
    };

    const embed = formatSummaryEmbed(summaryData, 10);
    const json = embed.toJSON();

    expect(json.description!.length).toBeLessThanOrEqual(4000);
    for (const field of json.fields || []) {
      expect(field.value.length).toBeLessThanOrEqual(1024);
    }
  });
});

describe('Slash Command Interaction Execution & Channel Resolution', () => {
  it('should defer reply publicly so response is visible to everyone in channel', async () => {
    const deferReplyMock = mock(async () => {});
    const editReplyMock = mock(async () => {});

    const mockInteraction: any = {
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      options: {
        getString: mock((name: string) => null),
        getInteger: mock((name: string) => 50),
      },
      channel: {
        messages: {
          fetch: mock(async () => new Map()),
        },
      },
    };

    // Set missing API key to trigger safe early exit after defer
    const oldApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await yapperizeCommand.executeSlash(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledTimes(1);
    const deferArgs = deferReplyMock.mock.calls[0][0] as any;
    expect(deferArgs?.flags).not.toBe(MessageFlags.Ephemeral);
    expect(editReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('GEMINI_API_KEY'),
      })
    );

    if (oldApiKey) process.env.GEMINI_API_KEY = oldApiKey;
  });

  it('should fetch from specified channel when channel parameter is provided', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const deferReplyMock = mock(async () => {});
    const editReplyMock = mock(async () => {});

    const targetFetchMock = mock(async () => new Map());
    const targetChannel = {
      id: '999888',
      name: 'announcements',
      isTextBased: () => true,
      permissionsFor: (u: any) => ({
        has: () => true,
      }),
      messages: {
        fetch: targetFetchMock,
      },
    };

    const defaultChannel = {
      id: '111222',
      name: 'bot-commands',
      isTextBased: () => true,
      messages: {
        fetch: mock(async () => new Map()),
      },
    };

    const mockInteraction: any = {
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      channel: defaultChannel,
      guild: {
        channels: {
          cache: new Map([['999888', targetChannel]]),
          fetch: mock(async () => targetChannel),
        },
      },
      client: {
        user: { id: 'bot-1' },
      },
      user: { id: 'user-1' },
      options: {
        getString: mock((name: string) => (name === 'channel' ? '<#999888>' : null)),
        getInteger: mock((name: string) => 50),
      },
    };

    await yapperizeCommand.executeSlash(mockInteraction);

    // Target channel fetch should have been called, not default channel
    expect(targetFetchMock).toHaveBeenCalled();
    expect(editReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('#announcements'),
      })
    );
  });

  it('should alert user on Missing Access (50001) error', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const deferReplyMock = mock(async () => {});
    const editReplyMock = mock(async () => {});

    const missingAccessError: any = new Error('Missing Access');
    missingAccessError.code = 50001;

    const mockInteraction: any = {
      deferred: true,
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      options: {
        getString: mock(() => null),
        getInteger: mock(() => 50),
      },
      channel: {
        messages: {
          fetch: mock(async () => {
            throw missingAccessError;
          }),
        },
      },
    };

    await yapperizeCommand.executeSlash(mockInteraction);

    expect(editReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Missing Access (50001)'),
      })
    );
  });

  it('should silently ignore transient unknown interaction error (10062)', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const unknownInteractionErr: any = new Error('Unknown interaction');
    unknownInteractionErr.code = 10062;

    const mockInteraction: any = {
      deferred: true,
      deferReply: mock(async () => {}),
      editReply: mock(async () => {
        throw unknownInteractionErr;
      }),
      options: {
        getString: mock(() => null),
        getInteger: mock(() => 50),
      },
      channel: {
        messages: {
          fetch: mock(async () => {
            throw unknownInteractionErr;
          }),
        },
      },
    };

    // Should not rethrow or crash
    await yapperizeCommand.executeSlash(mockInteraction);
  });
});
