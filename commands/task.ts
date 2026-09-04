import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { ObjectId } from 'mongodb';
import {
  createTask,
  getTasks,
  updateTaskStatus,
  deleteTask,
  updateTaskContent,
  getTaskById,
} from '../models/Task';
import { getGroups, getGroupByName, getOrCreateDefaultGroup, DEFAULT_GROUP_NAME } from '../models/Group';
import { embedder } from '../utils/embed';

async function resolveTask(taskInput: string, userId: string): Promise<any | null> {
  if (!taskInput) return null;

  if (ObjectId.isValid(taskInput) && taskInput.length === 24) {
    try {
      const found = await getTaskById(new ObjectId(taskInput));
      if (found) return found;
    } catch {
    }
  }

  const allTasks = await getTasks(userId);

  const num = parseInt(taskInput, 10);
  if (!isNaN(num) && num >= 1 && num <= allTasks.length) {
    return allTasks[num - 1];
  }

  const exact = allTasks.find((t) => t.content.toLowerCase() === taskInput.toLowerCase());
  if (exact) return exact;

  const partial = allTasks.find((t) => t.content.toLowerCase().includes(taskInput.toLowerCase()));
  if (partial) return partial;

  return null;
}

export default {
  name: 'task',
  description: 'Task operations: add, list, done, remove, rename',
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('Task operations: add, list, done, remove, rename')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a new task to a group')
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('The task description/content')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('group')
            .setDescription('The group name for this task (optional, defaults to "Default")')
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription("List all of today's tasks grouped by category")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('done')
        .setDescription('Mark a task as completed')
        .addStringOption((option) =>
          option
            .setName('task')
            .setDescription('The task to mark as completed')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a task')
        .addStringOption((option) =>
          option
            .setName('task')
            .setDescription('The task to remove')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rename')
        .setDescription('Rename / edit a task')
        .addStringOption((option) =>
          option
            .setName('task')
            .setDescription('The task to rename')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('new_content')
            .setDescription('The new content for this task')
            .setRequired(true)
        )
    ),

  async autocomplete(interaction: any) {
    const focusedOption = interaction.options.getFocused(true);
    const userId = interaction.user.id;

    if (focusedOption.name === 'group') {
      try {
        const groups = await getGroups(userId);
        const query = focusedOption.value?.toLowerCase() ?? '';
        const groupNames = groups.map((g) => g.groupName);
        if (!groupNames.some((name) => name.toLowerCase() === DEFAULT_GROUP_NAME.toLowerCase())) {
          groupNames.unshift(DEFAULT_GROUP_NAME);
        }
        const filtered = groupNames
          .filter((name) => name.toLowerCase().includes(query))
          .slice(0, 25);
        await interaction.respond(
          filtered.map((name) => ({ name, value: name }))
        );
      } catch (err) {
        console.error('Task group autocomplete error:', err);
      }
    } else if (focusedOption.name === 'task') {
      try {
        const subcommand = interaction.options.getSubcommand(false);
        const tasks = await getTasks(userId);
        const query = focusedOption.value?.toLowerCase() ?? '';

        let candidateTasks = tasks;
        if (subcommand === 'done') {
          const pending = tasks.filter((t) => t.status !== 'completed');
          candidateTasks = pending.length > 0 ? pending : tasks;
        }

        const filtered = candidateTasks
          .filter((t) => t.content.toLowerCase().includes(query))
          .slice(0, 25);

        await interaction.respond(
          filtered.map((t) => {
            const statusIcon = t.status === 'completed' ? '✅' : '⏳';
            const label = `${statusIcon} ${t.content}`.slice(0, 100);
            const idStr = t._id
              ? typeof t._id.toHexString === 'function'
                ? t._id.toHexString()
                : String(t._id)
              : t.content;
            return { name: label, value: idStr };
          })
        );
      } catch (err) {
        console.error('Task item autocomplete error:', err);
      }
    }
  },

  async executeSlash(interaction: any) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const userDisplayName = interaction.user.displayName ?? interaction.user.username;

    if (subcommand === 'add') {
      const taskContent = interaction.options.getString('content')?.trim();
      const groupName = interaction.options.getString('group')?.trim();

      if (!taskContent) {
        await interaction.reply({
          embeds: [embedder('⚠️ Please specify **content** for the task.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let targetGroup;
      if (!groupName || groupName.toLowerCase() === DEFAULT_GROUP_NAME.toLowerCase()) {
        targetGroup = await getOrCreateDefaultGroup(userId);
      } else {
        const existingGroup = await getGroupByName(userId, groupName);
        if (!existingGroup || !existingGroup._id) {
          await interaction.reply({
            embeds: [
              embedder(
                `Group "${groupName}" does not exist. Create it with \`/group create name:${groupName}\``,
                undefined,
                '#ff0000'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        targetGroup = existingGroup;
      }

      await createTask(userId, taskContent, targetGroup._id!);
      await interaction.reply({
        embeds: [embedder(`Task added to **${targetGroup.groupName}**: **${taskContent}**`, undefined, '#00ff00')],
      });
    } else if (subcommand === 'list') {
      const tasks = await getTasks(userId);
      const groups = await getGroups(userId);
      const groupNameById = new Map<string, string>();
      for (const group of groups) {
        if (group._id) {
          const idStr = typeof group._id.toHexString === 'function' ? group._id.toHexString() : String(group._id);
          groupNameById.set(idStr, group.groupName);
        }
      }

      if (tasks.length === 0) {
        await interaction.reply({ embeds: [embedder('You have no tasks for today!', undefined, '#00ff00')] });
        return;
      }

      const groupedKeys = Array.from(
        new Set(
          tasks
            .map((task) => {
              if (task.groupId) {
                const idStr = typeof task.groupId.toHexString === 'function' ? task.groupId.toHexString() : String(task.groupId);
                return groupNameById.get(idStr) ?? 'Unnamed Group';
              }
              return (task as any).group && (task as any).group !== 'default' ? String((task as any).group) : null;
            })
            .filter((groupName): groupName is string => Boolean(groupName))
        )
      ).sort();

      let taskList = '';

      for (const groupName of groupedKeys) {
        taskList += `\n**📁 ${groupName}**\n`;
        tasks.forEach((task, idx) => {
          const currentGroupId = task.groupId
            ? typeof task.groupId.toHexString === 'function'
              ? task.groupId.toHexString()
              : String(task.groupId)
            : null;
          const currentGroupName = currentGroupId
            ? groupNameById.get(currentGroupId)
            : (task as any).group && (task as any).group !== 'default'
              ? String((task as any).group)
              : null;
          if (currentGroupName === groupName) {
            const status = task.status === 'completed' ? '✅' : '[  ]';
            taskList += `${idx + 1}. ${status} ${task.content}\n`;
          }
        });
      }

      const ungrouped = tasks
        .map((t, i) => ({ t, i }))
        .filter((x) => !x.t.groupId && (!(x.t as any).group || (x.t as any).group === 'default'));
      if (ungrouped.length > 0) {
        taskList += `\n**📝 Other Tasks**\n`;
        ungrouped.forEach(({ t, i }) => {
          const status = t.status === 'completed' ? '✅' : '[  ]';
          taskList += `${i + 1}. ${status} ${t.content}\n`;
        });
      }

      await interaction.reply({ embeds: [embedder(taskList, `${userDisplayName}'s Tasks`)] });
    } else if (subcommand === 'done') {
      const taskInput = interaction.options.getString('task')?.trim();
      const task = await resolveTask(taskInput, userId);

      if (!task || !task._id) {
        await interaction.reply({
          embeds: [embedder('⚠️ Task not found. Please pick a task from the autocomplete suggestions.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await updateTaskStatus(task._id, 'completed');
      await interaction.reply({
        embeds: [embedder(`✅ Task marked as done: **${task.content}**`, undefined, '#00ff00')],
      });
    } else if (subcommand === 'remove') {
      const taskInput = interaction.options.getString('task')?.trim();
      const task = await resolveTask(taskInput, userId);

      if (!task || !task._id) {
        await interaction.reply({
          embeds: [embedder('⚠️ Task not found. Please pick a task from the autocomplete suggestions.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await deleteTask(task._id);
      await interaction.reply({
        embeds: [embedder(`🗑️ Task removed: **${task.content}**`, undefined, '#00ff00')],
      });
    } else if (subcommand === 'rename') {
      const taskInput = interaction.options.getString('task')?.trim();
      const newContent = interaction.options.getString('new_content')?.trim();

      if (!newContent) {
        await interaction.reply({
          embeds: [embedder('⚠️ Please provide the new content for the task.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const task = await resolveTask(taskInput, userId);
      if (!task || !task._id) {
        await interaction.reply({
          embeds: [embedder('⚠️ Task not found. Please pick a task from the autocomplete suggestions.', undefined, '#ff0000')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const updated = await updateTaskContent(task._id, newContent);
      const displayContent = updated ? updated.content : newContent;
      await interaction.reply({
        embeds: [embedder(`✏️ Task renamed to: **${displayContent}**`, undefined, '#00ff00')],
      });
    }
  },

  async execute(message: any, args: string[]) {
    const subcommand = args[1]?.toLowerCase();
    if (subcommand === 'add') {
      if (args.length < 3) {
        await message.reply({ embeds: [embedder("Usage: `'task add [task_content]` or `'task add [group_name] [task_content]`", undefined, '#ff0000')] });
        return;
      }

      let targetGroup;
      let taskContent = '';

      const potentialGroupName = args[2]!;
      const isDefault = potentialGroupName.toLowerCase() === DEFAULT_GROUP_NAME.toLowerCase();
      const existingGroup = isDefault ? null : await getGroupByName(message.author.id, potentialGroupName);

      if ((existingGroup || isDefault) && args.length > 3) {
        targetGroup = existingGroup || (await getOrCreateDefaultGroup(message.author.id));
        taskContent = args.slice(3).join(' ');
      } else {
        targetGroup = await getOrCreateDefaultGroup(message.author.id);
        taskContent = args.slice(2).join(' ');
      }

      await createTask(message.author.id, taskContent, targetGroup._id!);
      await message.reply({ embeds: [embedder(`Task added to **${targetGroup.groupName}**: **${taskContent}**`, undefined, '#00ff00')] });
    } else if (subcommand === 'list' || subcommand === 'show') {
      const tasks = await getTasks(message.author.id);
      const groups = await getGroups(message.author.id);
      const groupNameById = new Map<string, string>();
      for (const group of groups) {
        if (group._id) groupNameById.set(group._id.toHexString(), group.groupName);
      }

      if (tasks.length === 0) {
        await message.reply({ embeds: [embedder('You have no tasks for today!', undefined, '#00ff00')] });
        return;
      }

      const groupedKeys = Array.from(
        new Set(
          tasks
            .map((task) => {
              if (task.groupId) {
                return groupNameById.get(task.groupId.toHexString()) ?? 'Unnamed Group';
              }
              return (task as any).group && (task as any).group !== 'default' ? String((task as any).group) : null;
            })
            .filter((groupName): groupName is string => Boolean(groupName))
        )
      ).sort();

      let taskList = '';

      for (const groupName of groupedKeys) {
        taskList += `\n**📁 ${groupName}**\n`;
        tasks.forEach((task, idx) => {
          const currentGroupName = task.groupId
            ? groupNameById.get(task.groupId.toHexString())
            : (task as any).group && (task as any).group !== 'default'
              ? String((task as any).group)
              : null;
          if (currentGroupName === groupName) {
            const status = task.status === 'completed' ? '✅' : '[  ]';
            taskList += `${idx + 1}. ${status} ${task.content}\n`;
          }
        });
      }

      // Ungrouped tasks
      const ungrouped = tasks
        .map((t, i) => ({ t, i }))
        .filter((x) => !x.t.groupId && (!(x.t as any).group || (x.t as any).group === 'default'));
      if (ungrouped.length > 0) {
        taskList += `\n**📝 Other Tasks**\n`;
        ungrouped.forEach(({ t, i }) => {
          const status = t.status === 'completed' ? '✅' : '[  ]';
          taskList += `${i + 1}. ${status} ${t.content}\n`;
        });
      }

      await message.reply({ embeds: [embedder(taskList, `${message.author.displayName}'s Tasks`)] });
    } else if (subcommand === 'done') {
      const taskIndexStr = args[2];
      if (!taskIndexStr) {
        await message.reply({ embeds: [embedder("Usage: `'task done [task number]`", undefined, '#ff0000')] });
        return;
      }
      const task = await resolveTask(taskIndexStr, message.author.id);
      if (!task || !task._id) {
        await message.reply({ embeds: [embedder(`Task "${taskIndexStr}" not found.`, undefined, '#ff0000')] });
        return;
      }
      const updated = await updateTaskStatus(task._id, 'completed');
      if (updated) await message.reply({ embeds: [embedder(`Task marked as done: **${updated.content}**`, undefined, '#00ff00')] });
    } else if (subcommand === 'remove') {
      const taskIndexStr = args[2];
      if (!taskIndexStr) {
        await message.reply({ embeds: [embedder("Usage: `'task remove [task number]`", undefined, '#ff0000')] });
        return;
      }
      const task = await resolveTask(taskIndexStr, message.author.id);
      if (!task || !task._id) {
        await message.reply({ embeds: [embedder(`Task "${taskIndexStr}" not found.`, undefined, '#ff0000')] });
        return;
      }
      const deleted = await deleteTask(task._id);
      if (deleted) await message.reply({ embeds: [embedder(`Task removed: **${task.content}**`, undefined, '#00ff00')] });
    } else if (subcommand === 'rename' || subcommand === 'update' || subcommand === 'edit') {
      const taskIndexStr = args[2];
      const newContent = args.slice(3).join(' ');
      if (!taskIndexStr || !newContent) {
        await message.reply({ embeds: [embedder("Usage: `'task rename [task number] [new content]`", undefined, '#ff0000')] });
        return;
      }
      const task = await resolveTask(taskIndexStr, message.author.id);
      if (!task || !task._id) {
        await message.reply({ embeds: [embedder(`Task "${taskIndexStr}" not found.`, undefined, '#ff0000')] });
        return;
      }
      const updated = await updateTaskContent(task._id, newContent);
      if (updated) await message.reply({ embeds: [embedder(`Task renamed to: **${updated.content}**`, undefined, '#00ff00')] });
    } else {
      await message.reply({ embeds: [embedder('Unknown subcommand. Available: add, list, done, remove, rename', undefined, '#ff0000')] });
    }
  },
};
