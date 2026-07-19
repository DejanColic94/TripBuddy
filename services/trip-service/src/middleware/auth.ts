import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: number;
  name?: string;
}

export default function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authorization.split(" ")[1];
  const jwtSecret = process.env.TRIP_JWT_SECRET;

  if (!jwtSecret) {
    res.status(500).json({ error: "Authentication configuration error" });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("id" in decoded) ||
      typeof decoded.id !== "number"
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = {
      id: decoded.id,
      ...(typeof decoded.name === "string" && decoded.name.trim().length > 0
        ? { name: decoded.name }
        : {}),
    };

    next();
  } catch (_error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}
