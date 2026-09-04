import { Events } from 'discord.js';
import { connectDB } from '../db';

export async function registerSlashCommands(client: any) {
  const commandsCollection = client.commands;
  if (!commandsCollection) return [];

  const slashCommands: any[] = [];
  for (const [, cmd] of commandsCollection) {
    if (cmd.data) {
      slashCommands.push(typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data);
    }
  }

  if (slashCommands.length === 0) return [];

  const guildId = process.env.GUILD_ID;
  if (guildId) {
    const guild = client.guilds?.cache?.get(guildId);
    if (guild) {
      await guild.commands.set(slashCommands);
      console.log(`Registered ${slashCommands.length} slash commands to guild ${guildId}`);
      return slashCommands;
    }
    console.warn(`Guild ${guildId} not found in cache. Falling back to global registration.`);
  }

  if (client.application?.commands) {
    await client.application.commands.set(slashCommands);
    console.log(`Registered ${slashCommands.length} global slash commands.`);
  }

  return slashCommands;
}

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: any, context?: any) {
    console.log(`Logged in as ${client.user.tag}`);
    await connectDB();

    try {
      const activeClient = client.commands ? client : context?.client;
      if (activeClient) {
        await registerSlashCommands(activeClient);
      }
    } catch (err) {
      console.error('Failed to register slash commands on ready:', err);
    }
  },
};
