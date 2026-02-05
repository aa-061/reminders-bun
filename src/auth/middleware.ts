import type { Context } from "elysia";
import { auth } from "./index";

export async function requireAuth({ request, set }: Context) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    set.status = 401;
    return { error: "Unauthorized - Please sign in" };
  }
}
