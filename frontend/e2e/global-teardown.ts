import { purgeTestUsers } from "./supabase-admin";

/**
 * Deletes every E2E test user (and their uploaded storage objects) created
 * during this run so repeated test runs don't accumulate throwaway Supabase
 * auth users.
 */
export default async function globalTeardown() {
  try {
    await purgeTestUsers();
  } catch (err) {
    // Don't fail the test run just because the admin token couldn't be used
    // to clean up users in this environment. Log and continue.
     
    console.error("purgeTestUsers failed:", err?.toString?.() ?? err);
  }
}
