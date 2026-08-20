import { BranchExecutionType, RouterActionSettings } from "@activepieces/shared";
import { outBound, outBoundTopic } from "./kafka/controller";
import { redisExpire, redisHGetAll, redisHSet } from "./redis/controller";

export function validateNoSpaces(value: string) {
	const trimmedValue = value.trim();
	if (trimmedValue === '' && trimmedValue !== value) {
		throw Error(`One or more fields have only spaces, please check the parameters.`);
	} else {
		return trimmedValue;
	}
}

export async function outboundOptions(
	type: string,
	question: string,
	routeSettings: RouterActionSettings,
	conversation_id: string,
	position?: string,
) {
	const { branches } = routeSettings;

	switch (type) {
		case 'whatsapp':
			const whatsappOptions = branches.filter(b => b.branchType === BranchExecutionType.CONDITION).map(b => validateNoSpaces(b.branchName));

			await outboundWhatsAppListMessage(question, whatsappOptions, whatsappOptions, conversation_id, position);
			break;
		default:
			const webWidgetOptions = branches.filter(b => b.branchType === BranchExecutionType.CONDITION).map(b => b.branchName);

			await outboundListMessage(question, webWidgetOptions, conversation_id, position);
			break;
	}
}

export async function outboundWhatsAppListMessage(
	question: string,
	options: string[],
	descriptions: string[],
	conversation_id: string,
	position?: string,
) {
	console.log('<outboundWhatsAppListMessage>', { question, options, descriptions });
	const quick_replies: object[] = [];
	let listItem = 0;
	options.forEach((value, payloadId) => {
		if (value) {
			quick_replies[listItem] = {
				id: String(payloadId),
				content_type: 'text',
				title: value,
				description: descriptions[payloadId],
				payload: String(payloadId) + '_' + position,
			};
			listItem++;
		}
	});
	const json = {
		conversation_id,
		type: 'response',
		content: {
			title: 'View List',
			text: question,
			quick_replies,
		},
	};
	console.log(`<outboundWhatsAppListMessage> outBound value: `, JSON.stringify(json));
	try {
		await outBound(outBoundTopic, conversation_id, JSON.stringify(json));
		console.log('<outboundWhatsAppListMessage> Message sent successfully');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('<outboundWhatsAppListMessage> Failed to send message:', errorMessage);
		throw error;
	}
}

export async function outboundListMessage(
	question: string,
	options: string[],
	conversation_id: string,
	position?: string,
) {
	console.log('<outboundListMessage>', { question, options });
	const quick_replies: object[] = [];
	let listItem = 0;
	options.forEach((value, payloadId) => {
		if (value) {
			quick_replies[listItem] = {
				id: String(payloadId),
				content_type: 'text',
				title: value,
				payload: String(payloadId) + '_' + position,
			};
			listItem++;
		}
	});
	const json = {
		conversation_id,
		type: 'response',
		content: {
			title: 'View List',
			text: question,
			quick_replies,
		},
	};
	console.log(`<outboundListMessage> outBound value: `, JSON.stringify(json));
	try {
		// Send the message using the new per-message instantiation pattern
		// The controller handles all connection management, retries, and cleanup internally
		await outBound(outBoundTopic, conversation_id, JSON.stringify(json));
		console.log('<outboundListMessage> Message sent successfully');

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('<outboundListMessage> Failed to send message:', errorMessage);
		throw error;
	}
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
		console.error(`<${operation}> Error setting Redis data: ${hash}, $${key}, ${value}: `, error);
	}
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
		console.error(`<${operation}> Error getting Redis data: ${hash}, $${key}: `, error);
		return null;
	}
}

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