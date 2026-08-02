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
  emailVerified: true,
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
    await user.type(screen.getByLabelText(/^name$/i), "  Ana Traveler  ");
    await user.type(screen.getByLabelText(/email/i), "ANA@EXAMPLE.COM");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
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
    expect(screen.getByText("User registered successfully")).toBeInTheDocument();
  });

  it("rejects mismatched registration passwords before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Ana Traveler");
    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "different123");
    await user.click(screen.getByRole("button", { name: /^register$/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("offers verification resend when login requires verification", async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith("/auth/login") && init?.method === "POST") {
        return mockResponse({ message: "Email verification required" }, 403);
      }
      if (url.endsWith("/auth/resend-verification") && init?.method === "POST") {
        return mockResponse({
          message:
            "If an unverified account exists for that email, a verification link has been sent",
        });
      }
      return mockResponse({});
    });

    render(<App />);
    await user.type(screen.getByLabelText(/email/i), "TEST@EXAMPLE.COM");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));
    await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

    expect(
      await screen.findByText(/if an unverified account exists/i)
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/resend-verification"),
      expect.objectContaining({
        body: JSON.stringify({ email: "test@example.com" }),
      })
    );
  });

  it("verifies an email from a public link and returns to login", async () => {
    window.history.pushState({}, "", "/verify-email/verification-token-123");
    mockFetch((url, init) => {
      if (url.endsWith("/auth/verify-email") && init?.method === "POST") {
        return mockResponse({ message: "Email verified successfully" });
      }
      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByText("Email verified successfully. You can now log in.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/verify-email"),
      expect.objectContaining({
        body: JSON.stringify({ token: "verification-token-123" }),
      })
    );
  });

  it("shows an expired verification-link error", async () => {
    window.history.pushState({}, "", "/verify-email/expired-token");
    mockFetch((url, init) => {
      if (url.endsWith("/auth/verify-email") && init?.method === "POST") {
        return mockResponse(
          { message: "Verification link is invalid or has expired" },
          400
        );
      }
      return mockResponse({});
    });

    render(<App />);
    expect(
      await screen.findByText("Verification link is invalid or has expired")
    ).toBeInTheDocument();
  });

  it("requests a password reset without revealing whether the account exists", async () => {
    const user = userEvent.setup();
    const genericMessage =
      "If an account exists for that email, a reset link has been sent";
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          input.toString().endsWith("/auth/forgot-password") &&
          init?.method === "POST"
        ) {
          return mockResponse({ message: genericMessage });
        }

        return mockResponse({});
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    await user.type(screen.getByLabelText(/email/i), "TRAVELER@EXAMPLE.COM");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(genericMessage)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/forgot-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "traveler@example.com" }),
      })
    );
  });

  it("resets a password from a public reset link and returns to login", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/reset-password/reset-token-123");
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          input.toString().endsWith("/auth/reset-password") &&
          init?.method === "POST"
        ) {
          return mockResponse({ message: "Password reset successfully" });
        }

        return mockResponse({});
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.type(screen.getByLabelText(/^new password$/i), "new-password-456");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "new-password-456"
    );
    await user.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(
      screen.getByText("Password reset successfully. You can now log in.")
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/reset-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "reset-token-123",
          newPassword: "new-password-456",
        }),
      })
    );
  });

  it("shows an invalid or expired reset-link error", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/reset-password/expired-token");
    mockFetch((url, init) => {
      if (url.endsWith("/auth/reset-password") && init?.method === "POST") {
        return mockResponse(
          { message: "Reset link is invalid or has expired" },
          400
        );
      }

      return mockResponse({});
    });

    render(<App />);
    await user.type(screen.getByLabelText(/^new password$/i), "new-password-456");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "new-password-456"
    );
    await user.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(
      await screen.findByText("Reset link is invalid or has expired")
    ).toBeInTheDocument();
  });

  it("rejects mismatched reset passwords before calling the API", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/reset-password/reset-token-123");
    const fetchMock = vi.fn(() => mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.type(screen.getByLabelText(/^new password$/i), "new-password-456");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "different-password"
    );
    await user.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByText("New passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("opens the profile and displays the current user", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url) => {
      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));

    expect(screen.getByRole("heading", { name: /my profile/i })).toBeInTheDocument();
    expect(screen.getByText("Edit the name other travelers see.")).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toHaveValue("Ana Traveler");
    expect(screen.getByLabelText(/new email/i)).toHaveValue("test@example.com");
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
  });

  it("updates the profile name and stored user", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const updatedUser = { ...authUser, name: "Ana Updated" };
    mockFetch((url, init) => {
      if (url.endsWith("/auth/me") && init?.method === "PATCH") {
        return mockResponse({ token: "refreshed-token", user: updatedUser });
      }

      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "  Ana Updated  ");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Ana Updated");
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toEqual(updatedUser);
    expect(localStorage.getItem("token")).toBe("refreshed-token");
  });

  it("shows a profile update error returned by the server", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url, init) => {
      if (url.endsWith("/auth/me") && init?.method === "PATCH") {
        return mockResponse({ message: "Failed to update profile" }, 500);
      }

      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText("Failed to update profile")).toBeInTheDocument();
  });

  it("logs out when a profile update is unauthorized", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url, init) => {
      if (url.endsWith("/auth/me") && init?.method === "PATCH") {
        return mockResponse({ message: "Unauthorized" }, 401);
      }

      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("requests email verification while keeping the current session", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();

        if (url.endsWith("/auth/me/email") && init?.method === "PATCH") {
          return mockResponse({
            message:
              "Verification email sent. Your current email remains active until you confirm the new address",
          });
        }

        if (url.endsWith("/trips")) {
          return mockResponse([]);
        }

        return mockResponse({});
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    const emailInput = screen.getByLabelText(/new email/i);
    await user.clear(emailInput);
    await user.type(emailInput, "UPDATED@EXAMPLE.COM");
    await user.type(screen.getByLabelText(/^current password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /change email/i }));

    expect(
      await screen.findByText(/current email remains active/i)
    ).toBeInTheDocument();
    expect(emailInput).toHaveValue(authUser.email);
    expect(localStorage.getItem("token")).toBe("test-token");
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toEqual(authUser);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me/email"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          email: "updated@example.com",
          currentPassword: "password123",
        }),
      })
    );
  });

  it("shows an incorrect-password error when changing email", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    mockFetch((url, init) => {
      if (url.endsWith("/auth/me/email") && init?.method === "PATCH") {
        return mockResponse({ message: "Current password is incorrect" }, 400);
      }

      if (url.endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(screen.getByLabelText(/new email/i), "updated@example.com");
    await user.type(
      screen.getByLabelText(/^current password$/i),
      "wrong-password"
    );
    await user.click(screen.getByRole("button", { name: /change email/i }));

    expect(
      await screen.findByText("Current password is incorrect")
    ).toBeInTheDocument();
  });

  it("changes password and clears all password fields", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();

        if (url.endsWith("/auth/me/password") && init?.method === "PATCH") {
          return mockResponse({ message: "Password updated" });
        }

        if (url.endsWith("/trips")) {
          return mockResponse([]);
        }

        return mockResponse({});
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    const currentPasswordInput = screen.getByLabelText(
      /current password for password change/i
    );
    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

    await user.type(currentPasswordInput, "password123");
    await user.type(newPasswordInput, "new-password-456");
    await user.type(confirmPasswordInput, "new-password-456");
    await user.click(screen.getByRole("button", { name: /^change password$/i }));

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(currentPasswordInput).toHaveValue("");
    expect(newPasswordInput).toHaveValue("");
    expect(confirmPasswordInput).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me/password"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "password123",
          newPassword: "new-password-456",
        }),
      })
    );
  });

  it("rejects mismatched new passwords before calling the API", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input.toString().endsWith("/trips")) {
        return mockResponse([]);
      }

      return mockResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /my profile/i }));
    await user.type(
      screen.getByLabelText(/current password for password change/i),
      "password123"
    );
    await user.type(screen.getByLabelText(/^new password$/i), "new-password-456");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "different-password"
    );
    await user.click(screen.getByRole("button", { name: /^change password$/i }));

    expect(await screen.findByText("New passwords do not match")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        url.toString().endsWith("/auth/me/password")
      )
    ).toBe(false);
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

    const metadataHeading = await screen.findByRole("heading", { name: "Trip metadata" });
    const metadataSection = metadataHeading.closest("section") as HTMLElement;
    const participantsHeading = await screen.findByRole("heading", { name: "Participants" });
    const participantsSection = participantsHeading.closest("section") as HTMLElement;
    const scheduledDateInput = screen.getByLabelText("Scheduled date");
    const currencySelect = screen.getByLabelText("Currency");

    expect(within(metadataSection).getByText("Ana Traveler")).toBeInTheDocument();
    expect(within(metadataSection).queryByText("User #7")).not.toBeInTheDocument();
    expect(scheduledDateInput).toHaveAttribute("min", "2026-06-01");
    expect(scheduledDateInput).toHaveAttribute("max", "2026-06-05");
    expect(currencySelect).toHaveValue("EUR");
    expect(
      within(currencySelect).getByRole("option", { name: "Serbian dinar (RSD)" })
    ).toBeInTheDocument();
    expect(participantsHeading).toBeInTheDocument();
    expect(within(participantsSection).getByText("Ana Traveler")).toBeInTheDocument();
    expect(within(participantsSection).getByText("owner")).toBeInTheDocument();
    expect(within(participantsSection).getByText("Milan Traveler")).toBeInTheDocument();
    expect(within(participantsSection).getByText("viewer")).toBeInTheDocument();
  });

  it("converts mixed expense currencies into a selected total", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips") && !init?.method) {
        return mockResponse([trip]);
      }
      if (url.endsWith("/trips/1/expenses")) {
        return mockResponse([
          {
            id: 1,
            tripId: 1,
            title: "Museum",
            amount: 10,
            currency: "EUR",
            category: "Activities",
            createdAt: "2026-07-28T10:00:00.000Z",
          },
          {
            id: 2,
            tripId: 1,
            title: "Lunch",
            amount: 20,
            currency: "USD",
            category: "Food",
            createdAt: "2026-07-28T11:00:00.000Z",
          },
        ]);
      }
      if (url.includes("/integrations/exchange-rate?")) {
        return mockResponse({
          from: "USD",
          to: "EUR",
          amount: 20,
          rate: 0.9,
          convertedAmount: 18,
          date: "2026-07-28",
          attribution: "Exchange rates by Frankfurter.dev",
        });
      }

      return mockTripDetailsRead(url) ?? mockResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /paris/i }));

    expect((await screen.findAllByText("€28.00")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Original totals:/)).toHaveTextContent("€10.00 · $20.00");
    expect(screen.getByText(/Approximate reference rates/)).toHaveTextContent(
      "2026-07-28"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/integrations/exchange-rate?from=USD&to=EUR&amount=20"
      ),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
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

  it("previews and accepts an invite for the signed-in account", async () => {
    const user = userEvent.setup();
    setAuthenticatedSession();
    window.history.pushState({}, "", "/invite/invite-token-123");
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips/invites/invite-token-123") && !init?.method) {
        return mockResponse({
          tripId: 1,
          tripName: "Lisbon Spring",
          email: "friend@example.com",
          role: "viewer",
          accountExists: true,
          expiresAt: "2030-01-01T00:00:00.000Z",
        });
      }
      if (url.endsWith("/trips/invites/invite-token-123/accept") && init?.method === "POST") {
        return mockResponse(acceptedInvite);
      }

      return mockResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Lisbon Spring")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(await screen.findByText("Invitation accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open accepted trip/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/trips/invites/invite-token-123/accept"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("creates an account with explicit details for a new invited email", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips/invites/public-token") && !init?.method) {
        return mockResponse({
          tripId: 1,
          tripName: "Lisbon Spring",
          email: "friend@example.com",
          role: "viewer",
          accountExists: false,
          expiresAt: "2030-01-01T00:00:00.000Z",
        });
      }
      if (url.endsWith("/trips/invites/public-token/accept") && init?.method === "POST") {
        return mockResponse({
          ...acceptedInvite,
          token: "public-token",
          accountCreated: true,
        });
      }

      return mockResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/invite/public-token");

    render(<App />);

    await user.type(await screen.findByLabelText(/^name$/i), "New Traveler");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account and join/i }));

    expect(
      await screen.findByText("Account created and invitation accepted")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/trips/invites/public-token/accept"),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Traveler",
          password: "password123",
        }),
      })
    );
  });

  it("opens a trip with read-only guest access", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/invite/guest-token");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/guest-token") && !init?.method) {
        return mockResponse({
          tripId: 1,
          tripName: "Lisbon Spring",
          email: "guest@example.com",
          role: "viewer",
          accountExists: false,
          expiresAt: "2030-01-01T00:00:00.000Z",
        });
      }
      if (url.endsWith("/trips/invites/guest-token/guest") && init?.method === "POST") {
        return mockResponse({
          tripId: 1,
          displayName: "Guest Traveler",
          guestToken: "guest-access-token",
          expiresInDays: 30,
        }, 201);
      }
      if (url.endsWith("/trips/guests/guest-access-token/trip")) {
        return mockResponse({
          guest: { displayName: "Guest Traveler", expiresAt: "2030-01-01" },
          trip: {
            name: "Lisbon Spring",
            description: "Shared plan",
            destination: "Lisbon",
            startDate: null,
            endDate: null,
          },
          itinerary: [],
          expenses: [],
          permissions: { readOnly: true },
        });
      }
      return mockResponse({});
    });

    render(<App />);
    await user.type(await screen.findByLabelText(/guest display name/i), "Guest Traveler");
    await user.click(screen.getByRole("button", { name: /continue as guest/i }));

    expect(await screen.findByText("Read-only guest access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lisbon Spring" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/guest/guest-access-token");
  });

  it("shows an error for an invalid invite", async () => {
    window.history.pushState({}, "", "/invite/bad-token");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/bad-token") && !init?.method) {
        return mockResponse({ error: "Invite not found" }, 404);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByText("Invitation not found")).toBeInTheDocument();
    expect(screen.getByText("The link is invalid or no longer available.")).toBeInTheDocument();
  });

  it("shows an expired invitation error", async () => {
    window.history.pushState({}, "", "/invites/expired-token/accept");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/expired-token") && !init?.method) {
        return mockResponse({ error: "Invite has expired" }, 410);
      }

      return mockResponse({});
    });

    render(<App />);

    expect(await screen.findByText("Invitation expired")).toBeInTheDocument();
    expect(screen.getByText(/ask the trip owner/i)).toBeInTheDocument();
  });

  it("does not call the API for a blank invite token", async () => {
    const fetchMock = vi.fn(() => mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/invite/%20");

    render(<App />);

    expect(await screen.findByText("Unable to accept invitation")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reruns invite acceptance after logging in with a preserved invite redirect", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/invite/existing-account-token");
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.endsWith("/trips/invites/existing-account-token") && !init?.method) {
        return mockResponse({
          tripId: 1,
          tripName: "Lisbon Spring",
          email: "test@example.com",
          role: "viewer",
          accountExists: true,
          expiresAt: "2030-01-01T00:00:00.000Z",
        });
      }
      if (url.endsWith("/trips/invites/existing-account-token/accept") && init?.method === "POST") {
        return mockResponse({ ...acceptedInvite, token: "existing-account-token" });
      }

      if (url.endsWith("/auth/login") && init?.method === "POST") {
        return mockResponse({ token: "test-token", user: authUser });
      }

      return mockResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.click(await screen.findByRole("button", { name: /log in to accept invitation/i }));
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await user.click(await screen.findByRole("button", { name: "Accept invitation" }));
    expect(await screen.findByText("Invitation accepted")).toBeInTheDocument();
    const acceptCalls = fetchMock.mock.calls.filter(([url]) =>
      url.toString().endsWith("/trips/invites/existing-account-token/accept")
    );
    expect(acceptCalls).toHaveLength(1);
  });

  it("preserves the accepted trip destination for newly created accounts", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/invite/new-account-token");
    mockFetch((url, init) => {
      if (url.endsWith("/trips/invites/new-account-token") && !init?.method) {
        return mockResponse({
          tripId: 1,
          tripName: "Lisbon Spring",
          email: "new@example.com",
          role: "viewer",
          accountExists: false,
          expiresAt: "2030-01-01T00:00:00.000Z",
        });
      }
      if (url.endsWith("/trips/invites/new-account-token/accept") && init?.method === "POST") {
        return mockResponse({
          ...acceptedInvite,
          token: "new-account-token",
          accountCreated: true,
        });
      }

      return mockResponse({});
    });

    render(<App />);
    await user.type(await screen.findByLabelText(/^name$/i), "New Traveler");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account and join/i }));
    await user.click(await screen.findByRole("button", { name: /log in and open trip/i }));

    expect(window.location.search).toBe("?redirect=%2F%3FopenTrip%3D1");
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("rejects unsafe login redirects and uses the default dashboard flow", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/?redirect=https%3A%2F%2Fevil.example");
    mockDefaultApi();

    render(<App />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("heading", { name: /your trips/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});
