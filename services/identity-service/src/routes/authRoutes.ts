import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";
import authMiddleware from "../middleware/authMiddleware";

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
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role;",
      [email, hashedPassword]
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

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, password, role FROM users WHERE email = $1;",
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const jwtSecret = process.env.IDENTITY_JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("IDENTITY_JWT_SECRET is not set");
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[IDENTITY] Login failed:", error);
    return res.status(500).json({
      message: "Failed to login",
    });
  }
});

router.get("/me", authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  return res.status(200).json(req.user);
});

export default router;
