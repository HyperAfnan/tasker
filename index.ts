import { Client, Events, GatewayIntentBits } from "discord.js";
import { connectDB, disconnectDB } from "./db";
import { createTask, getTodaysTasks, updateTaskStatus, deleteTask } from "./models/Task";
import { ObjectId } from "mongodb";

const token = process.env.DISCORD_TOKEN;
const prefix = "'";

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Logged in as ${readyClient.user.tag}`);
	await connectDB();
});

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	const args = message.content.slice(prefix.length).trim().split(/\s+/);
	const command = args[0]?.toLowerCase();

	if (command === "ping") {
		await message.reply("Pong!");
	}

	if (command === "task") {
		const subcommand = args[1]?.toLowerCase();

		if (subcommand === "add") {
			const content = args.slice(2).join(" ");
			if (!content) {
				await message.reply("Usage: `'task add [task content]`");
				return;
			}

			await createTask(message.author.id, content);
			await message.reply(`✅ Task added: **${content}**`);
		} else if (subcommand === "list" || subcommand === "show") {
			const tasks = await getTodaysTasks(message.author.id);

			if (tasks.length === 0) {
				await message.reply("No tasks for today.");
				return;
			}

			let taskList = "📋 **Today's Tasks:**\n";
			tasks.forEach((task, index) => {
				const status = task.status === "completed" ? "✅" : "⏳";
				taskList += `${index + 1}. ${status} ${task.content} (ID: ${task._id})\n`;
			});

			await message.reply(taskList);
		} else if (subcommand === "done") {
			const taskIndexStr = args[2];
			if (!taskIndexStr) {
				await message.reply("Usage: `'task done [task number]`");
				return;
			}

			const taskIndex = parseInt(taskIndexStr);
			if (isNaN(taskIndex) || taskIndex < 1) {
				await message.reply("Please provide a valid task number.");
				return;
			}

			const tasks = await getTodaysTasks(message.author.id);
			if (taskIndex > tasks.length) {
				await message.reply(`Task number ${taskIndex} not found.`);
				return;
			}

			const task = tasks[taskIndex - 1];
			if (task && task._id) {
				const updated = await updateTaskStatus(task._id, "completed");
				if (updated) {
					await message.reply(`✅ Task marked as done: **${updated.content}**`);
				}
			}
		} else if (subcommand === "remove") {
			const taskIndexStr = args[2];
			if (!taskIndexStr) {
				await message.reply("Usage: `'task remove [task number]`");
				return;
			}

			const taskIndex = parseInt(taskIndexStr);
			if (isNaN(taskIndex) || taskIndex < 1) {
				await message.reply("Please provide a valid task number.");
				return;
			}

			const tasks = await getTodaysTasks(message.author.id);
			if (taskIndex > tasks.length) {
				await message.reply(`Task number ${taskIndex} not found.`);
				return;
			}

			const task = tasks[taskIndex - 1];
			if (task && task._id) {
				const deleted = await deleteTask(task._id);
				if (deleted) {
					await message.reply(`🗑️ Task removed: **${task.content}**`);
				}
			}
		} else {
			await message.reply(
				"Usage:\n`'task add [content]` - Add a task\n`'task list` - Show today's tasks\n`'task done [number]` - Mark task as done\n`'task remove [number]` - Remove a task"
			);
		}
	}
});


process.on("SIGINT", async () => {
	console.log("Shutting down gracefully...");
	await disconnectDB();
	process.exit(0);
});
void client.login(token);