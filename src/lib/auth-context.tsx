import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User as FbUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserDoc, Role } from "./types";

interface AuthCtx {
  fbUser: FbUser | null;
  user: UserDoc | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  fbUser: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FbUser | null>(null);
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (fb: FbUser | null) => {
    if (!fb) {
      setUser(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", fb.uid));
      if (snap.exists()) {
        const userData = { uid: fb.uid, ...(snap.data() as Omit<UserDoc, "uid">) };
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      setUser(null);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timeout after 8s");
        setLoading(false);
      }
    }, 8000);

    const unsub = onAuthStateChanged(auth, async (fb) => {
      clearTimeout(timeout);
      setFbUser(fb);
      if (fb) {
        await loadProfile(fb);
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        fbUser,
        user,
        role: user?.role ?? null,
        loading,
        signOut: async () => {
          await fbSignOut(auth);
        },
        refresh: async () => {
          await loadProfile(auth.currentUser);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
