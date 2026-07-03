type IdentityUser = {
  id: number;
  name: string;
};

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
  const timeoutId = setTimeout(() => controller.abort(), 3000);

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
