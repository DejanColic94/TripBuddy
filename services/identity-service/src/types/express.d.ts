import type { AuthenticatedUser } from "../middleware/authMiddleware";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
