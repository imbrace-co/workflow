import { RedisClientWrapper } from './redis';

export const redisGet = async (key: string) => {
	try {
		return await RedisClientWrapper.get(key);
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisSet = async (key: string, val: string) => {
	try {
		return await RedisClientWrapper.set(key, val);
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisHGetAll = async (hash: string) => {
	try {
		return await RedisClientWrapper.hgetall(hash);
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisHGet = async (hash: string, key: string) => {
	try {
		return await RedisClientWrapper.hget(hash, key); // Now returns string | null consistently
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisHSet = async (hash: string, key: string, val: string) => {
	try {
		return await RedisClientWrapper.hset(hash, key, val);
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisHDel = async (hash: string, key: string) => {
	try {
		return await RedisClientWrapper.hdel(hash, key);
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisExpire = async (key: string, time: number) => {
	try {
		const result = await RedisClientWrapper.expire(key, time);
		return result ? 1 : 0; // Convert boolean to number for backward compatibility
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const redisPersist = async (key: string) => {
	try {
		const result = await RedisClientWrapper.persist(key);
		return result ? 1 : 0; // Convert boolean to number for backward compatibility
	} catch (error) {
		console.error(error);
		throw error;
	}
};