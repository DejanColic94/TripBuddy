import { timingSafeEqual } from "crypto";
import { type NextFunction, type Request, type Response } from "express";

function timingSafeStringEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const maxLength = Math.max(expectedBuffer.length, suppliedBuffer.length);

  const paddedExpected = Buffer.alloc(maxLength);
  const paddedSupplied = Buffer.alloc(maxLength);
  expectedBuffer.copy(paddedExpected);
  suppliedBuffer.copy(paddedSupplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(paddedExpected, paddedSupplied)
  );
}

export default function internalServiceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET?.trim();

  if (!expectedSecret) {
    res.status(500).json({
      error: "Internal service authentication is not configured",
    });
    return;
  }

  const suppliedSecret = req.get("X-Internal-Service-Secret");

  if (
    !suppliedSecret ||
    !timingSafeStringEqual(expectedSecret, suppliedSecret)
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
