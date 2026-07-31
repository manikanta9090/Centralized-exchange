import { redisManager } from "./redis.js";

console.log("Matching engine starting...");

await redisManager.connect();

console.log("Matching engine ready");

await redisManager.listenForRequests();