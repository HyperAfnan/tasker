import { Events } from 'discord.js';
import { connectDB } from '../db';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: any) {
    console.log(`Logged in as ${client.user.tag}`);
    await connectDB();
  },
};
