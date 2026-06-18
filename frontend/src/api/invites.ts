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

export async function acceptTripInvite(inviteToken: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/trips/invites/${inviteToken}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await response.json()) as TripInvite | ApiError;

  return { response, data };
}
