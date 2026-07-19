export type IdentityUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type CreateInvitedUserResult = {
  user: IdentityUser;
  created: boolean;
};

export class IdentityClientError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const identityRequestTimeoutMs = 3000;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new IdentityClientError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isIdentityUser(value: unknown): value is IdentityUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const user = value as IdentityUser;

  return (
    typeof user.id === "number" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.role === "string"
  );
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), identityRequestTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    throw new IdentityClientError("Identity Service request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getUserNames(
  userIds: number[],
  authorization?: string
): Promise<Map<number, string>> {
  const uniqueUserIds = Array.from(new Set(userIds));

  if (uniqueUserIds.length === 0 || !authorization) {
    return new Map();
  }

  const identityServiceUrl =
    process.env.IDENTITY_SERVICE_URL || "http://localhost:4001";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), identityRequestTimeoutMs);

  try {
    const response = await fetch(
      `${identityServiceUrl}/users?ids=${uniqueUserIds.join(",")}`,
      {
        headers: {
          Authorization: authorization,
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return new Map();
    }

    const users = (await response.json()) as IdentityUser[];

    if (!Array.isArray(users)) {
      return new Map();
    }

    return new Map(
      users
        .filter(
          (user) =>
            typeof user.id === "number" &&
            typeof user.name === "string" &&
            user.name.trim().length > 0
        )
        .map((user) => [user.id, user.name])
    );
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getUserByEmail(email: string): Promise<IdentityUser | null> {
  const identityServiceUrl = normalizeBaseUrl(getRequiredEnv("IDENTITY_SERVICE_URL"));
  const internalServiceSecret = getRequiredEnv("INTERNAL_SERVICE_SECRET");
  const response = await fetchWithTimeout(
    `${identityServiceUrl}/internal/users/by-email?email=${encodeURIComponent(email)}`,
    {
      headers: {
        "X-Internal-Service-Secret": internalServiceSecret,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new IdentityClientError("Identity Service user lookup failed");
  }

  const user = await response.json();

  if (!isIdentityUser(user)) {
    throw new IdentityClientError("Identity Service returned an invalid user");
  }

  return user;
}

export async function createInvitedUser(
  email: string
): Promise<CreateInvitedUserResult> {
  const identityServiceUrl = normalizeBaseUrl(getRequiredEnv("IDENTITY_SERVICE_URL"));
  const internalServiceSecret = getRequiredEnv("INTERNAL_SERVICE_SECRET");
  const response = await fetchWithTimeout(
    `${identityServiceUrl}/internal/users/invited`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Service-Secret": internalServiceSecret,
      },
      body: JSON.stringify({ email }),
    }
  );

  if (response.status === 409) {
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      return {
        user: existingUser,
        created: false,
      };
    }

    throw new IdentityClientError("Identity Service invited user conflict");
  }

  if (response.status !== 201) {
    throw new IdentityClientError("Identity Service invited user creation failed");
  }

  const data = (await response.json()) as { user?: unknown };

  if (!isIdentityUser(data.user)) {
    throw new IdentityClientError("Identity Service returned an invalid invited user");
  }

  return {
    user: data.user,
    created: true,
  };
}
