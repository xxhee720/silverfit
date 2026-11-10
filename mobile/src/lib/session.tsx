import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { client, configured } from "./client";
const Context = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(configured);
  useEffect(() => {
    if (!configured) return;
    let live = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, s) => {
      if (live) {
        setSession(s);
        setLoading(false);
      }
    });
    client.auth
      .getSession()
      .then(({ data }) => {
        if (live) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider value={{ session, loading }}>{children}</Context.Provider>
  );
}
export const useSession = () => useContext(Context);
