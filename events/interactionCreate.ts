import { Events, type Interaction } from 'discord.js';

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction, context: any) {
    if (!interaction.isChatInputCommand()) return;

    const { client } = context;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      if (command.executeSlash) {
        await command.executeSlash(interaction);
      } else if (command.execute) {
        await command.execute(interaction);
      }
    } catch (err) {
      console.error('Interaction error:', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command.',
          ephemeral: true,
        });
      }
    }
  },
};
