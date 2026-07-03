import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: number;
  email: string;
  name?: string;
  role: string;
}

export default function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const token = authorization.split(" ")[1];
  const jwtSecret = process.env.IDENTITY_JWT_SECRET;

  if (!jwtSecret) {
    res.status(500).json({
      message: "Authentication configuration error",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("id" in decoded) ||
      !("email" in decoded) ||
      !("role" in decoded)
    ) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    req.user = {
      id: Number(decoded.id),
      email: String(decoded.email),
      name: "name" in decoded ? String(decoded.name) : undefined,
      role: String(decoded.role),
    };

    next();
  } catch (_error) {
    res.status(401).json({
      message: "Unauthorized",
    });
  }
}
