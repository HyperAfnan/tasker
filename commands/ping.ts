export default {
  name: 'ping',
  description: 'Replies with Pong',
  async execute(message: any) {
    await message.reply('Pong!');
  },
};
