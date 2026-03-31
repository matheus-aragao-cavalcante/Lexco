export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export function getSessionUserId(): string | null {
  return localStorage.getItem("lexcontrol_session");
}

export function setSessionUserId(userId: string) {
  localStorage.setItem("lexcontrol_session", userId);
}

export function clearSession() {
  localStorage.removeItem("lexcontrol_session");
}
