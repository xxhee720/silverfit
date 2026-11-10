import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
import { secureStorage } from "./secure-storage";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const site =
  process.env.EXPO_PUBLIC_SITE_URL || "https://silverfit-chi.vercel.app";
export const client = createClient(
  url || "https://not-configured.supabase.co",
  key || "not-configured",
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  },
);
AppState.addEventListener("change", (state) => {
  if (!configured) return;
  if (state === "active") client.auth.startAutoRefresh();
  else client.auth.stopAutoRefresh();
});
