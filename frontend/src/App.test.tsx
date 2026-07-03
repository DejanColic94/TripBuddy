import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Trip } from "./types/trip";

type MockResponseBody = Record<string, unknown> | Array<Record<string, unknown>>;

const authUser = {
  id: 7,
  name: "Ana Traveler",
  email: "test@example.com",
  role: "user",
};

const ownerParticipant = {
  id: 1,
  tripId: 1,
  userId: 7,
  name: "Ana Traveler",
  role: "owner",
  createdAt: "2026-06-18T10:00:00.000Z",
};

const viewerParticipant = {
  id: 2,
  tripId: 1,
  userId: 8,
  name: "Milan Traveler",
  role: "viewer",
  createdAt: "2026-06-18T10:05:00.000Z",
};

const invite = {
  id: 1,
  tripId: 1,
  email: "friend@example.com",
  token: "invite-token-123",
  role: "viewer",
  acceptedAt: null,
  createdAt: "2026-06-18T10:10:00.000Z",
};

const acceptedInvite = {
  ...invite,
  acceptedAt: "2026-06-18T10:20:00.000Z",
};

const trip = {
  id: 1,
  name: "Paris",
  description: "Museum weekend",
  destination: "Paris, France",
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  createdBy: 7,
  participants: [ownerParticipant],
};

const sharedTrip = {
  id: 2,
  name: "Lisbon",
  description: "Shared coast plan",
  destination: "Lisbon, Portugal",
  startDate: "2026-07-10",
  endDate: "2026-07-14",
  createdBy: 11,
  participants: [
    { userId: 11, name: "Trip Owner", role: "owner" },
    { userId: 7, name: "Ana Traveler", role: "viewer" },
  ],
};

function mockResponse(body: MockResponseBody, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      handler(input.toString(), init)
    )
  );
}

function mockDefaultApi() {
  mockFetch((url, init) => {
    if (url.endsWith("/auth/login") && init?.method === "POST") {
      return mockResponse({ token: "test-token", user: authUser });
    }

    if (url.endsWith("/trips") && !init?.method) {
      return mockResponse([]);
    }

    return mockResponse({});
  });
}

function mockTripDetailsRead(url: string, selectedTrip: Trip = trip) {
  if (url.endsWith(`/trips/${selectedTrip.id}/summary`)) {
    return mockResponse({
      itineraryCount: 0,
      expenseCount: 0,
      totalExpenses: 0,
      tripDurationDays: 4,
    });
  }

  if (url.endsWith(`/trips/${selectedTrip.id}/participants`)) {
    return mockResponse(selectedTrip.participants ?? []);
  }

  if (url.endsWith(`/trips/${selectedTrip.id}/invites`)) {
    return mockResponse([]);
  }

  if (
    url.endsWith(`/trips/${selectedTrip.id}/itinerary`) ||
    url.endsWith(`/trips/${selectedTrip.id}/expenses`)
  ) {
    return mockResponse([]);
  }

  if (url.endsWith(`/trips/${selectedTrip.id}`)) {
    return mockResponse(selectedTrip);
  }

  return null;
}

function setAuthenticatedSession() {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify(authUser));
}

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TripBuddy frontend", () => {
  it("renders login page by default", () => {
    mockDefaultApi();

    render(<App />);

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("switches to register page", async () => {
    const user = userEvent.setup();
    mockDefaultApi();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByRole("heading", { name: "Register" })).toBeInTheDocument();
  });

  it("registers with a name and returns to login", async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith("/auth/register") && init?.method === "POST") {
        return mockResponse({ message: "User registered successfully" }, 201);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Ana Traveler");
    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^register$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/register"),
        expect.objectContaining({
          body: JSON.stringify({
            name: "Ana Traveler",
            email: "ana@example.com",
            password: "password123",
          }),
        })
      )
    );
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("stores token after successful login", async () => {
    const user = userEvent.setup();
    mockDefaultApi();

    render(<App />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(localStorage.getItem("token")).toBe("test-token"));
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toEqual(authUser);
    expect(await screen.findByRole("heading", { name: /your trips/i })).toBeInTheDocument();
    expect(screen.getByText("Ana Traveler")).toBeInTheDocument();
  });

  it("restores a missing user from /auth/me for a legacy token session", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "legacy-token");
    mockFetch((url) => {
      if (url.endsWith("/auth/me")) {
        return mockResponse(authUser);
      }

      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      return mockTripDetailsRead(url) ?? mockResponse({});
    });

    render(<App />);

    expect(await screen.findByText("Ana Traveler")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toEqual(authUser);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    expect(await screen.findByRole("button", { name: /edit trip/i })).toBeInTheDocument();
  });

  it("logs out when restoring a legacy token session fails", async () => {
    localStorage.setItem("token", "invalid-legacy-token");
    mockFetch((url) => {
      if (url.endsWith("/auth/me")) {
        return mockResponse({ message: "Unauthorized" }, 401);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("shows error on failed login", async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.endsWith("/auth/login")) {
        return mockResponse({ message: "Invalid credentials" }, 400);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("fetches and displays trips when token exists", async () => {
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("Museum weekend")).toBeInTheDocument();
  });

  it("displays participants on dashboard trip cards", async () => {
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      return mockResponse({});
    });

    render(<App />);

    const tripCard = (await screen.findByText("Paris")).closest("li") as HTMLElement;

    expect(within(tripCard).getByText("Participants")).toBeInTheDocument();
    expect(within(tripCard).getByText(/Ana Traveler.*owner/)).toBeInTheDocument();
  });

  it("renders shared trips in the dashboard", async () => {
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([sharedTrip]);
      }

      return mockResponse({});
    });

    render(<App />);

    const sharedTripCard = (await screen.findByText("Lisbon")).closest("li") as HTMLElement;

    expect(within(sharedTripCard).getByText("Shared coast plan")).toBeInTheDocument();
    expect(within(sharedTripCard).getByText(/Ana Traveler.*viewer/)).toBeInTheDocument();
  });

  it("allows an owner to edit a trip and shows updated data", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    localStorage.setItem("user", JSON.stringify(authUser));
    let activeTrip = trip;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips/1") && init?.method === "PUT") {
        activeTrip = {
          ...trip,
          name: "Rome Adventure",
          description: "Updated plan",
          destination: "Rome, Italy",
        };
        return mockResponse(activeTrip);
      }

      if (url.endsWith("/trips") && !init?.method) {
        return mockResponse([activeTrip]);
      }

      return mockTripDetailsRead(url, activeTrip) ?? mockResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await user.click(await screen.findByRole("button", { name: /edit trip/i }));
    const editPanel = screen.getByRole("heading", { name: "Edit trip" }).closest("section") as HTMLElement;
    await user.clear(within(editPanel).getByLabelText(/trip name/i));
    await user.type(within(editPanel).getByLabelText(/trip name/i), "Rome Adventure");
    await user.clear(within(editPanel).getByLabelText(/^description$/i));
    await user.type(within(editPanel).getByLabelText(/^description$/i), "Updated plan");
    await user.clear(within(editPanel).getByLabelText(/^destination$/i));
    await user.type(within(editPanel).getByLabelText(/^destination$/i), "Rome, Italy");
    await user.click(within(editPanel).getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/trips/1"),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"name":"Rome Adventure"'),
        })
      )
    );
    expect((await screen.findAllByText("Rome Adventure")).length).toBeGreaterThan(0);
    expect(screen.getByText("Rome, Italy")).toBeInTheDocument();
  });

  it("allows an owner to delete a trip and removes it from the dashboard", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    localStorage.setItem("user", JSON.stringify(authUser));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let deleted = false;
    mockFetch((url, init) => {
      if (url.endsWith("/trips/1") && init?.method === "DELETE") {
        deleted = true;
        return mockResponse({}, 204);
      }

      if (url.endsWith("/trips") && !init?.method) {
        return mockResponse(deleted ? [] : [trip]);
      }

      return mockTripDetailsRead(url) ?? mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await user.click(await screen.findByRole("button", { name: /delete trip/i }));

    expect(await screen.findByRole("heading", { name: /your trips/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Paris")).not.toBeInTheDocument());
  });

  it("does not show trip management controls to a participant", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    localStorage.setItem("user", JSON.stringify(authUser));
    mockFetch((url, init) => {
      if (url.endsWith("/trips") && !init?.method) {
        return mockResponse([sharedTrip]);
      }

      return mockTripDetailsRead(url, sharedTrip) ?? mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /lisbon/i }));
    await screen.findByText("Trip summary");

    expect(screen.queryByRole("button", { name: /edit trip/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete trip/i })).not.toBeInTheDocument();
  });

  it("shows an error when an owner update fails", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    localStorage.setItem("user", JSON.stringify(authUser));
    mockFetch((url, init) => {
      if (url.endsWith("/trips/1") && init?.method === "PUT") {
        return mockResponse({ error: "Unable to update this trip" }, 500);
      }

      if (url.endsWith("/trips") && !init?.method) {
        return mockResponse([trip]);
      }

      return mockTripDetailsRead(url) ?? mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await user.click(await screen.findByRole("button", { name: /edit trip/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Unable to update this trip")).toBeInTheDocument();
  });

  it("shows an error when an owner delete fails", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    localStorage.setItem("user", JSON.stringify(authUser));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch((url, init) => {
      if (url.endsWith("/trips/1") && init?.method === "DELETE") {
        return mockResponse({ error: "Unable to delete this trip" }, 500);
      }

      if (url.endsWith("/trips") && !init?.method) {
        return mockResponse([trip]);
      }

      return mockTripDetailsRead(url) ?? mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await user.click(await screen.findByRole("button", { name: /delete trip/i }));

    expect(await screen.findByText("Unable to delete this trip")).toBeInTheDocument();
  });

  it("creates a trip and adds it to the list", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url, init) => {
      if (url.endsWith("/trips") && init?.method === "POST") {
        return mockResponse(trip, 201);
      }

      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await screen.findByRole("heading", { name: /your trips/i });
    await user.type(screen.getByLabelText(/^name$/i), "Paris");
    await user.click(screen.getByRole("button", { name: /create trip/i }));

    expect(await screen.findByText("Paris")).toBeInTheDocument();
  });

  it("logs out and removes token", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /logout/i }));

    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("opens trip details and returns to trips list", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      if (url.endsWith("/trips/1/summary")) {
        return mockResponse({
          itineraryCount: 0,
          expenseCount: 0,
          totalExpenses: 0,
          tripDurationDays: 4,
        });
      }

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      if (url.endsWith("/trips/1/participants")) {
        return mockResponse([ownerParticipant, viewerParticipant]);
      }

      if (url.endsWith("/trips/1/invites")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));

    expect(await screen.findByText("Trip summary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to trips/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to trips/i }));

    expect(await screen.findByRole("heading", { name: /your trips/i })).toBeInTheDocument();
  });

  it("loads participants section in trip details", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      if (url.endsWith("/trips/1")) {
        return mockResponse({
          ...trip,
          participants: [ownerParticipant, viewerParticipant],
        });
      }

      if (url.endsWith("/trips/1/summary")) {
        return mockResponse({
          itineraryCount: 0,
          expenseCount: 0,
          totalExpenses: 0,
          tripDurationDays: 4,
        });
      }

      if (url.endsWith("/trips/1/participants")) {
        return mockResponse([ownerParticipant, viewerParticipant]);
      }

      if (url.endsWith("/trips/1/invites")) {
        return mockResponse([invite]);
      }

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));

    const participantsHeading = await screen.findByRole("heading", { name: "Participants" });
    const participantsSection = participantsHeading.closest("section") as HTMLElement;

    expect(participantsHeading).toBeInTheDocument();
    expect(within(participantsSection).getByText("Ana Traveler")).toBeInTheDocument();
    expect(within(participantsSection).getByText("owner")).toBeInTheDocument();
    expect(within(participantsSection).getByText("Milan Traveler")).toBeInTheDocument();
    expect(within(participantsSection).getByText("viewer")).toBeInTheDocument();
  });

  it("renders trip invites in trip details", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      if (url.endsWith("/trips/1/summary")) {
        return mockResponse({
          itineraryCount: 0,
          expenseCount: 0,
          totalExpenses: 0,
          tripDurationDays: 4,
        });
      }

      if (url.endsWith("/trips/1/participants")) {
        return mockResponse([ownerParticipant]);
      }

      if (url.endsWith("/trips/1/invites")) {
        return mockResponse([invite]);
      }

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));

    const invitesHeading = await screen.findByRole("heading", { name: "Invites" });
    const invitesSection = invitesHeading.closest("section") as HTMLElement;

    expect(within(invitesSection).getByText("friend@example.com")).toBeInTheDocument();
    expect(within(invitesSection).getByText("Not accepted")).toBeInTheDocument();
    expect(within(invitesSection).getByText(/invite-token-123/)).toBeInTheDocument();
  });

  it("submits invite form and refreshes invite list", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      if (url.endsWith("/trips/1/summary")) {
        return mockResponse({
          itineraryCount: 0,
          expenseCount: 0,
          totalExpenses: 0,
          tripDurationDays: 4,
        });
      }

      if (url.endsWith("/trips/1/participants")) {
        return mockResponse([ownerParticipant]);
      }

      if (url.endsWith("/trips/1/invites") && init?.method === "POST") {
        return mockResponse(invite, 201);
      }

      if (url.endsWith("/trips/1/invites")) {
        const inviteCalls = fetchMock.mock.calls.filter(([calledUrl]) =>
          calledUrl.toString().endsWith("/trips/1/invites")
        );

        return mockResponse(inviteCalls.length > 1 ? [invite] : []);
      }

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await screen.findByRole("heading", { name: "Invites" });

    await user.type(screen.getByLabelText(/invite email/i), "friend@example.com");
    await user.selectOptions(screen.getByLabelText(/invite role/i), "viewer");
    await user.click(screen.getByRole("button", { name: /create invite/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/trips/1/invites"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "friend@example.com", role: "viewer" }),
        })
      )
    );
    expect(await screen.findByText("friend@example.com")).toBeInTheDocument();
  });

  it("adds a participant and refreshes participants list", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      if (url.endsWith("/trips/1/summary")) {
        return mockResponse({
          itineraryCount: 0,
          expenseCount: 0,
          totalExpenses: 0,
          tripDurationDays: 4,
        });
      }

      if (url.endsWith("/trips/1/participants") && init?.method === "POST") {
        return mockResponse(viewerParticipant, 201);
      }

      if (url.endsWith("/trips/1/participants")) {
        const participantCalls = fetchMock.mock.calls.filter(([calledUrl]) =>
          calledUrl.toString().endsWith("/trips/1/participants")
        );

        return mockResponse(participantCalls.length > 1 ? [ownerParticipant, viewerParticipant] : [ownerParticipant]);
      }

      if (url.endsWith("/trips/1/invites")) {
        return mockResponse([]);
      }

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await screen.findAllByText("Ana Traveler");

    await user.type(screen.getByLabelText(/participant user id/i), "8");
    await user.selectOptions(screen.getByLabelText(/participant role/i), "viewer");
    await user.click(screen.getByRole("button", { name: /add participant/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/trips/1/participants"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: 8, role: "viewer" }),
        })
      )
    );
    expect(await screen.findByText("Milan Traveler")).toBeInTheDocument();
  });

  it("shows duplicate participant error", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url, init) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      if (url.endsWith("/trips/1/summary")) {
        return mockResponse({
          itineraryCount: 0,
          expenseCount: 0,
          totalExpenses: 0,
          tripDurationDays: 4,
        });
      }

      if (url.endsWith("/trips/1/participants") && init?.method === "POST") {
        return mockResponse({ error: "Participant already exists" }, 409);
      }

      if (url.endsWith("/trips/1/participants")) {
        return mockResponse([ownerParticipant]);
      }

      if (url.endsWith("/trips/1/invites")) {
        return mockResponse([]);
      }

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await screen.findAllByText("Ana Traveler");

    await user.type(screen.getByLabelText(/participant user id/i), "7");
    await user.click(screen.getByRole("button", { name: /add participant/i }));

    expect(await screen.findByText("Participant already exists")).toBeInTheDocument();
  });

  it("shows success when accepting an invite", async () => {
    setAuthenticatedSession();
    window.history.pushState({}, "", "/invites/invite-token-123/accept");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/invite-token-123/accept") && init?.method === "POST") {
        return mockResponse(acceptedInvite);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(
      await screen.findByText("Invite accepted. This trip is now available in your dashboard.")
    ).toBeInTheDocument();
  });

  it("shows an error for an invalid invite", async () => {
    setAuthenticatedSession();
    window.history.pushState({}, "", "/invites/bad-token/accept");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/bad-token/accept") && init?.method === "POST") {
        return mockResponse({ error: "Invite not found" }, 404);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByText("Invite not found")).toBeInTheDocument();
  });

  it("shows an error for an already accepted invite", async () => {
    setAuthenticatedSession();
    window.history.pushState({}, "", "/invites/used-token/accept");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/used-token/accept") && init?.method === "POST") {
        return mockResponse({ error: "Invite already accepted" }, 409);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByText("Invite already accepted")).toBeInTheDocument();
  });
});
