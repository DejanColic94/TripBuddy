import { Router } from "express";
import pool from "../db";
import internalServiceAuthMiddleware from "../middleware/internalServiceAuthMiddleware";

type UserLookupRow = {
  id: number;
  name: string;
  email: string;
  role: string;
};

const router = Router();

router.use(internalServiceAuthMiddleware);

router.get("/users/by-email", async (req, res) => {
  const email = req.query.email;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ error: "email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query<UserLookupRow>(
      "SELECT id, name, email, role FROM users WHERE LOWER(email) = $1;",
      [normalizedEmail]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("[IDENTITY] Internal user email lookup failed:", error);
    return res.status(500).json({ error: "Failed to look up user" });
  }
});

export default router;
