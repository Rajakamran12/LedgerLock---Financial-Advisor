import { purgeTestUsers } from "./supabase-admin";

/**
 * Runs once before the whole suite. Sweeps any leftover E2E test users and
 * their storage objects from a previously interrupted run, so re-runs stay
 * idempotent. The actual test user is created via the real sign-up UI flow
 * inside the spec itself (see app.spec.ts).
 */
export default async function globalSetup() {
  try {
    await purgeTestUsers();
  } catch (err) {
    // If admin credentials aren't available in this environment, don't fail.
     
    console.warn("purgeTestUsers skipped:", err?.toString?.() ?? err);
  }
}
