import { describe, expect, it, mock } from 'bun:test';

mock.module('../models/Group', () => ({
  createGroup: mock(async (userId: string, groupName: string) => ({ userId, groupName })),
  getGroups: mock(async (_userId: string) => [{ groupName: 'Projects', _id: { toHexString: () => '123' } }]),
  deleteGroup: mock(async (_id: any) => true),
  groupExists: mock(async (_userId: string, _groupName: string) => false),
  getGroupByName: mock(async (_userId: string, groupName: string) => ({ _id: { toHexString: () => '123' }, groupName })),
  getGroupById: mock(async (id: any) => ({ _id: id, groupName: 'Projects' })),
  updateGroupName: mock(async (_userId: string, _oldName: string, _newName: string) => true),
}));

mock.module('../models/Task', () => ({
  createTask: mock(async (userId: string, content: string, groupId: any) => ({ userId, content, groupId })),
  getTasks: mock(async (_userId: string) => [
    { content: 'Test task', status: 'pending', _id: { toHexString: () => '507f1f77bcf86cd799439011' }, groupId: { toHexString: () => '123' } },
  ]),
  getTaskById: mock(async (_id: any) => ({
    content: 'Test task',
    status: 'pending',
    _id: { toHexString: () => '507f1f77bcf86cd799439011' },
  })),
  updateTaskStatus: mock(async (_id: any, status: string) => ({ content: 'Test task', status })),
  deleteTask: mock(async (_id: any) => true),
  clearTasksGroup: mock(async (_groupId: any) => true),
  updateTaskContent: mock(async (_id: any, content: string, _groupId?: any) => ({ content, status: 'pending' })),
}));

import groupCommand from '../commands/group';
import taskCommand from '../commands/task';
import helpCommand from '../commands/help';
import pingCommand from '../commands/ping';
import interactionCreateHandler from '../events/interactionCreate';
import { registerSlashCommands } from '../events/ready';

describe('Group Slash Command Structure & Data', () => {
  it('should export subcommands with proper options and no parameters for list', () => {
    expect(groupCommand.name).toBe('group');
    expect(groupCommand.data).toBeDefined();

    const json = groupCommand.data.toJSON();
    expect(json.name).toBe('group');
    expect(json.options).toBeDefined();
    expect(json.options?.length).toBe(4);

    const subcommands = json.options?.map((opt: any) => opt.name) ?? [];
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('delete');
    expect(subcommands).toContain('rename');

    // /group list has NO options
    const listSub = json.options?.find((opt: any) => opt.name === 'list') as any;
    expect(listSub.options === undefined || listSub.options.length === 0).toBe(true);

    // /group create has ONLY name
    const createSub = json.options?.find((opt: any) => opt.name === 'create') as any;
    expect(createSub.options?.length).toBe(1);
    expect(createSub.options?.[0]?.name).toBe('name');

    // /group delete has ONLY name with autocomplete
    const deleteSub = json.options?.find((opt: any) => opt.name === 'delete') as any;
    expect(deleteSub.options?.length).toBe(1);
    expect(deleteSub.options?.[0]?.name).toBe('name');
    expect(deleteSub.options?.[0]?.autocomplete).toBe(true);

    // /group rename has name and new_name
    const renameSub = json.options?.find((opt: any) => opt.name === 'rename') as any;
    expect(renameSub.options?.length).toBe(2);
    expect(renameSub.options?.[0]?.name).toBe('name');
    expect(renameSub.options?.[1]?.name).toBe('new_name');
  });
});

describe('Task Slash Command Structure & Data', () => {
  it('should export subcommands where done, remove, and rename use inline task autocomplete', () => {
    expect(taskCommand.name).toBe('task');
    expect(taskCommand.data).toBeDefined();

    const json = taskCommand.data.toJSON();
    expect(json.name).toBe('task');
    expect(json.options).toBeDefined();
    expect(json.options?.length).toBe(5);

    const subcommands = json.options?.map((opt: any) => opt.name) ?? [];
    expect(subcommands).toContain('add');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('done');
    expect(subcommands).toContain('remove');
    expect(subcommands).toContain('rename');

    // /task add: 1st option is content, 2nd option is group
    const addSub = json.options?.find((opt: any) => opt.name === 'add') as any;
    expect(addSub.options?.length).toBe(2);
    expect(addSub.options?.[0]?.name).toBe('content');
    expect(addSub.options?.[0]?.required).toBe(true);
    expect(addSub.options?.[1]?.name).toBe('group');
    expect(addSub.options?.[1]?.required).toBe(true);
    expect(addSub.options?.[1]?.autocomplete).toBe(true);

    // /task list has NO options
    const listSub = json.options?.find((opt: any) => opt.name === 'list') as any;
    expect(listSub.options === undefined || listSub.options.length === 0).toBe(true);

    // /task done has task option with autocomplete
    const doneSub = json.options?.find((opt: any) => opt.name === 'done') as any;
    expect(doneSub.options?.length).toBe(1);
    expect(doneSub.options?.[0]?.name).toBe('task');
    expect(doneSub.options?.[0]?.required).toBe(true);
    expect(doneSub.options?.[0]?.autocomplete).toBe(true);

    // /task remove has task option with autocomplete
    const removeSub = json.options?.find((opt: any) => opt.name === 'remove') as any;
    expect(removeSub.options?.length).toBe(1);
    expect(removeSub.options?.[0]?.name).toBe('task');
    expect(removeSub.options?.[0]?.required).toBe(true);
    expect(removeSub.options?.[0]?.autocomplete).toBe(true);

    // /task rename has task option with autocomplete and new_content
    const renameSub = json.options?.find((opt: any) => opt.name === 'rename') as any;
    expect(renameSub.options?.length).toBe(2);
    expect(renameSub.options?.[0]?.name).toBe('task');
    expect(renameSub.options?.[0]?.required).toBe(true);
    expect(renameSub.options?.[0]?.autocomplete).toBe(true);
    expect(renameSub.options?.[1]?.name).toBe('new_content');
    expect(renameSub.options?.[1]?.required).toBe(true);
  });
});

describe('All Commands Registration', () => {
  it('should register all 4 slash commands (help, ping, group, task)', async () => {
    const setCommandsMock = mock(async (_cmds: any[]) => {});
    const mockClient = {
      commands: new Map<string, any>([
        ['help', helpCommand],
        ['ping', pingCommand],
        ['group', groupCommand],
        ['task', taskCommand],
      ]),
      application: {
        commands: {
          set: setCommandsMock,
        },
      },
    };

    const registered = await registerSlashCommands(mockClient);
    expect(registered.length).toBe(4);
    expect(setCommandsMock).toHaveBeenCalledTimes(1);
    const passedCommands = (setCommandsMock.mock.calls as any)[0]?.[0] as any[];
    const names = passedCommands.map((c) => c.name);
    expect(names).toContain('help');
    expect(names).toContain('ping');
    expect(names).toContain('group');
    expect(names).toContain('task');
  });

  it('should register commands to guild using fetch when GUILD_ID is provided', async () => {
    process.env.GUILD_ID = '1544486918719283241';
    const setGuildCommandsMock = mock(async (_cmds: any[]) => {});
    const mockGuild = {
      id: '1544486918719283241',
      name: "Dev'Larpers",
      commands: {
        set: setGuildCommandsMock,
      },
    };

    const mockClient = {
      commands: new Map<string, any>([
        ['help', helpCommand],
        ['ping', pingCommand],
      ]),
      guilds: {
        fetch: mock(async (id: string) => (id === '1544486918719283241' ? mockGuild : null)),
        cache: new Map(),
      },
      application: {
        commands: {
          set: mock(async () => {}),
        },
      },
    };

    try {
      const registered = await registerSlashCommands(mockClient);
      expect(registered.length).toBe(2);
      expect(setGuildCommandsMock).toHaveBeenCalledTimes(1);
      expect(mockClient.guilds.fetch).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.GUILD_ID;
    }
  });
});

describe('Slash Command Execution (group & task)', () => {
  it('should execute /group create and reply', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'create',
        getString: (name: string) => (name === 'name' ? 'Projects' : null),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await groupCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds).toBeDefined();
    expect(replyPayload.embeds.length).toBe(1);
  });

  it('should execute /group list and reply with no parameters', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'list',
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await groupCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds).toBeDefined();
  });

  it('should execute /group rename and reply', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'rename',
        getString: (name: string) => (name === 'name' ? 'OldGroup' : name === 'new_name' ? 'NewGroup' : null),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    const groupModels = await import('../models/Group');
    (groupModels.groupExists as any).mockImplementationOnce(async (_uid: string, name: string) => name === 'OldGroup');

    await groupCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds).toBeDefined();
  });

  it('should execute /task add with content first then group', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'add',
        getString: (opt: string) => (opt === 'content' ? 'Finish docs' : opt === 'group' ? 'Projects' : null),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await taskCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds).toBeDefined();
  });

  it('should execute /task list with no parameters', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'list',
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await taskCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds).toBeDefined();
    expect(replyPayload.embeds[0].data.title).toBe("Tester's Tasks");
  });

  it('should execute /task done with task option directly', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'done',
        getString: (name: string) => (name === 'task' ? '507f1f77bcf86cd799439011' : null),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await taskCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds[0].data.description).toContain('Task marked as done');
  });

  it('should execute /task remove with task option directly', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'remove',
        getString: (name: string) => (name === 'task' ? '507f1f77bcf86cd799439011' : null),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await taskCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds[0].data.description).toContain('Task removed');
  });

  it('should execute /task rename with task and new_content options directly', async () => {
    let replyPayload: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1', displayName: 'Tester' },
      options: {
        getSubcommand: () => 'rename',
        getString: (name: string) => (name === 'task' ? '507f1f77bcf86cd799439011' : name === 'new_content' ? 'Updated task description' : null),
      },
      reply: mock(async (payload: any) => {
        replyPayload = payload;
      }),
    };

    await taskCommand.executeSlash(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload.embeds[0].data.description).toContain('Task renamed to:');
  });
});

describe('Autocomplete & Interaction Dispatcher', () => {
  it('should respond with group autocomplete choices in taskCommand', async () => {
    let respondedChoices: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1' },
      options: {
        getFocused: () => ({ name: 'group', value: 'proj' }),
        getSubcommand: () => 'add',
      },
      respond: mock(async (choices: any) => {
        respondedChoices = choices;
      }),
    };

    await taskCommand.autocomplete(mockInteraction);
    expect(mockInteraction.respond).toHaveBeenCalledTimes(1);
    expect(respondedChoices).toBeDefined();
    expect(respondedChoices.length).toBe(1);
    expect(respondedChoices[0].name).toBe('Projects');
  });

  it('should respond with task autocomplete choices in taskCommand', async () => {
    let respondedChoices: any = null;
    const mockInteraction = {
      user: { id: 'test-user-1' },
      options: {
        getFocused: () => ({ name: 'task', value: 'Test' }),
        getSubcommand: () => 'done',
      },
      respond: mock(async (choices: any) => {
        respondedChoices = choices;
      }),
    };

    await taskCommand.autocomplete(mockInteraction);
    expect(mockInteraction.respond).toHaveBeenCalledTimes(1);
    expect(respondedChoices).toBeDefined();
    expect(respondedChoices.length).toBe(1);
    expect(respondedChoices[0].name).toContain('Test task');
    expect(respondedChoices[0].value).toBe('507f1f77bcf86cd799439011');
  });

  it('should dispatch autocomplete interactions via interactionCreate event handler', async () => {
    const autocompleteMock = mock(async (_interaction: any) => {});
    const mockClient = {
      commands: new Map([
        ['task', { autocomplete: autocompleteMock }],
      ]),
    };

    const mockInteraction: any = {
      commandName: 'task',
      isAutocomplete: () => true,
      isChatInputCommand: () => false,
    };

    await interactionCreateHandler.execute(mockInteraction, { client: mockClient });
    expect(autocompleteMock).toHaveBeenCalledTimes(1);
  });
});
