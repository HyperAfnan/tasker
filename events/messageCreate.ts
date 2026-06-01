import { Events } from 'discord.js';

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message: any, context: any) {
    const { prefix, client } = context;
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args[0]?.toLowerCase();
    if (!commandName) return;

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args);
    } catch (err) {
      console.error('Command error', err);
      await message.reply('There was an error while executing that command.');
    }
  },
};
