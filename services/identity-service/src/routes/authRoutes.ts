import { Router } from "express";
import pool from "../db";

const router = Router();

router.get("/test", (_req, res) => {
  return res.status(200).json({
    message: "Auth routing works",
  });
});

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role;",
      [email, password]
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    console.error("[IDENTITY] Register failed:", error);
    return res.status(500).json({
      message: "Failed to register user",
    });
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  return res.status(200).json({
    message: "Login successful",
    token: "fake-jwt-token-for-now",
    user: {
      id: 1,
      email,
      role: "user",
    },
  });
});

router.get("/me", (_req, res) => {
  return res.status(200).json({
    id: 1,
    email: "test@test.com",
    role: "user",
  });
});

export default router;
