/**
 * In-memory burst rate limiter for API routes.
 * NOTE: On Vercel serverless, each cold start gets fresh memory, so this only
 * protects against rapid-fire requests within the same warm instance. It is NOT
 * a reliable rate limiter for sustained attacks. The real protection comes from
 * database-backed limits (daily message limit, monthly cost limit in agent_usage).
 */
const buckets = new Map()

const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

// Periodic cleanup of expired entries
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > bucket.window) {
      buckets.delete(key)
    }
  }
}

/**
 * Check if a request should be rate limited
 * @param {string} key - Unique identifier (e.g. IP + endpoint)
 * @param {number} limit - Max requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ limited: boolean, remaining: number }}
 */
export function rateLimit(key, limit = 10, windowMs = 60 * 1000) {
  cleanup()

  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { count: 1, start: now, window: windowMs })
    return { limited: false, remaining: limit - 1 }
  }

  bucket.count++
  if (bucket.count > limit) {
    return { limited: true, remaining: 0 }
  }

  return { limited: false, remaining: limit - bucket.count }
}
