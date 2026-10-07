require("dotenv").config();
const { Redis } = require("@upstash/redis");

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env.
const redis = Redis.fromEnv();

module.exports = redis;
