import { createTask, getTasks, updateTaskStatus, deleteTask } from '../models/Task';
import { getGroups, getGroupByName } from '../models/Group';
import { embedder } from '../utils/embed';

export default {
  name: 'task',
  description: 'Task operations: add, list, done, remove',
  async execute(message: any, args: string[]) {
    const subcommand = args[1]?.toLowerCase();
    if (subcommand === 'add') {
      const groupName = args[2];
      const taskContent = args.slice(3).join(' ');
      if (!groupName || !taskContent) {
        await message.reply({ embeds: [embedder("Usage: `'task add [group_name] [task_content]`", undefined, '#ff0000')] });
        return;
      }

      const group = await getGroupByName(message.author.id, groupName);
      if (!group || !group._id) {
        await message.reply({ embeds: [embedder(`Group "${groupName}" does not exist. Create it with \'group create ${groupName}\'`, undefined, '#ff0000')] });
        return;
      }

      await createTask(message.author.id, taskContent, group._id);
      await message.reply({ embeds: [embedder(`Task added to **${groupName}**: **${taskContent}**`, undefined, '#00ff00')] });
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

      await message.reply({ embeds: [embedder(taskList, `${message.author.displayName}'s Tasks for Today`)] });
    } else if (subcommand === 'done') {
      const taskIndexStr = args[2];
      if (!taskIndexStr) {
        await message.reply({ embeds: [embedder("Usage: `'task done [task number]`", undefined, '#ff0000')] });
        return;
      }
      const taskIndex = parseInt(taskIndexStr);
      if (isNaN(taskIndex) || taskIndex < 1) {
        await message.reply({ embeds: [embedder('Please provide a valid task number.', undefined, '#ff0000')] });
        return;
      }
      const tasks = await getTasks(message.author.id);
      if (taskIndex > tasks.length) {
        await message.reply({ embeds: [embedder(`Task number ${taskIndex} not found.`, undefined, '#ff0000')] });
        return;
      }
      const task = tasks[taskIndex - 1];
      if (task && task._id) {
        const updated = await updateTaskStatus(task._id, 'completed');
        if (updated) await message.reply({ embeds: [embedder(`Task marked as done: **${updated.content}**`, undefined, '#00ff00')] });
      }
    } else if (subcommand === 'remove') {
      const taskIndexStr = args[2];
      if (!taskIndexStr) {
        await message.reply({ embeds: [embedder("Usage: `'task remove [task number]`", undefined, '#ff0000')] });
        return;
      }
      const taskIndex = parseInt(taskIndexStr);
      if (isNaN(taskIndex) || taskIndex < 1) {
        await message.reply({ embeds: [embedder('Please provide a valid task number.', undefined, '#ff0000')] });
        return;
      }
      const tasks = await getTasks(message.author.id);
      if (taskIndex > tasks.length) {
        await message.reply({ embeds: [embedder(`Task number ${taskIndex} not found.`, undefined, '#ff0000')] });
        return;
      }
      const task = tasks[taskIndex - 1];
      if (task && task._id) {
        const deleted = await deleteTask(task._id);
        if (deleted) await message.reply({ embeds: [embedder(`Task removed: **${task.content}**`, undefined, '#00ff00')] });
      }
    } else {
      await message.reply({ embeds: [embedder('Unknown subcommand. Available: add, list, done, remove', undefined, '#ff0000')] });
    }
  },
};
