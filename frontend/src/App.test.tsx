import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type MockResponseBody = Record<string, unknown> | Array<Record<string, unknown>>;

const ownerParticipant = {
  id: 1,
  tripId: 1,
  userId: 7,
  role: "owner",
  createdAt: "2026-06-18T10:00:00.000Z",
};

const viewerParticipant = {
  id: 2,
  tripId: 1,
  userId: 8,
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
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  createdBy: 7,
  participants: [ownerParticipant],
};

const sharedTrip = {
  id: 2,
  name: "Lisbon",
  description: "Shared coast plan",
  startDate: "2026-07-10",
  endDate: "2026-07-14",
  createdBy: 11,
  participants: [
    { userId: 11, role: "owner" },
    { userId: 7, role: "viewer" },
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
      return mockResponse({ token: "test-token" });
    }

    if (url.endsWith("/trips") && !init?.method) {
      return mockResponse([]);
    }

    return mockResponse({});
  });
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

  it("stores token after successful login", async () => {
    const user = userEvent.setup();
    mockDefaultApi();

    render(<App />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(localStorage.getItem("token")).toBe("test-token"));
    expect(await screen.findByRole("heading", { name: /your trips/i })).toBeInTheDocument();
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
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([trip]);
      }

      return mockResponse({});
    });

    render(<App />);

    const tripCard = (await screen.findByText("Paris")).closest("li") as HTMLElement;

    expect(within(tripCard).getByText("Participants")).toBeInTheDocument();
    expect(within(tripCard).getByText(/User #7.*owner/)).toBeInTheDocument();
  });

  it("renders shared trips in the dashboard", async () => {
    localStorage.setItem("token", "test-token");
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([sharedTrip]);
      }

      return mockResponse({});
    });

    render(<App />);

    const sharedTripCard = (await screen.findByText("Lisbon")).closest("li") as HTMLElement;

    expect(within(sharedTripCard).getByText("Shared coast plan")).toBeInTheDocument();
    expect(within(sharedTripCard).getByText(/User #7.*viewer/)).toBeInTheDocument();
  });

  it("creates a trip and adds it to the list", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
    expect(within(participantsSection).getByText("User #7")).toBeInTheDocument();
    expect(within(participantsSection).getByText("owner")).toBeInTheDocument();
    expect(within(participantsSection).getByText("User #8")).toBeInTheDocument();
    expect(within(participantsSection).getByText("viewer")).toBeInTheDocument();
  });

  it("renders trip invites in trip details", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
    await screen.findAllByText("User #7");

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
    expect(await screen.findByText("User #8")).toBeInTheDocument();
  });

  it("shows duplicate participant error", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "test-token");
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
    await screen.findAllByText("User #7");

    await user.type(screen.getByLabelText(/participant user id/i), "7");
    await user.click(screen.getByRole("button", { name: /add participant/i }));

    expect(await screen.findByText("Participant already exists")).toBeInTheDocument();
  });

  it("shows success when accepting an invite", async () => {
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
    localStorage.setItem("token", "test-token");
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
