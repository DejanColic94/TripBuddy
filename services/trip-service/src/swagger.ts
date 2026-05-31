import swaggerJsdoc from "swagger-jsdoc";

const authResponses = {
  "401": { description: "Unauthorized" },
};

const notFoundResponse = {
  "404": { description: "Trip not found" },
};

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TripBuddy Trip Service API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:4002",
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
        Trip: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            name: { type: "string", example: "Paris" },
            description: { type: "string", nullable: true, example: "Spring city break" },
            startDate: { type: "string", nullable: true, example: "2026-06-01" },
            endDate: { type: "string", nullable: true, example: "2026-06-07" },
            createdBy: { type: "number", example: 1 },
          },
        },
        CreateTripRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Paris" },
            description: { type: "string", example: "Spring city break" },
            startDate: { type: "string", example: "2026-06-01" },
            endDate: { type: "string", example: "2026-06-07" },
          },
        },
        TripSummary: {
          type: "object",
          properties: {
            itineraryCount: { type: "number", example: 3 },
            expenseCount: { type: "number", example: 2 },
            totalExpenses: { type: "number", example: 1250 },
            tripDurationDays: { type: "number", example: 6 },
          },
        },
        ItineraryItem: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            tripId: { type: "number", example: 1 },
            title: { type: "string", example: "Museum visit" },
            description: { type: "string", nullable: true, example: "Book tickets ahead" },
            scheduledDate: { type: "string", nullable: true, example: "2026-06-03" },
            createdAt: { type: "string", example: "2026-05-31T10:00:00.000Z" },
          },
        },
        CreateItineraryItemRequest: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string", example: "Museum visit" },
            description: { type: "string", example: "Book tickets ahead" },
            scheduledDate: { type: "string", example: "2026-06-03" },
          },
        },
        Expense: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            tripId: { type: "number", example: 1 },
            title: { type: "string", example: "Hotel" },
            amount: { type: "number", example: 250 },
            currency: { type: "string", example: "EUR" },
            category: { type: "string", nullable: true, example: "Accommodation" },
            createdAt: { type: "string", example: "2026-05-31T10:00:00.000Z" },
          },
        },
        CreateExpenseRequest: {
          type: "object",
          required: ["title", "amount"],
          properties: {
            title: { type: "string", example: "Hotel" },
            amount: { type: "number", example: 250 },
            currency: { type: "string", example: "EUR" },
            category: { type: "string", example: "Accommodation" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/trips": {
        get: {
          summary: "Get trips for the authenticated user",
          tags: ["Trips"],
          responses: {
            "200": {
              description: "List of trips",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Trip" },
                  },
                },
              },
            },
            ...authResponses,
          },
        },
        post: {
          summary: "Create a trip",
          tags: ["Trips"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTripRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created trip",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Trip" },
                },
              },
            },
            "400": { description: "Invalid request body" },
            ...authResponses,
          },
        },
      },
      "/trips/{tripId}/summary": {
        get: {
          summary: "Get trip summary",
          tags: ["Trips"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "200": {
              description: "Trip summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TripSummary" },
                },
              },
            },
            "400": { description: "Invalid trip id" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
      },
      "/trips/{tripId}/itinerary": {
        get: {
          summary: "Get itinerary items for a trip",
          tags: ["Itinerary"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "200": {
              description: "Itinerary items",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ItineraryItem" },
                  },
                },
              },
            },
            "400": { description: "Invalid trip id" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
        post: {
          summary: "Create an itinerary item",
          tags: ["Itinerary"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateItineraryItemRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created itinerary item",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ItineraryItem" },
                },
              },
            },
            "400": { description: "Invalid request" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
      },
      "/trips/{tripId}/expenses": {
        get: {
          summary: "Get expenses for a trip",
          tags: ["Expenses"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "200": {
              description: "Expenses",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Expense" },
                  },
                },
              },
            },
            "400": { description: "Invalid trip id" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
        post: {
          summary: "Create an expense",
          tags: ["Expenses"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateExpenseRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created expense",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Expense" },
                },
              },
            },
            "400": { description: "Invalid request" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
      },
    },
  },
  apis: [],
});

export default swaggerSpec;
