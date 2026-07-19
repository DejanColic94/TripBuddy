import { API_BASE_URL } from "../config/api";

export type TripInvite = {
  id: number;
  tripId: number;
  email: string;
  token: string;
  role: string;
  acceptedAt: string | null;
  accepted_at?: string | null;
  createdAt: string;
};

export type ApiError = {
  error?: string;
};

export class ApiRequestError extends Error {
  status: number;
  error: string;

  constructor(status: number, error: string) {
    super(error);
    this.name = "ApiRequestError";
    this.status = status;
    this.error = error;
  }
}

export type AcceptTripInviteResponse = {
  id: number;
  tripId: number;
  email: string;
  token: string;
  role: string;
  acceptedAt: string;
  createdAt: string;
  accountCreated: boolean;
};

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchTripInvites(tripId: number, token: string) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}/invites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await response.json()) as TripInvite[] | ApiError;

  return { response, data };
}

export async function createTripInvite(
  tripId: number,
  token: string,
  invite: { email: string; role: string }
) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(invite),
  });
  const data = (await response.json()) as TripInvite | ApiError;

  return { response, data };
}

export async function acceptTripInvite(
  inviteToken: string,
  authorizationToken?: string | null
): Promise<AcceptTripInviteResponse> {
  const trimmedToken = inviteToken.trim();

  if (!trimmedToken) {
    throw new ApiRequestError(400, "Invalid invitation link");
  }

  const headers: HeadersInit = {};

  if (authorizationToken) {
    headers.Authorization = `Bearer ${authorizationToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/trips/invites/${encodeURIComponent(trimmedToken)}/accept`, {
    method: "POST",
    headers,
  });
  const data = await readJsonSafely(response);

  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Failed to accept trip invite";

    throw new ApiRequestError(response.status, error);
  }

  return data as AcceptTripInviteResponse;
}
