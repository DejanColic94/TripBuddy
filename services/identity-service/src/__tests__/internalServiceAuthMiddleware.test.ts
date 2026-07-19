import { type NextFunction, type Request, type Response } from "express";
import internalServiceAuthMiddleware from "../middleware/internalServiceAuthMiddleware";

function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
}

function createMockRequest(headerValue?: string) {
  return {
    get: jest.fn((headerName: string) =>
      headerName === "X-Internal-Service-Secret" ? headerValue : undefined
    ),
  } as unknown as Request;
}

describe("internalServiceAuthMiddleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      INTERNAL_SERVICE_SECRET: "internal-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it("calls next when the supplied secret is valid", () => {
    const req = createMockRequest("internal-secret");
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    internalServiceAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns 401 when the header is missing", () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    internalServiceAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the supplied secret is incorrect", () => {
    const req = createMockRequest("wrong-secret");
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    internalServiceAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when INTERNAL_SERVICE_SECRET is missing", () => {
    delete process.env.INTERNAL_SERVICE_SECRET;
    const req = createMockRequest("internal-secret");
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    internalServiceAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal service authentication is not configured",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when INTERNAL_SERVICE_SECRET is blank", () => {
    process.env.INTERNAL_SERVICE_SECRET = "   ";
    const req = createMockRequest("internal-secret");
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    internalServiceAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal service authentication is not configured",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 without throwing when the supplied secret has a different length", () => {
    const req = createMockRequest("short");
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    expect(() => internalServiceAuthMiddleware(req, res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("does not trim the supplied header before comparison", () => {
    const req = createMockRequest(" internal-secret ");
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    internalServiceAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });
});
