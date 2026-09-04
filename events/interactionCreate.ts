import { Events, MessageFlags, type Interaction } from 'discord.js';

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction, context: any) {
    const { client } = context;

    if (typeof (interaction as any).isAutocomplete === 'function' && interaction.isAutocomplete()) {
      const command = client?.commands?.get(interaction.commandName);
      if (!command || typeof command.autocomplete !== 'function') return;

      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
      return;
    }

    if (typeof (interaction as any).isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('task_select_')) {
        const command = client?.commands?.get('task');
        if (command && typeof command.executeSelectMenu === 'function') {
          try {
            await command.executeSelectMenu(interaction);
          } catch (err) {
            console.error('Task select menu error:', err);
          }
          return;
        }
      }
    }

    if (typeof (interaction as any).isModalSubmit === 'function' && interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('task_modal_update_')) {
        const command = client?.commands?.get('task');
        if (command && typeof command.executeModal === 'function') {
          try {
            await command.executeModal(interaction);
          } catch (err) {
            console.error('Task modal submission error:', err);
          }
          return;
        }
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client?.commands?.get(interaction.commandName);
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
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
