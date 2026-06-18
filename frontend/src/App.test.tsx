import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type MockResponseBody = Record<string, unknown> | Array<Record<string, unknown>>;

const trip = {
  id: 1,
  name: "Paris",
  description: "Museum weekend",
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  createdBy: 7,
};

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
        return mockResponse([ownerParticipant]);
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

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await screen.findAllByText("User #7");

    await user.type(screen.getByLabelText(/user id/i), "8");
    await user.selectOptions(screen.getByLabelText(/role/i), "viewer");
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

      if (url.endsWith("/trips/1/itinerary") || url.endsWith("/trips/1/expenses")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));
    await screen.findAllByText("User #7");

    await user.type(screen.getByLabelText(/user id/i), "7");
    await user.click(screen.getByRole("button", { name: /add participant/i }));

    expect(await screen.findByText("Participant already exists")).toBeInTheDocument();
  });
});
