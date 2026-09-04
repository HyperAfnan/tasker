import { ObjectId } from "mongodb";
import { getDB } from "../db";

export interface Task {
	_id?: ObjectId;
	userId: string;
	content: string;
	status: "pending" | "completed";
	groupId?: ObjectId | null;
	createdAt: Date;
	updatedAt: Date;
}

export async function getTasksCollection() {
	const db = getDB();
	const collection = db.collection<Task>("tasks");

	await collection.createIndex({ userId: 1, createdAt: -1 });
	await collection.createIndex({ userId: 1, groupId: 1 });
	await collection.createIndex({ userId: 1, status: 1 });
	return collection;
}

export async function createTask(userId: string, content: string, groupId: ObjectId | null = null): Promise<Task> {
	const collection = await getTasksCollection();
	const task: Omit<Task, "_id"> = {
		userId,
		content,
		status: "pending",
		groupId,
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
	return result as unknown as Task | null;
}

export async function getTasks(userId: string): Promise<Task[]> {
	const collection = await getTasksCollection();
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	return collection
		.find({
			userId,
			$or: [
				{ createdAt: { $gte: today, $lt: tomorrow } },
				{ createdAt: { $lt: today }, status: "pending" },
				{ updatedAt: { $gte: today }, status: "completed" },
			],
		})
		.sort({ createdAt: 1, updatedAt: 1 })
		.toArray();
}

export async function deleteTask(taskId: ObjectId): Promise<boolean> {
	const collection = await getTasksCollection();
	const result = await collection.deleteOne({ _id: taskId });
	return result.deletedCount > 0;
}

export async function clearTasksGroup(groupId: ObjectId): Promise<number> {
	const collection = await getTasksCollection();
	const result = await collection.updateMany(
		{ groupId },
		{ $set: { groupId: null, updatedAt: new Date() } }
	);
	return result.modifiedCount;
}

export async function updateTaskContent(
	taskId: ObjectId,
	content: string,
	groupId?: ObjectId | null
): Promise<Task | null> {
	const collection = await getTasksCollection();
	const updateFields: any = { content, updatedAt: new Date() };
	if (groupId !== undefined) {
		updateFields.groupId = groupId;
	}
	const result = await collection.findOneAndUpdate(
		{ _id: taskId },
		{ $set: updateFields },
		{ returnDocument: "after" }
	);
	return result as unknown as Task | null;
}

export async function getTaskById(taskId: ObjectId): Promise<Task | null> {
	const collection = await getTasksCollection();
	return collection.findOne({ _id: taskId });
}


