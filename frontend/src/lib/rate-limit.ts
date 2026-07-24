import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Per-route rate limiters. Each route gets its own namespaced limiter so
 * that hammering one endpoint doesn't consume another's budget.
 */
export const rateLimiters = {
  documentsCreate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit:documents:create",
    analytics: false,
  }),
  documentsRead: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:documents:read",
    analytics: false,
  }),
  documentsDelete: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:documents:delete",
    analytics: false,
  }),
  query: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:query",
    analytics: false,
  }),
  auditLog: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:audit-log",
    analytics: false,
  }),
};

export type RateLimitKey = keyof typeof rateLimiters;

export async function checkRateLimit(key: RateLimitKey, identifier: string) {
  const { success, limit, remaining, reset } = await rateLimiters[key].limit(
    identifier
  );
  return { success, limit, remaining, reset };
}
