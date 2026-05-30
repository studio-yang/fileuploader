import IORedis from 'ioredis';

// 全域 Redis 單例，所有模組共用，避免建立過多連線
let _client: IORedis | null = null;

export function getRedis(): IORedis {
  if (_client) return _client;
  const url = process.env.REDIS_URL || process.env.KV_URL || '';
  if (!url) throw new Error('Redis 未設定');
  _client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck:     false,
    lazyConnect:          false,
  });
  return _client;
}
