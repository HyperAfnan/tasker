import { describe, expect, it, mock } from 'bun:test';
import { MessageFlags } from 'discord.js';
import helpCommand, { buildHelpEmbed, buildSelectRow } from '../commands/help';
import pingCommand from '../commands/ping';
import interactionCreateEvent from '../events/interactionCreate';
import { registerSlashCommands } from '../events/ready';

describe('Help Command Structure & Slash Command Builder', () => {
  it('should have valid name and description', () => {
    expect(helpCommand.name).toBe('help');
    expect(typeof helpCommand.description).toBe('string');
    expect(helpCommand.description.length).toBeGreaterThan(0);
  });

  it('should export a valid SlashCommandBuilder JSON structure', () => {
    expect(helpCommand.data).toBeDefined();
    const json = helpCommand.data.toJSON();
    expect(json.name).toBe('help');
    expect(json.description).toBe(helpCommand.description);
    expect(json.options).toBeDefined();
    expect(json.options?.length).toBe(1);

    const categoryOption = json.options?.[0] as any;
    expect(categoryOption.name).toBe('category');
    expect(categoryOption.choices?.length).toBe(5);
    const choiceValues = categoryOption.choices?.map((c: any) => c.value);
    expect(choiceValues).toContain('all');
    expect(choiceValues).toContain('quickstart');
    expect(choiceValues).toContain('tasks');
    expect(choiceValues).toContain('groups');
    expect(choiceValues).toContain('general');
  });

  it('ping command should also have slash command data and executeSlash', () => {
    expect(pingCommand.name).toBe('ping');
    expect(pingCommand.data).toBeDefined();
    const json = pingCommand.data.toJSON();
    expect(json.name).toBe('ping');
    expect(typeof pingCommand.executeSlash).toBe('function');
  });
});

describe('Help Embed Generator', () => {
  it('should generate an overview embed with all command categories', () => {
    const embed = buildHelpEmbed('all', 'TestUser');
    const json = embed.toJSON();

    expect(json.title).toContain('Tasker - Help Menu & Command Directory');
    expect(json.description).toContain('TestUser');
    expect(json.fields?.length).toBe(4);

    const fieldTitles = json.fields?.map((f) => f.name) ?? [];
    expect(fieldTitles.some((t) => t.includes('Quick Start'))).toBe(true);
    expect(fieldTitles.some((t) => t.includes('Task Operations'))).toBe(true);
    expect(fieldTitles.some((t) => t.includes('Group Operations'))).toBe(true);
    expect(fieldTitles.some((t) => t.includes('Utilities'))).toBe(true);

    const allValues = json.fields?.map((f) => f.value).join(' ') ?? '';
    expect(allValues).toContain("'task add");
    expect(allValues).toContain("'task list");
    expect(allValues).toContain("'task done");
    expect(allValues).toContain("'task remove");
    expect(allValues).toContain("'group create");
    expect(allValues).toContain("'group list");
    expect(allValues).toContain("'group delete");
    expect(allValues).toContain("'ping");
    expect(allValues).toContain("'help");
  });

  it('should generate a beginner-friendly quickstart guide', () => {
    const embed = buildHelpEmbed('quickstart');
    const json = embed.toJSON();

    expect(json.title).toContain('Quick Start Guide');
    expect(json.description).toContain('Create a Category');
    expect(json.description).toContain('Add Your Tasks');
    expect(json.description).toContain("View Today's Tasks");
    expect(json.description).toContain('Mark Completed, Rename, or Remove');
  });

  it('should generate detailed task commands embed', () => {
    const embed = buildHelpEmbed('tasks');
    const json = embed.toJSON();

    expect(json.title).toContain('Task Management Commands');
    expect(json.fields?.length).toBe(5);
    const fieldNames = json.fields?.map((f) => f.name) ?? [];
    expect(fieldNames.some((n) => n.includes('Add Task'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('List Tasks'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('Mark Done'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('Rename Task'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('Remove Task'))).toBe(true);
  });

  it('should generate detailed group commands embed', () => {
    const embed = buildHelpEmbed('groups');
    const json = embed.toJSON();

    expect(json.title).toContain('Group Management Commands');
    expect(json.fields?.length).toBe(4);
    const fieldNames = json.fields?.map((f) => f.name) ?? [];
    expect(fieldNames.some((n) => n.includes('Create Group'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('List Groups'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('Rename Group'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('Delete Group'))).toBe(true);
  });

  it('should generate general commands embed', () => {
    const embed = buildHelpEmbed('general');
    const json = embed.toJSON();

    expect(json.title).toContain('General & Utility Commands');
    const fieldNames = json.fields?.map((f) => f.name) ?? [];
    expect(fieldNames.some((n) => n.includes('Help Menu'))).toBe(true);
    expect(fieldNames.some((n) => n.includes('Ping'))).toBe(true);
  });
});

describe('Help Select Menu Builder', () => {
  it('should build a select row with 5 category options', () => {
    const row = buildSelectRow('all', false);
    const json = row.toJSON();

    expect(json.components?.length).toBe(1);
    const select = json.components?.[0] as any;
    expect(select.custom_id).toBe('help-category-select');
    expect(select.disabled).toBe(false);
    expect(select.options?.length).toBe(5);

    const defaultOption = select.options?.find((o: any) => o.default === true);
    expect(defaultOption?.value).toBe('all');
  });

  it('should mark the correct option as default and support disabled mode', () => {
    const row = buildSelectRow('quickstart', true);
    const json = row.toJSON();
    const select = json.components?.[0] as any;

    expect(select.disabled).toBe(true);
    const defaultOption = select.options?.find((o: any) => o.default === true);
    expect(defaultOption?.value).toBe('quickstart');
  });
});

describe('Execution Handlers (Prefix & Slash)', () => {
  it('should execute prefix help command and reply with embed and components', async () => {
    let replyPayload: any = null;
    const mockMessage = {
      author: { id: 'user123', displayName: 'Afnan' },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
        return {
          createMessageComponentCollector: mock(() => ({
            on: mock(() => {}),
          })),
        };
      }),
    };

    await helpCommand.execute(mockMessage, ['help']);
    expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds).toBeDefined();
    expect(replyPayload.embeds.length).toBe(1);
    expect(replyPayload.components).toBeDefined();
    expect(replyPayload.components.length).toBe(1);
  });

  it('should execute slash help command and reply with withResponse: true', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'user123', displayName: 'Afnan' },
      options: {
        getString: mock(() => 'tasks'),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
        return {
          resource: {
            message: {
              createMessageComponentCollector: mock(() => ({
                on: mock(() => {}),
              })),
            },
          },
        };
      }),
    };

    await helpCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.withResponse).toBe(true);
    expect(replyPayload.embeds[0].data.title).toContain('Task Management Commands');
  });
});

describe('Interaction Event Handler', () => {
  it('should route chat input command interaction to executeSlash', async () => {
    const executedSlash = mock(async () => {});
    const mockClient = {
      commands: new Map([
        [
          'help',
          {
            executeSlash: executedSlash,
          },
        ],
      ]),
    };

    const mockInteraction = {
      isChatInputCommand: () => true,
      commandName: 'help',
      reply: mock(async () => {}),
      followUp: mock(async () => {}),
      replied: false,
      deferred: false,
    };

    await interactionCreateEvent.execute(mockInteraction as any, { client: mockClient });
    expect(executedSlash).toHaveBeenCalledTimes(1);
  });

  it('should handle interaction errors gracefully with ephemeral reply', async () => {
    const mockClient = {
      commands: new Map([
        [
          'help',
          {
            executeSlash: mock(async () => {
              throw new Error('Test error');
            }),
          },
        ],
      ]),
    };

    const replyMock = mock(async () => {});
    const mockInteraction = {
      isChatInputCommand: () => true,
      commandName: 'help',
      reply: replyMock,
      followUp: mock(async () => {}),
      replied: false,
      deferred: false,
    };

    await interactionCreateEvent.execute(mockInteraction as any, { client: mockClient });
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect((replyMock.mock.calls as any)[0]?.[0]?.flags).toBe(MessageFlags.Ephemeral);
  });
});

describe('Slash Command Registration', () => {
  it('should collect commands with data property and register to application', async () => {
    const setCommandsMock = mock(async (_cmds: any[]) => {});
    const mockClient = {
      commands: new Map<string, any>([
        ['help', helpCommand],
        ['ping', pingCommand],
        ['task', { name: 'task' }], // no data property
      ]),
      application: {
        commands: {
          set: setCommandsMock,
        },
      },
    };

    const registered = await registerSlashCommands(mockClient);
    expect(registered.length).toBe(2);
    expect(setCommandsMock).toHaveBeenCalledTimes(1);
    const passedCommands = setCommandsMock.mock.calls[0]?.[0] as any[];
    const names = passedCommands.map((c) => c.name);
    expect(names).toContain('help');
    expect(names).toContain('ping');
    expect(names).not.toContain('task');
  });
});
