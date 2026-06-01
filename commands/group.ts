import { createGroup, getGroups, deleteGroup, groupExists } from '../models/Group';
import { clearTasksGroup } from '../models/Task';
import { embedder } from '../utils/embed';

export default {
  name: 'group',
  description: 'Group operations: create, list, delete',
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
    } else {
      await message.reply({ embeds: [embedder('Unknown subcommand. Available: create, list, delete', undefined, '#ff0000')] });
    }
  },
};
