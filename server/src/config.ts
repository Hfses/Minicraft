export interface AppConfig {
  port: number;
  sessionTtlSeconds: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(): AppConfig {
  return {
    // Single port serves REST, signaling (/ws) and the relay (/relay).
    port: intFromEnv("PORT", 8080),
    sessionTtlSeconds: intFromEnv("SESSION_TTL_SECONDS", 180),
  };
}
