import { auth } from "./index";

export async function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request);
}
