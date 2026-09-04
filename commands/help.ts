import {
  ActionRowBuilder,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

export function buildHelpEmbed(category: string = 'all', userDisplayName?: string) {
  const normalizedCategory = category.toLowerCase().trim();

  switch (normalizedCategory) {
    case 'quickstart':
      return new EmbedBuilder()
        .setTitle('🚀 Tasker - Quick Start Guide')
        .setColor('#2ECC71')
        .setDescription(
          `Welcome${userDisplayName ? ` **${userDisplayName}**` : ''}! Organizing your day with Tasker is quick and simple. Follow these 4 steps:\n\n` +
          `**1️⃣ Create a Category / Group**\n` +
          `Tasks are organized into groups (e.g., Work, Study, Personal):\n` +
          `> \`'group create Projects\` or \`/group create [name]\`\n\n` +
          `**2️⃣ Add Your Tasks**\n` +
          `Add tasks under your newly created group:\n` +
          `> \`'task add Projects Complete report\`\n` +
          `> \`'task add Projects Review pull request\`\n\n` +
          `**3️⃣ View Today's Tasks**\n` +
          `Check your organized daily to-do list:\n` +
          `> \`'task list\` (or \`'task show\`)\n\n` +
          `**4️⃣ Mark Completed or Remove**\n` +
          `Mark tasks as completed (✅) using their task number from the list:\n` +
          `> \`'task done 1\`\n` +
          `Or remove a task once it's done:\n` +
          `> \`'task remove 1\``
        )
        .setFooter({ text: "Tip: Both slash commands (/) and prefix (') are supported!" })
        .setTimestamp();

    case 'tasks':
    case 'task':
      return new EmbedBuilder()
        .setTitle('📝 Task Management Commands')
        .setColor('#3498DB')
        .setDescription('Create, track, and complete your tasks with these commands:')
        .addFields(
          {
            name: "➕ Add Task: `task add [group] [content]`",
            value: "Adds a new task to a specified group.\n*Example:* `'task add Work Complete quarterly report`",
          },
          {
            name: "📋 List Tasks: `task list` or `task show`",
            value: "Displays all your tasks for today grouped by category, with completion status (`✅` or `[  ]`).\n*Example:* `'task list`",
          },
          {
            name: "✅ Mark Done: `task done [number]`",
            value: "Marks a task as completed based on its index from `'task list`.\n*Example:* `'task done 2`",
          },
          {
            name: "🗑️ Remove Task: `task remove [number]`",
            value: "Permanently removes a task from your list.\n*Example:* `'task remove 2`",
          }
        )
        .setFooter({ text: "Use prefix ' or slash / commands" })
        .setTimestamp();

    case 'groups':
    case 'group':
      return new EmbedBuilder()
        .setTitle('📁 Group Management Commands')
        .setColor('#E67E22')
        .setDescription('Groups help you categorize and keep your tasks organized:')
        .addFields(
          {
            name: "📁 Create Group: `group create [name]`",
            value: "Creates a new category for tasks.\n*Example:* `'group create Personal`",
          },
          {
            name: "📄 List Groups: `group list`",
            value: "Lists all categories you currently have created.\n*Example:* `'group list`",
          },
          {
            name: "❌ Delete Group: `group delete [name]`",
            value: "Deletes a group and clears all tasks assigned to it.\n*Example:* `'group delete Personal`",
          }
        )
        .setFooter({ text: "Use prefix ' or slash / commands" })
        .setTimestamp();

    case 'general':
    case 'utility':
    case 'utilities':
      return new EmbedBuilder()
        .setTitle('⚙️ General & Utility Commands')
        .setColor('#9B59B6')
        .setDescription('General bot utilities and information:')
        .addFields(
          {
            name: "❓ Help Menu: `/help` or `'help`",
            value: "Displays the help menu, command directory, and quick start guide.\n*Usage:* `/help [category]` or `'help [category]`",
          },
          {
            name: "🏓 Ping: `/ping` or `'ping`",
            value: "Replies with Pong to check bot responsiveness.\n*Usage:* `/ping` or `'ping`",
          }
        )
        .setFooter({ text: "Use prefix ' or slash / commands" })
        .setTimestamp();

    case 'all':
    default:
      return new EmbedBuilder()
        .setTitle('📋 Tasker - Help Menu & Command Directory')
        .setColor('#3498DB')
        .setDescription(
          `Welcome${userDisplayName ? ` **${userDisplayName}**` : ''} to **Tasker**! Your personal task & productivity manager on Discord.\n\n` +
          `Commands can be used via **Slash Commands** (\`/help\`) or the text prefix **\`'\`** (\`'help\`).\n` +
          `Use the dropdown menu below to view specific guides and detailed command syntax.`
        )
        .addFields(
          {
            name: '🚀 Quick Start (4 Steps)',
            value:
              "1. `'group create [name]` - Create a task category\n" +
              "2. `'task add [group] [task]` - Add a task\n" +
              "3. `'task list` - View your checklist\n" +
              "4. `'task done [number]` - Mark task completed",
          },
          {
            name: '📝 Task Operations (`task`)',
            value:
              "• `'task add [group] [content]` - Add task to group\n" +
              "• `'task list` / `'task show` - View today's checklist\n" +
              "• `'task done [number]` - Mark task completed\n" +
              "• `'task remove [number]` - Delete a task",
          },
          {
            name: '📁 Group Operations (`group`)',
            value:
              "• `'group create [name]` - Create a category\n" +
              "• `'group list` - List all your categories\n" +
              "• `'group delete [name]` - Delete category & its tasks",
          },
          {
            name: '⚙️ Utilities (`ping`, `help`)',
            value:
              "• `'help` or `/help` - Open this help menu\n" +
              "• `'ping` or `/ping` - Check bot status",
          }
        )
        .setFooter({ text: 'Select an option from the menu below for more details!' })
        .setTimestamp();
  }
}

export function buildSelectRow(selectedCategory: string = 'all', disabled: boolean = false) {
  const options = [
    new StringSelectMenuOptionBuilder()
      .setLabel('Overview & All Commands')
      .setValue('all')
      .setDescription('Complete command list and summary')
      .setEmoji('📋')
      .setDefault(selectedCategory === 'all'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Quick Start Guide')
      .setValue('quickstart')
      .setDescription('Step-by-step tutorial for new users')
      .setEmoji('🚀')
      .setDefault(selectedCategory === 'quickstart'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Task Management Commands')
      .setValue('tasks')
      .setDescription('Add, list, complete, and remove tasks')
      .setEmoji('📝')
      .setDefault(selectedCategory === 'tasks'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Group Management Commands')
      .setValue('groups')
      .setDescription('Create, list, and delete task categories')
      .setEmoji('📁')
      .setDefault(selectedCategory === 'groups'),
    new StringSelectMenuOptionBuilder()
      .setLabel('General & Utilities')
      .setValue('general')
      .setDescription('Ping and help menu commands')
      .setEmoji('⚙️')
      .setDefault(selectedCategory === 'general'),
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help-category-select')
    .setPlaceholder('Select a category to view details...')
    .setDisabled(disabled)
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
}

export function setupHelpCollector(replyMessage: any, authorId: string) {
  if (!replyMessage || typeof replyMessage.createMessageComponentCollector !== 'function') {
    return;
  }

  const collector = replyMessage.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60_000,
  });

  collector.on('collect', async (i: any) => {
    if (i.user.id !== authorId) {
      await i.reply({
        content: 'This help menu was requested by someone else. Use `/help` to open your own menu!',
        ephemeral: true,
      });
      return;
    }

    const selected = i.values[0] || 'all';
    const updatedEmbed = buildHelpEmbed(selected, i.user.displayName ?? i.user.username);
    const updatedRow = buildSelectRow(selected, false);

    await i.update({
      embeds: [updatedEmbed],
      components: [updatedRow],
    });
  });

  collector.on('end', async (_collected: any, reason: string) => {
    if (reason === 'messageDelete') return;
    try {
      const disabledRow = buildSelectRow('all', true);
      await replyMessage.edit({
        components: [disabledRow],
      });
    } catch {
      // Ignored if message was deleted or cannot be edited
    }
  });
}

export default {
  name: 'help',
  description: 'Displays the help menu with all available commands and getting started guide',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays the help menu with all available commands and getting started guide')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Optionally select a category to jump directly to')
        .setRequired(false)
        .addChoices(
          { name: 'Overview & All Commands', value: 'all' },
          { name: 'Quick Start Guide', value: 'quickstart' },
          { name: 'Task Commands', value: 'tasks' },
          { name: 'Group Commands', value: 'groups' },
          { name: 'General Commands', value: 'general' }
        )
    ),
  async execute(message: any, args: string[] = []) {
    const category = args[1] || 'all';
    const embed = buildHelpEmbed(category, message.author?.displayName ?? message.author?.username);
    const row = buildSelectRow(category, false);

    const response = await message.reply({
      embeds: [embed],
      components: [row],
    });

    setupHelpCollector(response, message.author?.id);
  },
  async executeSlash(interaction: any) {
    const category = interaction.options?.getString('category') || 'all';
    const embed = buildHelpEmbed(category, interaction.user?.displayName ?? interaction.user?.username);
    const row = buildSelectRow(category, false);

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    setupHelpCollector(response, interaction.user?.id);
  },
};
