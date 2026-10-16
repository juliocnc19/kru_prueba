import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const length = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, length) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hex || hex.length !== length * 2) return false;
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== length) return false;
  const actual = await scrypt(password, salt, length) as Buffer;
  return timingSafeEqual(actual, expected);
}
