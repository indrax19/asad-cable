import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "https://xvjsobbhtwcyelzzibym.supabase.co";
const supabasePublishableKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_B9gLfzj_XY31ceEMlFnsdw_0cRS5jmx";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes("placeholder") &&
    !supabasePublishableKey.includes("placeholder"),
);

if (typeof window !== "undefined" && !isSupabaseConfigured) {
  console.warn("Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
