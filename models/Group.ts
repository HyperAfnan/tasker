import { ObjectId } from "mongodb";
import { getDB } from "../db";

export interface Group {
	_id?: ObjectId;
	userId: string;
	groupName: string;
	createdAt: Date;
	updatedAt: Date;
}

export async function getGroupsCollection() {
	const db = getDB();
	return db.collection<Group>("groups");
}

export async function createGroup(userId: string, groupName: string): Promise<Group> {
	const collection = await getGroupsCollection();
	const group: Omit<Group, "_id"> = {
		userId,
		groupName,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	const result = await collection.insertOne(group as Group);
	return { _id: result.insertedId, ...group };
}

export async function getGroups(userId: string): Promise<Group[]> {
	const collection = await getGroupsCollection();
	return collection.find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function getGroupByName(userId: string, groupName: string): Promise<Group | null> {
	const collection = await getGroupsCollection();
	return collection.findOne({ userId, groupName });
}

export async function getGroupById(groupId: ObjectId): Promise<Group | null> {
	const collection = await getGroupsCollection();
	return collection.findOne({ _id: groupId });
}

export async function deleteGroup(groupId: ObjectId): Promise<boolean> {
	const collection = await getGroupsCollection();
	const result = await collection.deleteOne({ _id: groupId });
	return result.deletedCount > 0;
}

export async function groupExists(userId: string, groupName: string): Promise<boolean> {
	const collection = await getGroupsCollection();
	const group = await collection.findOne({ userId, groupName });
	return group !== null;
}

export async function updateGroupName(userId: string, oldName: string, newName: string): Promise<boolean> {
	const collection = await getGroupsCollection();
	const result = await collection.updateOne(
		{ userId, groupName: oldName },
		{ $set: { groupName: newName, updatedAt: new Date() } }
	);
	return result.modifiedCount > 0;
}

