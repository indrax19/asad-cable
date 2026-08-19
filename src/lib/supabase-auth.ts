import { supabase } from "./supabase";
import { collection, db, getDocs, query, where } from "./supabase-store";

export const auth = supabase.auth;

export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw error;
}

export async function createManagedUser(
  email: string,
  password: string,
  profile: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", email, password, profile },
  });
  if (error) {
    if (error.message === "Failed to send a request to the Edge Function") {
      throw new Error("Customer creation is unavailable because the admin-users Edge Function is not deployed in Supabase.");
    }
    throw error;
  }
  if (!data?.id) throw new Error("The user account could not be created");
  return { user: { uid: data.id } };
}

export async function updateManagedUser(
  userId: string,
  profile: Record<string, unknown>,
  email?: string,
  password?: string,
) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "update", userId, profile, email, password },
  });
  if (error) throw error;
  if (!data?.id) throw new Error("The user account could not be updated");
}

export async function deleteManagedUser(userId: string) {
  const { error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete", userId },
  });
  if (error) throw error;
}

export async function findManagedUser(email: string) {
  const snapshot = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  const profile = snapshot.docs[0];
  if (!profile) throw new Error("User account not found");
  return profile.id;
}
