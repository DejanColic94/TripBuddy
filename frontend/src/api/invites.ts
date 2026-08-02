import { API_BASE_URL } from "../config/api";
import type { TripRole } from "../types/trip";

export type TripInvite = {
  id: number;
  tripId: number;
  email: string;
  token: string;
  role: TripRole;
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
  role: TripRole;
  acceptedAt: string;
  createdAt: string;
  accountCreated: boolean;
};

export type TripInvitePreview = {
  tripId: number;
  tripName: string;
  email: string;
  role: TripRole;
  accountExists: boolean;
  expiresAt: string;
};

export type GuestAccessResponse = {
  tripId: number;
  displayName: string;
  guestToken: string;
  expiresInDays: number;
};

export async function continueAsGuest(
  inviteToken: string,
  displayName: string
): Promise<GuestAccessResponse> {
  const response = await fetch(
    `${API_BASE_URL}/trips/invites/${encodeURIComponent(inviteToken.trim())}/guest`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayName.trim() }),
    }
  );
  const data = await readJsonSafely(response);
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Failed to continue as guest";
    throw new ApiRequestError(response.status, error);
  }
  return data as GuestAccessResponse;
}

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
  invite: { email: string; role: TripRole }
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
  authorizationToken?: string | null,
  account?: { name: string; password: string }
): Promise<AcceptTripInviteResponse> {
  const trimmedToken = inviteToken.trim();

  if (!trimmedToken) {
    throw new ApiRequestError(400, "Invalid invitation link");
  }

  const headers: HeadersInit = {};

  if (authorizationToken) {
    headers.Authorization = `Bearer ${authorizationToken}`;
  }
  if (account) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}/trips/invites/${encodeURIComponent(trimmedToken)}/accept`, {
    method: "POST",
    headers,
    body: account ? JSON.stringify(account) : undefined,
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

export async function fetchTripInvitePreview(
  inviteToken: string
): Promise<TripInvitePreview> {
  const trimmedToken = inviteToken.trim();

  if (!trimmedToken) {
    throw new ApiRequestError(400, "Invalid invitation link");
  }

  const response = await fetch(
    `${API_BASE_URL}/trips/invites/${encodeURIComponent(trimmedToken)}`
  );
  const data = await readJsonSafely(response);

  if (!response.ok) {
    const error =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Failed to load invitation";
    throw new ApiRequestError(response.status, error);
  }

  return data as TripInvitePreview;
}
