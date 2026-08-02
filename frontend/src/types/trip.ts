export const tripRoles = ["admin", "user", "guest"] as const;

export type TripRole = (typeof tripRoles)[number];

export type TripParticipantSummary = {
  userId: number;
  name?: string;
  role: TripRole;
};

export type Trip = {
  id: number;
  name: string;
  description: string | null;
  destination: string | null;
  destinationId?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  destinationTimezone?: string | null;
  destinationCountryCode?: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: number;
  participants?: TripParticipantSummary[];
};

export const isTripRole = (role: unknown): role is TripRole =>
  typeof role === "string" && tripRoles.includes(role as TripRole);

export const getUserTripRole = (trip: Trip, userId?: number | null): TripRole | null => {
  if (!userId) {
    return null;
  }

  if (trip.createdBy === userId) {
    return "admin";
  }

  const participantRole = trip.participants?.find(
    (participant) => participant.userId === userId
  )?.role;

  return isTripRole(participantRole) ? participantRole : null;
};

export const formatTripDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};
