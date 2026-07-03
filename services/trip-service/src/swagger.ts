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
            destination: { type: "string", nullable: true, example: "Paris, France" },
            startDate: { type: "string", nullable: true, example: "2026-06-01" },
            endDate: { type: "string", nullable: true, example: "2026-06-07" },
            createdBy: { type: "number", example: 1 },
            createdAt: { type: "string", example: "2026-05-31T10:00:00.000Z" },
            start_date: { type: "string", nullable: true, example: "2026-06-01" },
            end_date: { type: "string", nullable: true, example: "2026-06-07" },
            created_by: { type: "number", example: 1 },
            created_at: { type: "string", example: "2026-05-31T10:00:00.000Z" },
            participants: {
              type: "array",
              items: { $ref: "#/components/schemas/TripParticipantSummary" },
            },
          },
        },
        TripParticipantSummary: {
          type: "object",
          properties: {
            userId: { type: "number", example: 2 },
            name: { type: "string", example: "Ana Petrovic" },
            role: { type: "string", example: "viewer" },
          },
        },
        CreateTripRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Paris" },
            description: { type: "string", example: "Spring city break" },
            destination: { type: "string", example: "Paris, France" },
            startDate: { type: "string", example: "2026-06-01" },
            endDate: { type: "string", example: "2026-06-07" },
          },
        },
        UpdateTripRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Paris" },
            description: { type: "string", nullable: true, example: "Spring city break" },
            destination: { type: "string", nullable: true, example: "Paris, France" },
            startDate: { type: "string", nullable: true, example: "2026-06-01" },
            endDate: { type: "string", nullable: true, example: "2026-06-07" },
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
        TripParticipant: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            tripId: { type: "number", example: 1 },
            userId: { type: "number", example: 2 },
            name: { type: "string", example: "Ana Petrovic" },
            role: { type: "string", example: "viewer" },
            createdAt: { type: "string", example: "2026-06-18T10:00:00.000Z" },
          },
        },
        AddTripParticipantRequest: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "number", example: 2 },
            role: { type: "string", enum: ["viewer"], example: "viewer" },
          },
        },
        TripInvite: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            tripId: { type: "number", example: 1 },
            email: { type: "string", example: "user@example.com" },
            token: { type: "string", example: "a-secure-random-token" },
            role: { type: "string", example: "viewer" },
            acceptedAt: {
              type: "string",
              nullable: true,
              example: "2026-06-18T10:00:00.000Z",
            },
            createdAt: { type: "string", example: "2026-06-18T09:00:00.000Z" },
          },
        },
        CreateTripInviteRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", example: "user@example.com" },
            role: { type: "string", enum: ["viewer"], example: "viewer" },
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
          summary: "Get owned and shared trips for the authenticated user",
          description:
            "Returns trips created by the authenticated user and trips where the user is a participant. Duplicate trips are removed and each trip includes its participants.",
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
          description: "Creates a trip and automatically adds the creator as an owner participant.",
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
      "/trips/{tripId}": {
        get: {
          summary: "Get trip details",
          description: "Allowed for the trip creator or any participant on the trip.",
          tags: ["Trips"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "200": {
              description: "Trip details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Trip" },
                },
              },
            },
            "400": { description: "Invalid trip id" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
        put: {
          summary: "Update a trip",
          description: "Only the trip creator can update a trip.",
          tags: ["Trips"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateTripRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated trip",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Trip" },
                },
              },
            },
            "400": { description: "Invalid request" },
            "401": { description: "Unauthorized" },
            "403": { description: "Authenticated user is not the trip owner" },
            "404": { description: "Trip not found" },
          },
        },
        delete: {
          summary: "Delete a trip",
          description: "Only the trip creator can delete a trip and its related data.",
          tags: ["Trips"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "204": { description: "Trip deleted" },
            "400": { description: "Invalid trip id" },
            "401": { description: "Unauthorized" },
            "403": { description: "Authenticated user is not the trip owner" },
            "404": { description: "Trip not found" },
          },
        },
      },
      "/trips/{tripId}/participants": {
        get: {
          summary: "Get trip participants",
          description: "Allowed for the trip creator or any participant on the trip.",
          tags: ["Participants"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "200": {
              description: "Trip participants",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TripParticipant" },
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
          summary: "Add a trip participant",
          description: "Only the trip creator can add participants.",
          tags: ["Participants"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AddTripParticipantRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created trip participant",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TripParticipant" },
                },
              },
            },
            "400": { description: "Invalid request" },
            "409": { description: "Participant already exists" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
      },
      "/trips/{tripId}/invites": {
        get: {
          summary: "Get trip invites",
          description: "Only the trip creator can list invites for a trip.",
          tags: ["Invites"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          responses: {
            "200": {
              description: "Trip invites",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TripInvite" },
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
          summary: "Create a trip invite",
          description: "Only the trip creator can create invite tokens.",
          tags: ["Invites"],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "number" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTripInviteRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created trip invite",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TripInvite" },
                },
              },
            },
            "400": { description: "Invalid request" },
            ...authResponses,
            ...notFoundResponse,
          },
        },
      },
      "/trips/invites/{token}/accept": {
        post: {
          summary: "Accept a trip invite",
          description:
            "Adds the authenticated user as a trip participant with the invite role and marks the invite accepted.",
          tags: ["Invites"],
          parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Accepted trip invite",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TripInvite" },
                },
              },
            },
            "409": { description: "Invite already accepted" },
            "404": { description: "Invite not found" },
            ...authResponses,
          },
        },
      },
      "/trips/{tripId}/summary": {
        get: {
          summary: "Get trip summary",
          description: "Allowed for the trip creator or any participant on the trip.",
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
          description: "Allowed for the trip creator or any participant on the trip.",
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
          description: "Only the trip creator can create itinerary items.",
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
          description: "Allowed for the trip creator or any participant on the trip.",
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
          description: "Only the trip creator can create expenses.",
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
