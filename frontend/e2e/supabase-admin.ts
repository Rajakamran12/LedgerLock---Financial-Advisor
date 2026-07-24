import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const TEST_EMAIL_DOMAIN = "@example.com";

let cached: SupabaseClient | null = null;

/** Admin (service-role) Supabase client — server-side only, never ship to the browser. */
export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (via frontend/.env.local) to run the E2E suite."
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/** Finds a just-signed-up user by email and marks their email as confirmed, bypassing the real inbox. */
export async function confirmUserEmail(email: string): Promise<string> {
  const admin = getAdminClient();

  // supabase-js's admin API has no getUserByEmail, so page through listUsers().
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email === email);
    if (match) {
      const { error: updateError } = await admin.auth.admin.updateUserById(match.id, {
        email_confirm: true,
      });
      if (updateError) throw new Error(`updateUserById failed: ${updateError.message}`);
      return match.id;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  throw new Error(`Could not find newly signed-up user with email ${email}`);
}

/** Removes every leftover E2E test user (and their uploaded storage objects). */
export async function purgeTestUsers(): Promise<void> {
  const admin = getAdminClient();

  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    const testUsers = data.users.filter(
      (u) => u.email && u.email.endsWith(TEST_EMAIL_DOMAIN) && u.email.startsWith("e2e-")
    );
    for (const user of testUsers) {
      const { data: files } = await admin.storage.from("documents").list(user.id);
      if (files && files.length > 0) {
        await admin.storage
          .from("documents")
          .remove(files.map((f) => `${user.id}/${f.name}`));
      }
      await admin.auth.admin.deleteUser(user.id);
    }

    if (data.users.length < 200) break;
    page += 1;
  }
}

/** Creates a test user (idempotent) and marks email as confirmed. */
export async function createTestUser(email: string, password: string) {
  const admin = getAdminClient();

  // Try creating the user; if they already exist, update the password and mark confirmed.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // If user exists, find them and update
    let page = 1;
    for (;;) {
      const res = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (res.error) throw new Error(`listUsers failed: ${res.error.message}`);
      const match = res.data.users.find((u) => u.email === email);
      if (match) {
        const { error: updateError } = await admin.auth.admin.updateUserById(match.id, {
          password,
          email_confirm: true,
        });
        if (updateError) throw new Error(`updateUserById failed: ${updateError.message}`);
        return match.id;
      }
      if (res.data.users.length < 200) break;
      page += 1;
    }
    throw new Error(`createUser failed: ${error.message}`);
  }

  return data.user.id;
}

/** Returns documents for a given user id (admin-only). */
export async function getDocumentsForUser(userId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.from("documents").select("id, file_name, status").eq("user_id", userId);
  if (error) throw new Error(`getDocumentsForUser failed: ${error.message}`);
  return data;
}

/** Find a document by file name (returns newest match first). */
export async function getDocumentByFileName(fileName: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("documents")
    .select("id, file_name, status, created_at")
    .eq("file_name", fileName)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`getDocumentByFileName failed: ${error.message}`);
  return data?.[0] ?? null;
}
