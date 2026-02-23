type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

export async function enforceRateLimit(
  supabase: any,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error: countError } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if (countError) {
    throw new Error(countError.message);
  }

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);
  const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString();

  if (used >= limit) {
    return { allowed: false, remaining, resetAt };
  }

  const { error: insertError } = await supabase
    .from("rate_limit_events")
    .insert({ user_id: userId, action });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { allowed: true, remaining: remaining - 1, resetAt };
}
