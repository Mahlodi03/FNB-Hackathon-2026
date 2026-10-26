import "server-only";
import { RoleSchema, type Role } from "@/contracts/domain";
import { serverSupabase } from "@/lib/supabase/server";

export type Actor = { userId: string; role: Role };
export class AccessError extends Error {
 constructor(public status: 401 | 403, message: string) { super(message); }
}
/** Shared foundation. No route may accept role or studentId from request as proof of authorization. */
export async function requireActor(allowedRoles?: readonly Role[]): Promise<Actor> {
 const supabase = await serverSupabase();
 const { data: { user }, error } = await supabase.auth.getUser();
 if (error || !user) throw new AccessError(401, "Authentication required");
 const { data: profile, error: profileError } = await supabase.from("profiles")
   .select("role").eq("id",user.id).single();
 const role = RoleSchema.safeParse(profile?.role);
 if (profileError || !role.success) throw new AccessError(403, "Account role unavailable");
 if (allowedRoles && !allowedRoles.includes(role.data)) throw new AccessError(403, "Role not authorized");
 return {userId:user.id, role:role.data};
}
