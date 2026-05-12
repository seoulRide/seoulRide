import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/** service_role 키로 Supabase 클라이언트를 생성한다. RLS를 우회하므로
 *  GitHub Actions cron (upsert) 또는 로컬 ETL 스크립트에서만 사용해야 한다.
 *
 *  Node 20에는 native WebSocket이 없어서 ws 패키지를 transport로 주입한다.
 *  (Realtime은 안 쓰지만 SupabaseClient 생성자가 RealtimeClient를 항상 초기화.) */
export function makeServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (set in .env.local or GitHub Secrets)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as never },
  });
}
