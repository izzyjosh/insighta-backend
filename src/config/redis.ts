// import { createClient } from "redis";
// import { config } from "./config";
// import sysLogger from "../utils/logger";

// export const redisClient = createClient({
//   url: config.redisUrl,
// });

// (async () => {
//   await redisClient.connect();
//   sysLogger.info("Connected to Redis successfully");
// })();

// redisClient.on("error", (err) => {
//   sysLogger.error(`Redis Client Error: ${err}`);
// });
