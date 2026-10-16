import { jwtVerify, SignJWT } from "jose";

const key = (secret: string) => {
  if (secret.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(secret);
};

export async function issueToken(sid: string, secret: string, now = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(issuedAt).setExpirationTime(issuedAt + 30 * 24 * 60 * 60).sign(key(secret));
}

export async function readToken(token: string, secret: string, now = new Date()): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"], currentDate: now });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}
