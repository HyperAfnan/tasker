import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { disconnectDB } from './db';

const token = process.env.DISCORD_TOKEN;
const prefix = "'";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

async function init() {
  (client as any).commands = new Collection();

  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of commandFiles) {
      const mod = await import(`./commands/${file}`);
      const command = mod.default ?? mod;
      if (command && command.name) (client as any).commands.set(command.name, command);
    }
  }

  const eventsPath = path.join(__dirname, 'events');
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of eventFiles) {
      const mod = await import(`./events/${file}`);
      const ev = mod.default ?? mod;
      if (ev && ev.name && ev.execute) {
        if (ev.once) client.once(ev.name, (...args: any[]) => ev.execute(...args, { client, prefix }));
        else client.on(ev.name, (...args: any[]) => ev.execute(...args, { client, prefix }));
      }
    }
  }

  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await disconnectDB();
    process.exit(0);
  });

  await client.login(token);
}

void init();
