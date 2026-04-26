import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

const mongoUrl = process.env.MONGODB_URI;

if (!mongoUrl) {
	console.error("Missing MONGODB_URI environment variable.");
	process.exit(1);
}

export async function connectDB(): Promise<Db> {
	if (db) {
		console.log("Already connected to MongoDB");
		return db;
	}

	try {
		client = new MongoClient(mongoUrl!);
		await client.connect();
		db = client.db();
		console.log("Connected to MongoDB");

		// Create indexes
		const tasksCollection = db.collection("tasks");
		await tasksCollection.createIndex({ userId: 1 });
		await tasksCollection.createIndex({ createdAt: -1 });

		return db;
	} catch (error) {
		console.error("Failed to connect to MongoDB:", error);
		process.exit(1);
	}
}

export function getDB(): Db {
	if (!db) {
		throw new Error("Database not initialized. Call connectDB() first.");
	}
	return db;
}

export async function disconnectDB(): Promise<void> {
	if (client) {
		await client.close();
		db = null;
		client = null;
		console.log("Disconnected from MongoDB");
	}
}
