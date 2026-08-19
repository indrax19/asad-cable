import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getDoc, doc, db, setDoc } from "./supabase-store";
import type { UserDoc, Role } from "./types";

interface AuthCtx {
  authUser: User | null;
  user: UserDoc | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  authUser: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setUser(null);
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, "users", currentUser.id));
      if (snapshot.exists()) {
        setUser({ uid: currentUser.id, ...(snapshot.data() as Omit<UserDoc, "uid">) });
        return;
      }

      if (currentUser.user_metadata.signupSource === "self-service") {
        const profile: Omit<UserDoc, "uid"> = {
          name: currentUser.user_metadata.name || currentUser.email?.split("@")[0] || "User",
          username: "",
          email: currentUser.email,
          phone: "",
          cnic: "",
          address: "",
          role: "customer",
          status: "active",
          photoURL: "",
          createdAt: Date.now(),
        };
        await setDoc(doc(db, "users", currentUser.id), profile);
        setUser({ uid: currentUser.id, ...profile });
        return;
      }

      setUser(null);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setUser(null);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoading(false), 8000);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setAuthUser(currentUser);
      void loadProfile(currentUser).finally(() => {
        window.clearTimeout(timeout);
        setLoading(false);
      });
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setAuthUser(currentUser);
      void loadProfile(currentUser);
    });

    return () => {
      window.clearTimeout(timeout);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        authUser,
        user,
        role: user?.role ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refresh: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const currentUser = session?.user ?? null;
          setAuthUser(currentUser);
          await loadProfile(currentUser);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
