import { outBound, outBoundTopic } from "./kafka/controller";
import { redisExpire, redisHGet, redisHGetAll, redisHSet } from "./redis/controller";

export type GenericValue = string | number | boolean | undefined | null | IDataObject | GenericValue[];

export interface IDataObject {
	[key: string]: GenericValue;
}

export async function outboundTextMessage(message: string, conversation_id: string) {
	console.log('<outboundTextMessage>');
	
	// Validate input
	if (!message || message.trim() === '') {
		console.log('<outboundTextMessage> Empty message, skipping send');
		return;
	}

	if (!conversation_id || conversation_id.trim() === '') {
		console.log('<outboundTextMessage> Empty conversation_id, skipping send');
		return;
	}

	const value = JSON.stringify({
		conversation_id,
		type: 'text',
		content: {
			text: message,
		},
	});
	console.log('<outboundTextMessage> outBound value:', value);

	try {
		// Send the message using the new per-message instantiation pattern
		// The controller handles all connection management, retries, and cleanup internally
		await outBound(outBoundTopic, conversation_id, value);
		console.log('<outboundTextMessage> Message sent successfully');
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('<outboundTextMessage> Failed to send message:', errorMessage);
		throw error;
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

export async function storeUserResponse(
	conversation_id: string,
	nodeName: string,
	label: string,
	answer: string,
) {
	if (!label || !answer) {
		throw Error(`[${nodeName}] label is required`);
	}

	console.log('<storeUserResponse> Start storing user response: ', { conversation_id, nodeName, label, answer });
	

	const labelLowerCase = label.toLowerCase();
	await setLabelId(conversation_id, labelLowerCase, answer);
}

export async function setLabelId(
	conversation_id: string,
	label: string,
	userInput: string,
): Promise<void> {
	const trimmedLabel = label.trim();
	await setRedisHash('setLabelId', conversation_id, trimmedLabel, userInput);
}

export async function setWorkflowPosition(
	conversation_id: string,
	nodeName: string | string[],
	state: string,
): Promise<void> {
	const json = { nodeName, state };
	await setRedisHash('setWorkflowPosition', conversation_id, 'position', JSON.stringify(json));
}

export async function getWorkflowPosition(conversation_id: string): Promise<string | null> {
	return await redisHGet(conversation_id, 'position');
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

export async function getLabelId(conversation_id: string, label: string): Promise<string | null> {
	const trimmedLabel = label.trim();
	const value = await getRedisHash('getLabelId', conversation_id, trimmedLabel);
	console.log(`<getLabelId> value: `, value);
	return value;
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