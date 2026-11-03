import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "rna-default-secret-change-me";

export interface TokenPayload {
  sub: string; // user api id
  iat: number;
  exp: number;
}

export function signJWT(sub: string, expiresIn = "7d"): string {
  return (jwt.sign as any)({ sub }, SECRET, { expiresIn: expiresIn as any, algorithm: "HS256" });
}

export function verifyJWT(token: string): TokenPayload {
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as TokenPayload;
}

export function extractToken(reqHeaders: Headers): string | null {
  const auth = reqHeaders.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return reqHeaders.get("x-api-key"); // backward compat for simple key
}
