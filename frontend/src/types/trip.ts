export type TripParticipantSummary = {
  userId: number;
  name?: string;
  role: string;
};

export type Trip = {
  id: number;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: number;
  participants?: TripParticipantSummary[];
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
