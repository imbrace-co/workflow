import { redisExpire, redisHGet, redisHGetAll, redisHSet, redisHDel } from "./redis";

export type GenericValue = string | number | boolean | undefined | null | IDataObject | GenericValue[];

export interface IDataObject {
	[key: string]: GenericValue;
}

export async function getWorkflowPosition(conversation_id: string): Promise<string | null> {
	return await redisHGet(conversation_id, 'position');
}

export async function getLabelId(conversation_id: string, label: string): Promise<string | null> {
	const trimmedLabel = label.trim();
	console.log(`<getLabelId> trimmedLabel: `, trimmedLabel);
	const value = await getRedisHash('getLabelId', conversation_id, trimmedLabel);
	console.log(`<getLabelId> value: `, value);
	return value;
}

export async function getAllLabels(conversation_id: string): Promise<string[]> {
    const redisData = await redisHGetAll(conversation_id);
    return redisData ? Object.keys(redisData) : [];
}

export async function removeLabel(conversation_id: string, label: string): Promise<void> {
	const trimmedLabel = label.trim();
	console.log(`<removeLabel> Removing label from Redis: `, { conversation_id, label: trimmedLabel });
	await redisHDel(conversation_id, trimmedLabel);
}

export async function getRedisHash(operation: string, hash: string, key: string) {
	console.log(`<${operation}> Start getting data from Redis: `, { hash, key });
	try {
		const redisData = await redisHGetAll(hash);
		if (!redisData) {
			console.log(`<${operation}> No data found in Redis: `, { hash, key });
			return null;
		}
		if (key) {
			return redisData[key] || null;
		}
		return JSON.stringify(redisData);
	} catch (error) {
		console.log(`<${operation}> Error getting Redis data: ${hash}, $${key}: `, error);
		return null;
	}
}

export async function setRedisHash(
	operation: string,
	hash: string,
	key: string,
	value: string,
	expireTime?: number | undefined,
) {
	console.log(`<${operation}> Start setting up Redis: `, { hash, key, value });
	try {
		const result = await redisHSet(hash, key, value);
		if (expireTime) {
			await redisExpire(hash, expireTime);
		}
		console.log(`<${operation}> [${key}] saved to Redis result: `, result);
	} catch (error) {
		console.log(`<${operation}> Error setting Redis data: ${hash}, $${key}, ${value}: `, error);
	}
}

export async function resolveConfig(
	inputConfig: IDataObject | GenericValue | GenericValue[] | IDataObject[] | undefined,
	conversation_id: string | undefined,
): Promise<IDataObject | GenericValue | GenericValue[] | IDataObject[]> {
	if (inputConfig !== undefined) {
		return inputConfig;
	}

	if (conversation_id) {
		try {
			const workflowPosition = await getWorkflowPosition(conversation_id);
			if (workflowPosition) {
				const parsedPosition = JSON.parse(workflowPosition as string);
				return (parsedPosition.state as IDataObject) ?? 'default';
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.warn(`Failed to parse workflow position: ${errorMessage}`);
			return 'default';
		}
	}

	return 'default';
}

export async function setWorkflowOutputHistory(
	conversation_id: string,
	nodeName: string,
	output_index: string,
): Promise<void> {
	await setRedisHash('setWorkflowOutputHistory', conversation_id, nodeName, output_index);
}

export async function removeWorkflowPosition(conversation_id: string) {
	await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');
}

export async function removeWorkflowOutputHistory(
	conversation_id: string,
	nodeName: string,
): Promise<void> {
	await setRedisHash('removeWorkflowOutputHistory', conversation_id, nodeName, '');
}