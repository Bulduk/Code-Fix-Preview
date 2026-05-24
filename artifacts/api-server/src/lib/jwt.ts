import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = new TextEncoder().encode(
  process.env["SESSION_SECRET"] ?? "nexus-dev-secret-change-in-prod-min32chars"
);
const ALG    = "HS256";
const EXPIRY = "24h";

if (SECRET.length < 32) {
  throw new Error("SESSION_SECRET en az 32 karakter olmalı");
}

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: "admin" | "trader" | "viewer";
}

export async function signToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as TokenPayload;
}
