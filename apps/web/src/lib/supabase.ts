import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** anon 키로 만든 read-only 클라이언트. RLS 정책 "Public read"가 허용된
 *  테이블만 읽을 수 있다. Server Component / Route Handler에서만 사용. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY required (set in apps/web/.env.local)",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Supabase가 설정돼 있는지 여부. 로컬 dev에서 미설정 시 JSON 파일 폴백을 쓰기 위해 사용. */
export function hasSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
