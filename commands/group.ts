import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { createGroup, getGroups, deleteGroup, groupExists, updateGroupName } from '../models/Group';
import { clearTasksGroup } from '../models/Task';
import { embedder } from '../utils/embed';

export default {
  name: 'group',
  description: 'Group operations: create, list, delete, rename',
  data: new SlashCommandBuilder()
    .setName('group')
    .setDescription('Group operations: create, list, delete, rename')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new group')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The name of the group to create')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all your groups')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a group and its associated tasks')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The name of the group to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rename')
        .setDescription('Rename an existing group')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The current group name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('new_name')
            .setDescription('The new name for the group')
            .setRequired(true)
        )
    ),

  async autocomplete(interaction: any) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'name') {
      try {
        const userId = interaction.user.id;
        const groups = await getGroups(userId);
        const query = focusedOption.value?.toLowerCase() ?? '';
        const filtered = groups
          .filter((g) => g.groupName.toLowerCase().includes(query))
          .slice(0, 25);
        await interaction.respond(
          filtered.map((g) => ({ name: g.groupName, value: g.groupName }))
        );
      } catch (err) {
        console.error('Group autocomplete error:', err);
      }
    }
  },

  async executeSlash(interaction: any) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const userDisplayName = interaction.user.displayName ?? interaction.user.username;

    if (subcommand === 'create') {
      const groupName = interaction.options.getString('name')?.trim();
      if (!groupName) {
        await interaction.reply({
          embeds: [embedder('Please specify a valid group name.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const exists = await groupExists(userId, groupName);
      if (exists) {
        await interaction.reply({
          embeds: [embedder(`Group "${groupName}" already exists.`, undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await createGroup(userId, groupName);
      await interaction.reply({ embeds: [embedder(`Group **${groupName}** created successfully!`, undefined, '#00ff00')] });
    } else if (subcommand === 'list') {
      const groups = await getGroups(userId);
      if (groups.length === 0) {
        await interaction.reply({
          embeds: [embedder("You have no groups yet. Create one with `/group create [name]`", undefined, '#00ff00')],
        });
        return;
      }
      let groupList = '';
      groups.forEach((group, index) => {
        groupList += `${index + 1}. **${group.groupName}**\n`;
      });
      await interaction.reply({ embeds: [embedder(groupList, `${userDisplayName}'s Groups`)] });
    } else if (subcommand === 'delete') {
      const groupName = interaction.options.getString('name')?.trim();
      if (!groupName) {
        await interaction.reply({
          embeds: [embedder('Please specify a group name to delete.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const groups = await getGroups(userId);
      const groupToDelete = groups.find((g) => g.groupName === groupName);
      if (!groupToDelete || !groupToDelete._id) {
        await interaction.reply({
          embeds: [embedder(`Group "${groupName}" not found.`, undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await clearTasksGroup(groupToDelete._id);
      const deleted = await deleteGroup(groupToDelete._id);
      if (deleted) {
        await interaction.reply({ embeds: [embedder(`Group **${groupName}** and its tasks were deleted successfully!`, undefined, '#00ff00')] });
      }
    } else if (subcommand === 'rename') {
      const oldName = interaction.options.getString('name')?.trim();
      const newName = interaction.options.getString('new_name')?.trim();
      if (!oldName || !newName) {
        await interaction.reply({
          embeds: [embedder('Please specify both the current group name and the new name.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const exists = await groupExists(userId, oldName);
      if (!exists) {
        await interaction.reply({
          embeds: [embedder(`Group "${oldName}" not found.`, undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const newExists = await groupExists(userId, newName);
      if (newExists) {
        await interaction.reply({
          embeds: [embedder(`A group named "${newName}" already exists.`, undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const renamed = await updateGroupName(userId, oldName, newName);
      if (renamed) {
        await interaction.reply({ embeds: [embedder(`Group **${oldName}** renamed to **${newName}**!`, undefined, '#00ff00')] });
      }
    }
  },

  async execute(message: any, args: string[]) {
    const subcommand = args[1]?.toLowerCase();
    if (subcommand === 'create') {
      const groupName = args[2];
      if (!groupName) {
        await message.reply({ embeds: [embedder("Usage: `'group create [group_name]`", undefined, '#ff0000')] });
        return;
      }
      const exists = await groupExists(message.author.id, groupName);
      if (exists) {
        await message.reply({ embeds: [embedder(`Group "${groupName}" already exists.`, undefined, '#ff0000')] });
        return;
      }
      await createGroup(message.author.id, groupName);
      await message.reply({ embeds: [embedder(`Group **${groupName}** created successfully!`, undefined, '#00ff00')] });
    } else if (subcommand === 'list') {
      const groups = await getGroups(message.author.id);
      if (groups.length === 0) {
        await message.reply({ embeds: [embedder("You have no groups yet. Create one with `'group create [group_name]`", undefined, '#00ff00')] });
        return;
      }
      let groupList = '';
      groups.forEach((group, index) => {
        groupList += `${index + 1}. **${group.groupName}**\n`;
      });
      await message.reply({ embeds: [embedder(groupList, `${message.author.displayName}'s Groups`)] });
    } else if (subcommand === 'delete') {
      const groupName = args[2];
      if (!groupName) {
        await message.reply({ embeds: [embedder("Usage: `'group delete [group_name]`", undefined, '#ff0000')] });
        return;
      }
      const groups = await getGroups(message.author.id);
      const groupToDelete = groups.find((g) => g.groupName === groupName);
      if (!groupToDelete || !groupToDelete._id) {
        await message.reply({ embeds: [embedder(`Group "${groupName}" not found.`, undefined, '#ff0000')] });
        return;
      }
      await clearTasksGroup(groupToDelete._id);
      const deleted = await deleteGroup(groupToDelete._id);
      if (deleted) await message.reply({ embeds: [embedder(`Group **${groupName}** deleted successfully!`, undefined, '#00ff00')] });
    } else if (subcommand === 'rename') {
      const oldName = args[2];
      const newName = args[3];
      if (!oldName || !newName) {
        await message.reply({ embeds: [embedder("Usage: `'group rename [old_group_name] [new_group_name]`", undefined, '#ff0000')] });
        return;
      }
      const exists = await groupExists(message.author.id, oldName);
      if (!exists) {
        await message.reply({ embeds: [embedder(`Group "${oldName}" not found.`, undefined, '#ff0000')] });
        return;
      }
      const newExists = await groupExists(message.author.id, newName);
      if (newExists) {
        await message.reply({ embeds: [embedder(`A group named "${newName}" already exists.`, undefined, '#ff0000')] });
        return;
      }
      const renamed = await updateGroupName(message.author.id, oldName, newName);
      if (renamed) await message.reply({ embeds: [embedder(`Group **${oldName}** renamed to **${newName}**!`, undefined, '#00ff00')] });
    } else {
      await message.reply({ embeds: [embedder('Unknown subcommand. Available: create, list, delete, rename', undefined, '#ff0000')] });
    }
  },
};
