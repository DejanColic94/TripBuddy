import swaggerJsdoc from "swagger-jsdoc";

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TripBuddy Identity Service API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:4001",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        AuthRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", example: "user@example.com" },
            password: { type: "string", example: "password123" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            email: { type: "string", example: "user@example.com" },
            role: { type: "string", example: "user" },
          },
        },
        Message: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/register": {
        post: {
          summary: "Register a new user",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "User registered successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "400": { description: "Missing or invalid request body" },
            "409": { description: "Email already exists" },
            "500": { description: "Failed to register user" },
          },
        },
      },
      "/login": {
        post: {
          summary: "Log in and receive a JWT",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      token: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid credentials" },
            "500": { description: "Failed to login" },
          },
        },
      },
      "/me": {
        get: {
          summary: "Get current authenticated user",
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Authenticated user",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
    },
  },
  apis: [],
});

export default swaggerSpec;
