import { Router } from "express";

const router = Router();

router.get("/test", (_req, res) => {
  return res.status(200).json({
    message: "Auth routing works",
  });
});

router.post("/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  return res.status(201).json({
    message: "User registered successfully",
    user: {
      id: 1,
      email,
      role: "user",
    },
  });
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