import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client. Must be created fresh per request (cookies()
 * is request-scoped in the App Router).
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  // If running under Playwright tests, return a tiny file-backed stub client
  // so tests can run without a real Supabase project or service keys.
  if (process.env.PLAYWRIGHT_TEST === "1") {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const stubPath = path.resolve(process.cwd(), "e2e_stub.json");

    async function readStub() {
      try {
        const txt = await fs.readFile(stubPath, "utf-8");
        return JSON.parse(txt) as { documents: unknown[]; queries?: unknown[] };
      } catch {
        return { documents: [], queries: [] };
      }
    }
    async function writeStub(stub: { documents: unknown[]; queries?: unknown[] }) {
      await fs.writeFile(stubPath, JSON.stringify(stub, null, 2));
    }

    type StubQueryChain = {
      order(): StubQueryChain;
      eq(): StubQueryChain;
      range(_a?: number, _b?: number): {
        then(): Promise<{ data: unknown[]; error: null; count: number }>;
        maybeSingle(): Promise<{ data: unknown | null; error: null }>;
        single(): Promise<{ data: unknown | null; error: null }>;
      };
      then(): Promise<{ data: unknown[]; error: null; count: number }>;
      maybeSingle(): Promise<{ data: unknown | null; error: null }>;
      single(): Promise<{ data: unknown | null; error: null }>;
    };

    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: "e2e-user-id", email: process.env.E2E_TEST_EMAIL ?? "e2e@example.com" } }, error: null }),
        signUp: async (_opts: object) => {
          void _opts;
          return { data: { user: { id: "e2e-user-id", email: process.env.E2E_TEST_EMAIL ?? "e2e@example.com" } }, error: null };
        },
        signInWithPassword: async (_creds: object) => {
          void _creds;
          return { data: { user: { id: "e2e-user-id", email: process.env.E2E_TEST_EMAIL ?? "e2e@example.com" } }, error: null };
        },
        signOut: async () => ({ error: null }),
      },
      from: (table: string) => {
        return {
          select: (_cols?: string, _opts?: object) => {
            void _cols;
            void _opts;
            const chain: StubQueryChain = {
              order() {
                return this;
              },
              eq() {
                return this;
              },
              range(_a?: number, _b?: number) {
                void _a;
                void _b;
                return {
                  then: async () => {
                    const stub = await readStub();
                    const data = table === "documents" ? stub.documents : stub.queries ?? [];
                    return { data, error: null, count: data.length };
                  },
                  maybeSingle: async () => ({ data: null, error: null }),
                  single: async () => ({ data: null, error: null }),
                };
              },
              then: async () => {
                const stub = await readStub();
                const data = table === "documents" ? stub.documents : stub.queries ?? [];
                return { data, error: null, count: data.length };
              },
              maybeSingle: async () => ({ data: null, error: null }),
              single: async () => ({ data: null, error: null }),
            };
            return chain;
          },
          insert: async (rows: Array<Record<string, unknown>>) => {
            const stub = await readStub();
            if (table === "documents") {
              const doc = rows[0];
              stub.documents.unshift(doc);
              await writeStub(stub);
              return { data: [doc], error: null };
            }
            if (table === "queries") {
              stub.queries = stub.queries || [];
              stub.queries.unshift(rows[0]);
              await writeStub(stub);
              return { data: [rows[0]], error: null };
            }
            return { data: [], error: null };
          },
          delete: async () => ({ data: [], error: null }),
          update: async (_u: object) => {
            void _u;
            return { data: [], error: null };
          },
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        };
      },
      rpc: async () => ({ data: [], error: null }),
      storage: {
        from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }),
      },
    };

    return client as unknown as SupabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from a Server Component; safe to ignore because
            // the proxy refreshes the session on every request.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for privileged server-side operations (e.g. calling
 * the Python agent, writing rows the RLS policy wouldn't otherwise allow
 * from the user's own session). Never expose this client or its key to the
 * browser.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
  return createSupabaseJsClient(
    url,
    serviceKey,
    { auth: { persistSession: false } }
  );
}
