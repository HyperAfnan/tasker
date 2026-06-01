import { EmbedBuilder } from 'discord.js';

export function embedder(content: string, title?: string, color: any = '#3498DB') {
  const embed = new EmbedBuilder().setDescription(content).setColor(color);
  if (title) embed.setTitle(title);
  return embed;
}
