import { redisExpire, redisHGetAll, redisHSet } from "./redis";

export async function resolveConfig(config: unknown, conversation_id: string) {
	try {
		if (!config) {
			return config;
		}

		if (conversation_id) {
			const wfPosition = await getRedisHash('getWorkflowPosition', conversation_id, 'position');
			const parsedPosition = wfPosition ? JSON.parse(wfPosition) : null;
			return parsedPosition?.state ?? "default";
		}

		return "default";
	} catch (error) {
		console.error('<resolveConfig> Error resolving config:', error);
		return null;
	}
};

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
		console.error(`<${operation}> Error getting Redis data: ${hash}, $${key}: `, error);
		return null;
	}
}

export async function setLabelId(
	conversation_id: string,
	label: string,
	userInput: string,
): Promise<void> {
	const trimmedLabel = label.trim();
	await setRedisHash('setLabelId', conversation_id, trimmedLabel, userInput);
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

export async function removeWorkflowPosition(conversation_id: string) {
	await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');
}