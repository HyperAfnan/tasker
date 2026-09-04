import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is missing in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  const isGlobal = process.argv.includes('--global');
  const isClear = process.argv.includes('--clear');

  const guildArgIndex = process.argv.indexOf('--guild');
  const targetGuildId = guildArgIndex !== -1 ? process.argv[guildArgIndex + 1] : process.env.GUILD_ID?.trim();

  const app: any = await rest.get(Routes.oauth2CurrentApplication());
  const clientId = app.id;
  console.log(`🤖 Application: ${app.name} (Client ID: ${clientId})`);

  let commands: any[] = [];

  if (!isClear) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of commandFiles) {
      const mod = await import(`../commands/${file}`);
      const cmd = mod.default ?? mod;
      if (cmd && cmd.data) {
        commands.push(typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data);
      }
    }
  }

  if (isClear) {
    if (isGlobal) {
      console.log('🧹 Clearing all global slash commands...');
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log('✅ Cleared all global slash commands.');
    } else if (targetGuildId) {
      console.log(`🧹 Clearing all slash commands from guild ${targetGuildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, targetGuildId), { body: [] });
      console.log(`✅ Cleared all slash commands from guild ${targetGuildId}.`);
    } else {
      console.log('🧹 Clearing all guild-specific slash commands across all connected guilds...');
      const guilds: any = await rest.get(Routes.userGuilds());
      for (const g of guilds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, g.id), { body: [] });
          console.log(`✅ Cleared guild commands for "${g.name}" (${g.id}).`);
        } catch (err: any) {
          console.error(`❌ Failed to clear guild ${g.name} (${g.id}):`, err.message);
        }
      }
    }
    return;
  }

  if (isGlobal) {
    console.log(`📡 Deploying ${commands.length} commands globally...`);
    const data: any = await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`✅ Successfully deployed ${data.length} global commands:`);
    for (const c of data) {
      console.log(`   - /${c.name} (ID: ${c.id})`);
    }
  } else if (targetGuildId) {
    console.log(`⚡ Deploying ${commands.length} commands directly to Guild ${targetGuildId}...`);
    const data: any = await rest.put(Routes.applicationGuildCommands(clientId, targetGuildId), { body: commands });
    console.log(`✅ Successfully deployed ${data.length} commands to guild ${targetGuildId}:`);
    for (const c of data) {
      console.log(`   - /${c.name} (ID: ${c.id})`);
    }
    console.log('🎉 Commands are now available immediately in your server!');
  } else {
    // If no guild specified and not explicitly global, deploy to all guilds bot is currently in
    const guilds: any = await rest.get(Routes.userGuilds());
    console.log(`⚡ Deploying ${commands.length} commands to ${guilds.length} connected guild(s)...`);
    for (const g of guilds) {
      try {
        const data: any = await rest.put(Routes.applicationGuildCommands(clientId, g.id), { body: commands });
        console.log(`✅ Deployed ${data.length} commands to guild "${g.name}" (${g.id})`);
      } catch (err: any) {
        console.error(`❌ Failed to deploy to guild ${g.name} (${g.id}):`, err.message);
      }
    }
  }
}

deploy().catch((err) => {
  console.error('❌ Deployment error:', err);
  process.exit(1);
});
