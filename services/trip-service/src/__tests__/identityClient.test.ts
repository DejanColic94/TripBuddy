import {
  createInvitedUser,
  getUserByEmail,
  getUserNames,
} from "../clients/identityClient";

describe("getUserNames", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("returns an empty map when the identity request times out", async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;

    jest.spyOn(global, "fetch").mockImplementation((_input, init) => {
      requestSignal = init?.signal ?? undefined;

      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const resultPromise = getUserNames([1], "Bearer token");
    await jest.advanceTimersByTimeAsync(3000);

    await expect(resultPromise).resolves.toEqual(new Map());
    expect(requestSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears the timeout after a successful request", async () => {
    jest.useFakeTimers();
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: "Ana Traveler" }],
    } as Response);

    await expect(getUserNames([1], "Bearer token")).resolves.toEqual(
      new Map([[1, "Ana Traveler"]])
    );
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("internal identity client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      IDENTITY_SERVICE_URL: "http://identity-service:4001/",
      INTERNAL_SERVICE_SECRET: "internal-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("parses a user lookup response and sends the internal secret header", async () => {
    let requestedUrl = "";
    let requestHeaders: HeadersInit | undefined;
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      requestedUrl = input.toString();
      requestHeaders = init?.headers;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          name: "Ana Traveler",
          email: "ana@example.com",
          role: "user",
        }),
      } as Response;
    });

    await expect(getUserByEmail("ana+trip@example.com")).resolves.toEqual({
      id: 1,
      name: "Ana Traveler",
      email: "ana@example.com",
      role: "user",
    });
    expect(requestedUrl).toBe(
      "http://identity-service:4001/internal/users/by-email?email=ana%2Btrip%40example.com"
    );
    expect(requestHeaders).toEqual({
      "X-Internal-Service-Secret": "internal-secret",
    });
  });

  it("returns null when lookup returns 404", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "User not found" }),
    } as Response);

    await expect(getUserByEmail("missing@example.com")).resolves.toBeNull();
  });

  it("throws when lookup returns a non-404 failure", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed" }),
    } as Response);

    await expect(getUserByEmail("ana@example.com")).rejects.toThrow(
      "Identity Service user lookup failed"
    );
  });

  it("parses an invited-user creation response", async () => {
    let requestBody = "";
    jest.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
      requestBody = String(init?.body);

      return {
        ok: true,
        status: 201,
        json: async () => ({
          user: {
            id: 2,
            name: "New Traveler",
            email: "new@example.com",
            role: "user",
          },
        }),
      } as Response;
    });

    await expect(createInvitedUser("new@example.com")).resolves.toEqual({
      user: {
        id: 2,
        name: "New Traveler",
        email: "new@example.com",
        role: "user",
      },
      created: true,
    });
    expect(JSON.parse(requestBody)).toEqual({ email: "new@example.com" });
  });

  it("returns created false when invited-user creation returns 409 and lookup finds the user", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (input.toString().endsWith("/internal/users/invited")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "User already exists" }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 3,
          name: "Existing Traveler",
          email: "existing@example.com",
          role: "user",
        }),
      } as Response;
    });

    await expect(createInvitedUser("existing@example.com")).resolves.toEqual({
      user: {
        id: 3,
        name: "Existing Traveler",
        email: "existing@example.com",
        role: "user",
      },
      created: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when invited-user creation returns 409 and lookup still misses", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (input.toString().endsWith("/internal/users/invited")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "User already exists" }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "User not found" }),
      } as Response;
    });

    await expect(createInvitedUser("race@example.com")).rejects.toThrow(
      "Identity Service invited user conflict"
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws for network or timeout failures and clears the timeout", async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    jest.spyOn(global, "fetch").mockImplementation((_input, init) => {
      requestSignal = init?.signal ?? undefined;

      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const resultPromise = getUserByEmail("timeout@example.com");
    const expectation = expect(resultPromise).rejects.toThrow(
      "Identity Service request failed"
    );
    await jest.advanceTimersByTimeAsync(3000);

    await expectation;
    expect(requestSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("throws when IDENTITY_SERVICE_URL is missing", async () => {
    delete process.env.IDENTITY_SERVICE_URL;

    await expect(getUserByEmail("ana@example.com")).rejects.toThrow(
      "Missing required environment variable: IDENTITY_SERVICE_URL"
    );
  });

  it("throws when INTERNAL_SERVICE_SECRET is missing", async () => {
    delete process.env.INTERNAL_SERVICE_SECRET;

    await expect(getUserByEmail("ana@example.com")).rejects.toThrow(
      "Missing required environment variable: INTERNAL_SERVICE_SECRET"
    );
  });
});
