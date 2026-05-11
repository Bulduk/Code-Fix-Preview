import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli" });
    return;
  }
  try {
    req.user = await verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Bu işlem için admin yetkisi gerekli" });
    return;
  }
  next();
}
