import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: number;
  name?: string;
  email?: string;
}

function getJwtSecret(res: Response): string | null {
  const jwtSecret = process.env.TRIP_JWT_SECRET;

  if (!jwtSecret) {
    res.status(500).json({ error: "Authentication configuration error" });
    return null;
  }

  return jwtSecret;
}

function getUserFromAuthorization(
  authorization: string,
  jwtSecret: string
): AuthenticatedUser | null {
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.split(" ")[1];
  const decoded = jwt.verify(token, jwtSecret);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("id" in decoded) ||
    typeof decoded.id !== "number"
  ) {
    return null;
  }

  return {
    id: decoded.id,
    ...(typeof decoded.name === "string" && decoded.name.trim().length > 0
      ? { name: decoded.name }
      : {}),
    ...(typeof decoded.email === "string" && decoded.email.trim().length > 0
      ? { email: decoded.email }
      : {}),
  };
}

export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization) {
    next();
    return;
  }

  const jwtSecret = getJwtSecret(res);

  if (!jwtSecret) {
    return;
  }

  try {
    const user = getUserFromAuthorization(authorization, jwtSecret);

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = user;

    next();
  } catch (_error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export default function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  optionalAuthMiddleware(req, res, next);
}
