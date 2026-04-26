import { ObjectId } from "mongodb";
import { getDB } from "../db";

export interface Task {
	_id?: ObjectId;
	userId: string;
	content: string;
	status: "pending" | "completed";
	createdAt: Date;
	updatedAt: Date;
}

export async function getTasksCollection() {
	const db = getDB();
	return db.collection<Task>("tasks");
}

export async function createTask(userId: string, content: string): Promise<Task> {
	const collection = await getTasksCollection();
	const task: Omit<Task, "_id"> = {
		userId,
		content,
		status: "pending",
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	const result = await collection.insertOne(task as Task);
	return { _id: result.insertedId, ...task };
}

export async function updateTaskStatus(taskId: ObjectId, status: "pending" | "completed"): Promise<Task | null> {
	const collection = await getTasksCollection();
	const result = await collection.findOneAndUpdate(
		{ _id: taskId },
		{ $set: { status, updatedAt: new Date() } },
		{ returnDocument: "after" }
	);
	return result as Task | null;
}

export async function getUserTasks(userId: string): Promise<Task[]> {
	const collection = await getTasksCollection();
	return collection.find({ userId }).toArray();
}

export async function getTodaysTasks(userId: string): Promise<Task[]> {
	const collection = await getTasksCollection();
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	return collection
		.find({
			userId,
			createdAt: { $gte: today, $lt: tomorrow },
		})
		.toArray();
}

export async function deleteTask(taskId: ObjectId): Promise<boolean> {
	const collection = await getTasksCollection();
	const result = await collection.deleteOne({ _id: taskId });
	return result.deletedCount > 0;
}
