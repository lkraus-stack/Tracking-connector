import pino from "pino";

export const logger = pino({
  name: "tracking-connector-admin",
  level: process.env.LOG_LEVEL ?? "info"
});
