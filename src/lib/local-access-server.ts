import { headers } from "next/headers";
import { isLoopbackRequest, localAccessEnabled } from "./local-access";

export async function hasLocalAccess() {
  return localAccessEnabled() && isLoopbackRequest(await headers());
}
