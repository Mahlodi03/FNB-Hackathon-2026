import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile } from "./queries";

/** Require an authenticated user with a valid profile before reading the directory. */
export async function requireDirectoryAccess(returnPath: string): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
}
