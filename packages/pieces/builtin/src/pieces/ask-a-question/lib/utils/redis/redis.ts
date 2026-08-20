import { createClient } from 'redis'
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

let redisClient: any = null;

export class RedisClientWrapper {
  
  static async getClient() {
    if (redisClient && redisClient.isReady) {
      return redisClient;
    }

    const config = this.buildConfig();
    console.log('Creating Redis client with config:', {
      host: config.socket?.host,
      port: config.socket?.port,
      database: config.database,
      username: config.username,
      hasPassword: !!config.password,
      hasTLS: !!config.socket?.tls
    });

    redisClient = createClient(config);
    
    redisClient.on('error', (err: Error) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('Redis ready for commands');
    });

    // Connect to Redis
    await redisClient.connect();

    return redisClient;
  }

  private static buildConfig() {
    console.log(`Redis env config:`, process.env);

    const host = process.env['REDIS_HOST'] || '';
    const port = parseInt(process.env['REDIS_PORT'] || '6379', 10);
    const password = process.env['REDIS_PASSWORD'];
    const database = parseInt(process.env['REDIS_DB'] || '0', 10);
    const username = process.env['REDIS_USERNAME'];
    const useTLS = process.env['REDIS_TLS'] === 'true';

    const config: any = {
      database,
    };

    // Configure socket based on whether TLS is enabled
    if (useTLS) {
      config.socket = {
        host,
        port,
        tls: true,
        rejectUnauthorized: process.env['REDIS_TLS_REJECT_UNAUTHORIZED'] !== 'false',
      };
    } else {
      config.socket = {
        host,
        port,
      };
    }

    if (username) {
      config.username = username;
    }

    if (password && password.trim() !== '') {
      config.password = password;
    }
    
    console.log('Redis config:', config);

    return config;
  }

  static async disconnect(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
    }
  }

  // Convenience methods for common operations
  static async set(key: string, value: string, expirySeconds?: number): Promise<string | null> {
    const client = await this.getClient();
    if (expirySeconds) {
      return await client.setEx(key, expirySeconds, value);
    }
    return await client.set(key, value);
  }

  static async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return await client.get(key);
  }

  static async del(key: string): Promise<number> {
    const client = await this.getClient();
    return await client.del(key);
  }

  static async exists(key: string): Promise<number> {
    const client = await this.getClient();
    return await client.exists(key);
  }

  static async incr(key: string): Promise<number> {
    const client = await this.getClient();
    return await client.incr(key);
  }

  static async hset(key: string, field: string, value: string): Promise<number> {
    const client = await this.getClient();
    return await client.hSet(key, field, value);
  }

  static async hget(key: string, field: string): Promise<string | null> {
    const client = await this.getClient();
    const result = await client.hGet(key, field);
    return result || null; // Convert undefined to null
  }

  static async hgetall(key: string): Promise<Record<string, string>> {
    const client = await this.getClient();
    return await client.hGetAll(key);
  }

  static async sadd(key: string, member: string): Promise<number> {
    const client = await this.getClient();
    return await client.sAdd(key, member);
  }

  static async smembers(key: string): Promise<string[]> {
    const client = await this.getClient();
    return await client.sMembers(key);
  }

  static async srem(key: string, member: string): Promise<number> {
    const client = await this.getClient();
    return await client.sRem(key, member);
  }

  static async lpush(key: string, value: string): Promise<number> {
    const client = await this.getClient();
    return await client.lPush(key, value);
  }

  static async rpop(key: string): Promise<string | null> {
    const client = await this.getClient();
    return await client.rPop(key);
  }

  static async llen(key: string): Promise<number> {
    const client = await this.getClient();
    return await client.lLen(key);
  }

  static async publish(channel: string, message: string): Promise<number> {
    const client = await this.getClient();
    return await client.publish(channel, message);
  }

  static async expire(key: string, seconds: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.expire(key, seconds);
    return !!result; // Ensure boolean return
  }

  static async ttl(key: string): Promise<number> {
    const client = await this.getClient();
    return await client.ttl(key);
  }

  static async persist(key: string): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.persist(key);
    return !!result; // Ensure boolean return
  }
}