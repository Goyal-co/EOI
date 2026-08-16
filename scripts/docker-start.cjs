"use strict";

/**
 * `docker run --env-file` keeps surrounding quotes. Compose strips them.
 * Normalize both so DATABASE_URL / REDIS_URL parse correctly.
 */
for (const key of Object.keys(process.env)) {
  const value = process.env[key];
  if (!value || value.length < 2) continue;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    process.env[key] = value.slice(1, -1);
  }
}

require("./apps/web/server.js");
