import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (admin operations)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Database types
export interface Tenant {
  id: string;
  login_id: string;
  password_hash: string;
  name: string | null;
  category: string;
  main_services: string[] | null;
  address: string | null;
  trusted_domains: string[] | null;
  blog_platform: string;
  blog_id: string | null;
  blog_password_encrypted: string | null;
  blog_board_name: string | null;
  is_initial_setup_complete: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: string;
  login_id: string;
  title: string;
  content: string;
  topic: string;
  keywords: string[] | null;
  image_keywords: string[] | null;
  reference_links: { title: string; url: string; snippets?: string[] }[] | null;
  category: '정보성' | '홍보성' | null;
  posted_to_blog: boolean;
  posted_at: string | null;
  created_at: string;
}

export interface BlogImage {
  id: string;
  blog_post_id: string;
  keyword: string;
  text_content: string | null;
  storage_path: string;
  public_url: string;
  prompt: string | null;
  image_type: string | null;
  prompt_id: string | null;
  display_order: number | null;
  created_at: string;
}
