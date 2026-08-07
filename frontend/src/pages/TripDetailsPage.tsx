import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  createTripInvite,
  fetchTripInvites,
  type TripInvite,
} from "../api/invites";
import LocationAutocomplete from "../components/LocationAutocomplete";
import { API_BASE_URL } from "../config/api";
import WeatherForecast from "../components/WeatherForecast";
import { useExpenseConversion } from "../hooks/useExpenseConversion";
import { getFormattingLocale } from "../i18n";
import type { LocationSearchResult } from "../types/location";
import {
  formatTripDate,
  type Trip,
  type TripParticipantSummary,
  type TripRole,
} from "../types/trip";

type TripDetailsPageProps = {
  token: string;
  trip: Trip;
  tripRole: TripRole;
  onBack: () => void;
  onTripUpdated: (trip: Trip) => void;
  onTripDeleted: () => void;
  onUnauthorized: () => void;
};

type ItineraryItem = {
  id: number;
  tripId: number;
  title: string;
  description: string | null;
  scheduledDate: string | null;
  createdAt: string;
};

type CreateItineraryItemResponse = ItineraryItem | { error?: string };

type Expense = {
  id: number;
  tripId: number;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  createdAt: string;
};

type CreateExpenseResponse = Expense | { error?: string };

type TripSummary = {
  itineraryCount: number;
  expenseCount: number;
  totalExpenses: number;
  tripDurationDays: number;
};

type TripParticipant = TripParticipantSummary & {
  id?: number;
  tripId?: number;
  createdAt?: string;
};

type TravelContact = {
  userId: number;
  name: string;
  email: string;
};

type CreateTripParticipantResponse = TripParticipant | { error?: string };

function getInviteAcceptedAt(invite: TripInvite) {
  return invite.acceptedAt ?? invite.accepted_at ?? null;
}

const formatExpenseAmount = (amount: number, currency: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const supportedCurrencies = ["EUR", "USD", "GBP", "CHF", "RSD", "CAD", "AUD", "JPY"] as const;

function locationFromTrip(trip: Trip): LocationSearchResult | null {
  if (
    !trip.destination ||
    typeof trip.destinationId !== "number" ||
    typeof trip.destinationLatitude !== "number" ||
    typeof trip.destinationLongitude !== "number" ||
    !trip.destinationTimezone ||
    !trip.destinationCountryCode
  ) {
    return null;
  }

  return {
    id: trip.destinationId,
    name: trip.destination.split(",")[0].trim(),
    displayName: trip.destination,
    latitude: trip.destinationLatitude,
    longitude: trip.destinationLongitude,
    timezone: trip.destinationTimezone,
    countryCode: trip.destinationCountryCode,
  };
}

function TripDetailsPage({
  token,
  trip,
  tripRole,
  onBack,
  onTripUpdated,
  onTripDeleted,
  onUnauthorized,
}: TripDetailsPageProps) {
  const { i18n, t } = useTranslation();
  const formattingLocale = getFormattingLocale(i18n.resolvedLanguage);
  const canManage = tripRole === "admin";
  const canContribute = canManage || tripRole === "user";
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [currentTrip, setCurrentTrip] = useState(trip);
  const [participants, setParticipants] = useState<TripParticipant[]>(trip.participants ?? []);
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [contacts, setContacts] = useState<TravelContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactUserId, setSelectedContactUserId] = useState<number | null>(null);
  const [participantRole, setParticipantRole] = useState<TripRole>("user");
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [editName, setEditName] = useState(trip.name);
  const [editDescription, setEditDescription] = useState(trip.description ?? "");
  const [editDestination, setEditDestination] = useState(trip.destination ?? "");
  const [selectedEditDestination, setSelectedEditDestination] =
    useState<LocationSearchResult | null>(() => locationFromTrip(trip));
  const [editStartDate, setEditStartDate] = useState(trip.startDate?.slice(0, 10) ?? "");
  const [editEndDate, setEditEndDate] = useState(trip.endDate?.slice(0, 10) ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TripRole>("user");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("EUR");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [conversionCurrency, setConversionCurrency] = useState("EUR");
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(true);
  const [isParticipantSubmitting, setIsParticipantSubmitting] = useState(false);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [deletingParticipantUserId, setDeletingParticipantUserId] = useState<number | null>(null);
  const [updatingParticipantUserId, setUpdatingParticipantUserId] = useState<number | null>(null);
  const [isTripSaving, setIsTripSaving] = useState(false);
  const [isTripDeleting, setIsTripDeleting] = useState(false);
  const [isInvitesLoading, setIsInvitesLoading] = useState(true);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingItineraryItemId, setDeletingItineraryItemId] = useState<number | null>(null);
  const [isExpensesLoading, setIsExpensesLoading] = useState(true);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [contactError, setContactError] = useState("");
  const [tripManagementError, setTripManagementError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [error, setError] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [participantSuccessMessage, setParticipantSuccessMessage] = useState("");
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [expenseSuccessMessage, setExpenseSuccessMessage] = useState("");
  const creatorName =
    participants.find((participant) => participant.userId === currentTrip.createdBy)?.name?.trim() ||
    t("details.tripOwner");

  const {
    convertedTotal: convertedExpenseTotal,
    rateDate: conversionRateDate,
    isLoading: isConversionLoading,
    error: conversionError,
    subtotals: expenseSubtotals,
    currencies: expenseCurrencies,
  } = useExpenseConversion(expenses, conversionCurrency);
  const singleExpenseCurrency =
    expenseCurrencies.length === 1 ? expenseCurrencies[0] : null;
  const inviteBaseUrl = `${window.location.origin}/invites`;

  const loadTripDetails = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as Trip;
      if (!("id" in data)) {
        return;
      }

      setCurrentTrip(data);

      if (data.participants) {
        setParticipants(data.participants);
      }
    } catch {
      // The dedicated participants endpoint below still keeps this page useful.
    }
  }, [onUnauthorized, token, trip.id]);

  const loadSummary = useCallback(async () => {
    setSummaryError("");
    setIsSummaryLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as TripSummary | { error?: string };

      if (!response.ok || !("itineraryCount" in data)) {
        setSummaryError(("error" in data && data.error) || t("details.messages.summaryLoadFailed"));
        return;
      }

      setSummary(data);
    } catch {
      setSummaryError(t("details.messages.summaryLoadFailed"));
    } finally {
      setIsSummaryLoading(false);
    }
  }, [onUnauthorized, t, token, trip.id]);

  const loadParticipants = useCallback(async () => {
    setParticipantError("");
    setIsParticipantsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/participants`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setParticipantError(t("details.messages.unauthorized"));
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as TripParticipant[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setParticipantError(("error" in data && data.error) || t("details.messages.participantsLoadFailed"));
        return;
      }

      setParticipants(data);
      setCurrentTrip((activeTrip) => {
        const updatedTrip = { ...activeTrip, participants: data };
        return updatedTrip;
      });
    } catch {
      setParticipantError(t("details.messages.participantsLoadFailed"));
    } finally {
      setIsParticipantsLoading(false);
    }
  }, [onUnauthorized, t, token, trip.id]);

  const loadContacts = useCallback(async () => {
    if (!canManage) {
      setContacts([]);
      return;
    }

    setContactError("");
    setIsContactsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/contacts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setContactError(t("details.messages.unauthorized"));
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as TravelContact[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setContactError(
          ("error" in data && data.error) || t("details.messages.contactsLoadFailed")
        );
        return;
      }

      setContacts(data);
    } catch {
      setContactError(t("details.messages.contactsLoadFailed"));
    } finally {
      setIsContactsLoading(false);
    }
  }, [canManage, onUnauthorized, t, token, trip.id]);

  const loadInvites = useCallback(async () => {
    setInviteError("");
    setIsInvitesLoading(true);

    try {
      const { response, data } = await fetchTripInvites(trip.id, token);

      if (response.status === 401) {
        setInviteError(t("details.messages.unauthorized"));
        onUnauthorized();
        return;
      }

      if (!response.ok || !Array.isArray(data)) {
        setInviteError(
          response.status === 403
            ? t("details.messages.adminsManageInvites")
            : ("error" in data && data.error) || t("details.messages.invitesLoadFailed")
        );
        return;
      }

      setInvites(data);
    } catch {
      setInviteError(t("details.messages.invitesLoadFailed"));
    } finally {
      setIsInvitesLoading(false);
    }
  }, [onUnauthorized, t, token, trip.id]);

  const loadItineraryItems = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/itinerary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as ItineraryItem[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setError(("error" in data && data.error) || t("details.messages.itineraryLoadFailed"));
        return;
      }

      setItineraryItems(data);
    } catch {
      setError(t("details.messages.itineraryLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized, t, token, trip.id]);

  const loadExpenses = useCallback(async () => {
    setExpenseError("");
    setIsExpensesLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/expenses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as Expense[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setExpenseError(("error" in data && data.error) || t("details.messages.expensesLoadFailed"));
        return;
      }

      setExpenses(data);
    } catch {
      setExpenseError(t("details.messages.expensesLoadFailed"));
    } finally {
      setIsExpensesLoading(false);
    }
  }, [onUnauthorized, t, token, trip.id]);

  useEffect(() => {
    setCurrentTrip(trip);
    setEditName(trip.name);
    setEditDescription(trip.description ?? "");
    setEditDestination(trip.destination ?? "");
    setSelectedEditDestination(locationFromTrip(trip));
    setEditStartDate(trip.startDate?.slice(0, 10) ?? "");
    setEditEndDate(trip.endDate?.slice(0, 10) ?? "");
    setParticipants(trip.participants ?? []);
    void loadTripDetails();
    void loadSummary();
    void loadParticipants();
    if (canManage) {
      void loadInvites();
      void loadContacts();
    } else {
      setInvites([]);
      setContacts([]);
      setIsInvitesLoading(false);
    }
    void loadItineraryItems();
    void loadExpenses();
  }, [
    canManage,
    loadExpenses,
    loadContacts,
    loadInvites,
    loadItineraryItems,
    loadParticipants,
    loadSummary,
    loadTripDetails,
    trip,
  ]);

  const handleTripUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTripManagementError("");

    if (!selectedEditDestination) {
      setTripManagementError(t("trips.chooseDestination"));
      return;
    }
    if (!editStartDate || !editEndDate) {
      setTripManagementError(t("trips.dateRangeRequired"));
      return;
    }
    if (editStartDate > editEndDate) {
      setTripManagementError(t("trips.startAfterEnd"));
      return;
    }

    setIsTripSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription || undefined,
          destination: selectedEditDestination.displayName,
          destinationId: selectedEditDestination.id,
          destinationLatitude: selectedEditDestination.latitude,
          destinationLongitude: selectedEditDestination.longitude,
          destinationTimezone: selectedEditDestination.timezone,
          destinationCountryCode: selectedEditDestination.countryCode,
          startDate: editStartDate,
          endDate: editEndDate,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as Trip | { error?: string };

      if (!response.ok || !("id" in data)) {
        setTripManagementError(("error" in data && data.error) || t("details.messages.updateFailed"));
        return;
      }

      const updatedTrip = {
        ...data,
        participants: currentTrip.participants,
      };
      setCurrentTrip(updatedTrip);
      setEditDestination(data.destination ?? "");
      setSelectedEditDestination(locationFromTrip(data));
      onTripUpdated(updatedTrip);
      setIsEditingTrip(false);
    } catch {
      setTripManagementError(t("details.messages.updateFailed"));
    } finally {
      setIsTripSaving(false);
    }
  };

  const handleTripDelete = async () => {
    if (!window.confirm(t("details.deleteConfirmation"))) {
      return;
    }

    setTripManagementError("");
    setIsTripDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setTripManagementError(data.error || t("details.messages.deleteFailed"));
        return;
      }

      onTripDeleted();
    } catch {
      setTripManagementError(t("details.messages.deleteFailed"));
    } finally {
      setIsTripDeleting(false);
    }
  };

  const handleParticipantSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParticipantError("");
    setContactError("");
    setParticipantSuccessMessage("");

    if (!selectedContactUserId) {
      setContactError(t("details.messages.chooseContact"));
      return;
    }

    setIsParticipantSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/participants`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedContactUserId,
          role: participantRole,
        }),
      });

      if (response.status === 401) {
        setParticipantError(t("details.messages.unauthorized"));
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateTripParticipantResponse;

      if (!response.ok || !("id" in data)) {
        if (response.status === 409) {
          setContactError(t("details.messages.participantExists"));
        } else if (response.status === 403) {
          setContactError(
            ("error" in data && data.error) || t("details.messages.adminsAddParticipants")
          );
        } else {
          setContactError(("error" in data && data.error) || t("details.messages.participantAddFailed"));
        }
        return;
      }

      setContactSearch("");
      setSelectedContactUserId(null);
      setParticipantRole("user");
      setParticipantSuccessMessage(t("details.messages.participantAdded"));
      await Promise.all([loadParticipants(), loadContacts()]);
    } catch {
      setContactError(t("details.messages.participantAddFailed"));
    } finally {
      setIsParticipantSubmitting(false);
    }
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError("");
    setInviteSuccessMessage("");
    setIsInviteSubmitting(true);

    try {
      const { response, data } = await createTripInvite(trip.id, token, {
        email: inviteEmail,
        role: inviteRole,
      });

      if (response.status === 401) {
        setInviteError(t("details.messages.unauthorized"));
        onUnauthorized();
        return;
      }

      if (!response.ok || !("id" in data)) {
        setInviteError(
          response.status === 403
            ? t("details.messages.adminsCreateInvites")
            : ("error" in data && data.error) || t("details.messages.inviteCreateFailed")
        );
        return;
      }

      setInviteEmail("");
      setInviteRole("user");
      setInviteSuccessMessage(t("details.messages.inviteCreated"));
      await loadInvites();
    } catch {
      setInviteError(t("details.messages.inviteCreateFailed"));
    } finally {
      setIsInviteSubmitting(false);
    }
  };

  const handleItinerarySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/itinerary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          scheduledDate: scheduledDate || undefined,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateItineraryItemResponse;

      if (!response.ok || !("id" in data)) {
        setError(("error" in data && data.error) || t("details.messages.itineraryCreateFailed"));
        return;
      }

      setItineraryItems((currentItems) => [...currentItems, data]);
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              itineraryCount: currentSummary.itineraryCount + 1,
            }
          : currentSummary
      );
      setTitle("");
      setDescription("");
      setScheduledDate("");
      setSuccessMessage(t("details.messages.itineraryAdded"));
    } catch {
      setError(t("details.messages.itineraryCreateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpenseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExpenseError("");
    setExpenseSuccessMessage("");
    setIsExpenseSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          currency: expenseCurrency,
          category: expenseCategory || undefined,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateExpenseResponse;

      if (!response.ok || !("id" in data)) {
        setExpenseError(("error" in data && data.error) || t("details.messages.expenseCreateFailed"));
        return;
      }

      setExpenses((currentExpenses) => [data, ...currentExpenses]);
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              expenseCount: currentSummary.expenseCount + 1,
              totalExpenses: currentSummary.totalExpenses + data.amount,
            }
          : currentSummary
      );
      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseCurrency(data.currency);
      setExpenseCategory("");
      setExpenseSuccessMessage(t("details.messages.expenseAdded"));
    } catch {
      setExpenseError(t("details.messages.expenseCreateFailed"));
    } finally {
      setIsExpenseSubmitting(false);
    }
  };

  const deleteTripResource = async (
    resourcePath: string,
    fallbackError: string,
    setResourceError: (message: string) => void
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/${resourcePath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        onUnauthorized();
        return false;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setResourceError(data?.error || fallbackError);
        return false;
      }

      return true;
    } catch {
      setResourceError(fallbackError);
      return false;
    }
  };

  const handleParticipantDelete = async (participant: TripParticipant) => {
    const participantName = participant.name || `User #${participant.userId}`;
    if (!window.confirm(`Remove ${participantName} from this trip?`)) {
      return;
    }

    setParticipantError("");
    setParticipantSuccessMessage("");
    setDeletingParticipantUserId(participant.userId);

    const deleted = await deleteTripResource(
      `participants/${participant.userId}`,
      t("details.messages.participantRemoveFailed"),
      setParticipantError
    );

    if (deleted) {
      const updatedParticipants = participants.filter(
        (currentParticipant) => currentParticipant.userId !== participant.userId
      );
      const updatedTrip = { ...currentTrip, participants: updatedParticipants };
      setParticipants(updatedParticipants);
      setCurrentTrip(updatedTrip);
      onTripUpdated(updatedTrip);
      setParticipantSuccessMessage(t("details.messages.participantRemoved"));
    }

    setDeletingParticipantUserId(null);
  };

  const handleParticipantRoleChange = async (
    participant: TripParticipant,
    role: TripRole
  ) => {
    setParticipantError("");
    setParticipantSuccessMessage("");
    setUpdatingParticipantUserId(participant.userId);

    try {
      const response = await fetch(
        `${API_BASE_URL}/trips/${trip.id}/participants/${participant.userId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role }),
        }
      );

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | TripParticipant
        | { error?: string }
        | null;

      if (!response.ok || !data || !("userId" in data)) {
        setParticipantError(
          (data && "error" in data && data.error) || t("details.messages.roleUpdateFailed")
        );
        return;
      }

      const updatedParticipants = participants.map((currentParticipant) =>
        currentParticipant.userId === participant.userId
          ? { ...currentParticipant, ...data }
          : currentParticipant
      );
      const updatedTrip = { ...currentTrip, participants: updatedParticipants };
      setParticipants(updatedParticipants);
      setCurrentTrip(updatedTrip);
      onTripUpdated(updatedTrip);
      setParticipantSuccessMessage(t("details.messages.roleUpdated"));
    } catch {
      setParticipantError(t("details.messages.roleUpdateFailed"));
    } finally {
      setUpdatingParticipantUserId(null);
    }
  };

  const handleItineraryDelete = async (item: ItineraryItem) => {
    if (!window.confirm(`Delete itinerary item “${item.title}”?`)) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setDeletingItineraryItemId(item.id);

    const deleted = await deleteTripResource(
      `itinerary/${item.id}`,
      t("details.messages.itineraryDeleteFailed"),
      setError
    );

    if (deleted) {
      setItineraryItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id)
      );
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              itineraryCount: Math.max(0, currentSummary.itineraryCount - 1),
            }
          : currentSummary
      );
      setSuccessMessage(t("details.messages.itineraryDeleted"));
    }

    setDeletingItineraryItemId(null);
  };

  const handleExpenseDelete = async (expense: Expense) => {
    if (!window.confirm(`Delete expense “${expense.title}”?`)) {
      return;
    }

    setExpenseError("");
    setExpenseSuccessMessage("");
    setDeletingExpenseId(expense.id);

    const deleted = await deleteTripResource(
      `expenses/${expense.id}`,
      t("details.messages.expenseDeleteFailed"),
      setExpenseError
    );

    if (deleted) {
      setExpenses((currentExpenses) =>
        currentExpenses.filter((currentExpense) => currentExpense.id !== expense.id)
      );
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              expenseCount: Math.max(0, currentSummary.expenseCount - 1),
              totalExpenses: Math.max(0, currentSummary.totalExpenses - expense.amount),
            }
          : currentSummary
      );
      setExpenseSuccessMessage(t("details.messages.expenseDeleted"));
    }

    setDeletingExpenseId(null);
  };

  const normalizedContactSearch = contactSearch.trim().toLowerCase();
  const matchingContacts = contacts.filter(
    (contact) =>
      selectedContactUserId === contact.userId ||
      !normalizedContactSearch ||
      contact.name.toLowerCase().includes(normalizedContactSearch) ||
      contact.email.toLowerCase().includes(normalizedContactSearch)
  );

  return (
    <section className="page trip-details-page">
      <div className="details-hero">
        <div>
          <p className="eyebrow">{t("details.eyebrow")}</p>
          <h1>{currentTrip.name}</h1>
          <p className="trip-description">
            {currentTrip.description || t("details.noDescription")}
          </p>
          <span className={`trip-role-badge trip-role-${tripRole}`}>
            {t("details.roleAccess", { role: t(`roles.${tripRole}`) })}
          </span>
        </div>
        <div className="details-actions">
          {canManage ? (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setTripManagementError("");
                  setIsEditingTrip((current) => !current);
                }}
              >
                {isEditingTrip ? t("details.cancelEdit") : t("details.editTrip")}
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={handleTripDelete}
                disabled={isTripDeleting}
              >
                {isTripDeleting ? t("details.deleting") : t("details.deleteTrip")}
              </button>
            </>
          ) : null}
          <button className="secondary-button" type="button" onClick={onBack}>
            {t("common.backToTrips")}
          </button>
        </div>
      </div>

      <nav className="trip-section-nav" aria-label={t("details.sections")}>
        <a href="#trip-overview">{t("details.overview")}</a>
        <a href="#trip-people">{t("details.people")}</a>
        <a href="#trip-itinerary">{t("details.itinerary")}</a>
        <a href="#trip-budget">{t("details.budget")}</a>
      </nav>

      <section
        className="trip-content-section trip-content-section--overview"
        id="trip-overview"
        aria-labelledby="trip-overview-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">01</span>
          <div>
            <h2 id="trip-overview-heading">{t("details.overview")}</h2>
            <p>{t("details.overviewDescription")}</p>
          </div>
        </header>

        <WeatherForecast
          destination={currentTrip.destination}
          startDate={currentTrip.startDate}
          endDate={currentTrip.endDate}
        />

        {tripManagementError ? <p className="error">{tripManagementError}</p> : null}

        {canManage && isEditingTrip ? (
          <section className="panel trip-edit-card">
          <h2>{t("details.editTrip")}</h2>
          <form className="form-stack" onSubmit={handleTripUpdate}>
            <label>
              {t("details.edit.tripName")}
              <input
                value={editName}
                maxLength={255}
                onChange={(event) => setEditName(event.target.value)}
                required
              />
            </label>
            <label>
              {t("details.description")}
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
              />
            </label>
            <LocationAutocomplete
              query={editDestination}
              selectedLocation={selectedEditDestination}
              onQueryChange={setEditDestination}
              onSelectionChange={setSelectedEditDestination}
              required
            />
            <div className="date-inputs">
              <label>
                {t("details.startDate")}
                <input
                  type="date"
                  value={editStartDate}
                  max={editEndDate || undefined}
                  onChange={(event) => setEditStartDate(event.target.value)}
                  required
                />
              </label>
              <label>
                {t("details.endDate")}
                <input
                  type="date"
                  value={editEndDate}
                  min={editStartDate || undefined}
                  onChange={(event) => setEditEndDate(event.target.value)}
                  required
                />
              </label>
            </div>
            <button className="primary-button" type="submit" disabled={isTripSaving}>
              {isTripSaving ? t("common.saving") : t("details.edit.saveChanges")}
            </button>
          </form>
          </section>
        ) : null}

        <div className="details-layout">
        <section className="panel trip-info-card">
          <p className="eyebrow">{t("details.overview")}</p>
          <h2>{currentTrip.name}</h2>
          <p>{currentTrip.description || t("details.noDescription")}</p>
        </section>

        <section className="panel metadata-card">
          <h2>{t("details.metadata")}</h2>
          <dl className="metadata-list">
            <div>
              <dt>{t("details.destination")}</dt>
              <dd>{currentTrip.destination || "-"}</dd>
            </div>
            <div>
              <dt>{t("details.startDate")}</dt>
              <dd>{formatTripDate(currentTrip.startDate, formattingLocale)}</dd>
            </div>
            <div>
              <dt>{t("details.endDate")}</dt>
              <dd>{formatTripDate(currentTrip.endDate, formattingLocale)}</dd>
            </div>
            <div>
              <dt>{t("details.createdBy")}</dt>
              <dd>{creatorName}</dd>
            </div>
          </dl>
        </section>
        </div>

        <section className="summary-section">
        <div className="section-heading">
          <h2>{t("details.summary")}</h2>
        </div>

        {summaryError ? <p className="error">{summaryError}</p> : null}
        {isSummaryLoading ? <p className="loading-state">{t("details.gatheringSummary")}</p> : null}

        {!isSummaryLoading && summary ? (
          <div className="summary-grid">
            <article className="summary-card">
              <p>{t("details.duration")}</p>
              <strong>{t("details.days", { count: summary.tripDurationDays })}</strong>
            </article>
            <article className="summary-card">
              <p>{t("details.itineraryItems")}</p>
              <strong>{summary.itineraryCount}</strong>
            </article>
            <article className="summary-card">
              <p>{t("details.totalExpenses")}</p>
              <strong>
                {convertedExpenseTotal !== null
                  ? formatExpenseAmount(convertedExpenseTotal, conversionCurrency, formattingLocale)
                  : singleExpenseCurrency
                    ? formatExpenseAmount(
                        expenseSubtotals[singleExpenseCurrency],
                        singleExpenseCurrency,
                        formattingLocale
                      )
                    : t("details.mixedCurrencies")}
              </strong>
            </article>
            <article className="summary-card">
              <p>{t("details.expenseCount")}</p>
              <strong>{summary.expenseCount}</strong>
            </article>
          </div>
        ) : null}
        </section>
      </section>

      <section
        className="trip-content-section trip-content-section--people"
        id="trip-people"
        aria-labelledby="trip-people-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">02</span>
          <div>
            <h2 id="trip-people-heading">{t("details.people")}</h2>
            <p>{t("details.peopleDescription")}</p>
          </div>
        </header>

        <div className={`participants-layout${canManage ? "" : " read-only-content-layout"}`}>
        {canManage ? (
          <section className="panel participant-form-card">
          <h2>{t("details.addParticipant")}</h2>
          <p className="page-subtitle">
            {t("details.addParticipantDescription")}
          </p>

          <form className="form-stack" onSubmit={handleParticipantSubmit}>
            <label>
              {t("details.searchContacts")}
              <input
                type="search"
                value={contactSearch}
                onChange={(event) => {
                  setContactSearch(event.target.value);
                  setSelectedContactUserId(null);
                }}
                placeholder={t("details.nameOrEmail")}
              />
            </label>

            {isContactsLoading ? (
              <p className="loading-state">{t("details.loadingContacts")}</p>
            ) : null}

            {!isContactsLoading && contacts.length === 0 ? (
              <p className="empty-state">
                {t("details.noContacts")}
              </p>
            ) : null}

            {!isContactsLoading && contacts.length > 0 ? (
              <div className="contact-search-results" aria-label={t("details.previousContacts")}>
                {matchingContacts.length === 0 ? (
                  <p className="empty-state">{t("details.noMatchingContacts")}</p>
                ) : null}
                {matchingContacts.map((contact) => (
                    <button
                      className="contact-search-option"
                      type="button"
                      key={contact.userId}
                      aria-pressed={selectedContactUserId === contact.userId}
                      onClick={() => {
                        setSelectedContactUserId(contact.userId);
                        setContactSearch(`${contact.name} (${contact.email})`);
                        setContactError("");
                      }}
                    >
                      <strong>{contact.name}</strong>
                      <span>{contact.email}</span>
                    </button>
                  ))}
              </div>
            ) : null}

            <label>
              {t("details.participantRole")}
              <select
                value={participantRole}
                onChange={(event) => setParticipantRole(event.target.value as TripRole)}
              >
                <option value="admin">{t("details.roleAdminDescription")}</option>
                <option value="user">{t("details.roleUserDescription")}</option>
                <option value="guest">{t("details.roleGuestDescription")}</option>
              </select>
            </label>

            <button
              className="primary-button"
              type="submit"
              disabled={isParticipantSubmitting || selectedContactUserId === null}
            >
              {isParticipantSubmitting ? t("details.adding") : t("details.addParticipant")}
            </button>
          </form>

          {contactError ? <p className="error">{contactError}</p> : null}
          {participantSuccessMessage ? <p className="success">{participantSuccessMessage}</p> : null}
          </section>
        ) : null}

        <section className="participants-section">
          <div className="section-heading">
            <h2>{t("details.participants")}</h2>
            <span>{t("common.total", { count: participants.length })}</span>
          </div>

          {participantError ? <p className="error">{participantError}</p> : null}
          {isParticipantsLoading ? <p className="loading-state">{t("details.gatheringParticipants")}</p> : null}

          {!isParticipantsLoading && participants.length === 0 ? (
            <p className="empty-state">{t("details.noParticipants")}</p>
          ) : null}

          {!isParticipantsLoading && participants.length > 0 ? (
            <ul className="participant-list">
              {participants.map((participant) => (
                <li
                  className="participant-card"
                  key={participant.id ?? `${currentTrip.id}-${participant.userId}`}
                >
                  <div>
                    <strong>{participant.name || t("common.userFallback", { id: participant.userId })}</strong>
                    <p>{t("details.participant")}</p>
                  </div>
                  <div className="item-card-actions">
                    {canManage && participant.userId !== currentTrip.createdBy ? (
                      <select
                        className="participant-role-select"
                        aria-label={t("details.roleFor", { name: participant.name || t("common.userFallback", { id: participant.userId }) })}
                        value={participant.role}
                        onChange={(event) =>
                          void handleParticipantRoleChange(
                            participant,
                            event.target.value as TripRole
                          )
                        }
                        disabled={updatingParticipantUserId === participant.userId}
                      >
                        <option value="admin">{t("details.roleAdminOption")}</option>
                        <option value="user">{t("details.roleUserOption")}</option>
                        <option value="guest">{t("details.roleGuestOption")}</option>
                      </select>
                    ) : (
                      <span>{i18n.resolvedLanguage === "sr" ? t(`roles.${participant.role}`) : participant.role}</span>
                    )}
                    {canManage && participant.userId !== currentTrip.createdBy ? (
                      <button
                        className="compact-danger-button"
                        type="button"
                        onClick={() => void handleParticipantDelete(participant)}
                        disabled={deletingParticipantUserId === participant.userId}
                      >
                        {deletingParticipantUserId === participant.userId ? t("details.removing") : t("details.remove")}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        </div>

        {canManage ? (
          <div className="invites-layout">
        <section className="panel invite-form-card">
          <h2>{t("details.createInvite")}</h2>

          <form className="form-stack" onSubmit={handleInviteSubmit}>
            <label>
              {t("details.inviteEmail")}
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
            </label>

            <label>
              {t("details.inviteRole")}
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as TripRole)}
              >
                <option value="admin">{t("details.roleAdminDescription")}</option>
                <option value="user">{t("details.roleUserDescription")}</option>
                <option value="guest">{t("details.roleGuestDescription")}</option>
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={isInviteSubmitting}>
              {isInviteSubmitting ? t("details.creating") : t("details.createInvite")}
            </button>
          </form>

          {inviteSuccessMessage ? <p className="success">{inviteSuccessMessage}</p> : null}
        </section>

        <section className="invites-section">
          <div className="section-heading">
            <h2>{t("details.invites")}</h2>
            <span>{t("common.total", { count: invites.length })}</span>
          </div>

          {inviteError ? <p className="error">{inviteError}</p> : null}
          {isInvitesLoading ? <p className="loading-state">{t("details.gatheringInvites")}</p> : null}

          {!isInvitesLoading && invites.length === 0 ? (
            <p className="empty-state">{t("details.noInvites")}</p>
          ) : null}

          {!isInvitesLoading && invites.length > 0 ? (
            <ul className="invite-list">
              {invites.map((invite) => {
                const inviteLink = `${inviteBaseUrl}/${invite.token}/accept`;

                return (
                  <li className="invite-card" key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <p>{inviteLink}</p>
                    </div>
                    <div className="invite-card-meta">
                      <span>{t(`roles.${invite.role}`)}</span>
                      <span>{getInviteAcceptedAt(invite) ? t("details.accepted") : t("details.notAccepted")}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
          </div>
        ) : null}
      </section>

      <section
        className="trip-content-section trip-content-section--itinerary"
        id="trip-itinerary"
        aria-labelledby="trip-itinerary-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">03</span>
          <div>
            <h2 id="trip-itinerary-heading">{t("details.itinerary")}</h2>
            <p>{t("details.itineraryDescription")}</p>
          </div>
        </header>

        <div className={`itinerary-layout${canContribute ? "" : " read-only-content-layout"}`}>
        {canContribute ? (
          <section className="panel itinerary-form-card">
          <h2>{t("details.addItinerary")}</h2>

          <form className="form-stack" onSubmit={handleItinerarySubmit}>
            <label>
              {t("details.title")}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>

            <label>
              {t("details.description")}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>

            <label>
              {t("details.scheduledDate")}
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                min={currentTrip.startDate?.slice(0, 10)}
                max={currentTrip.endDate?.slice(0, 10)}
              />
            </label>

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("details.adding") : t("details.addItem")}
            </button>
          </form>

          {successMessage ? <p className="success">{successMessage}</p> : null}
          </section>
        ) : null}

        <section className="itinerary-section">
          <div className="section-heading">
            <h3>{t("details.scheduledItems")}</h3>
            <span>{t("common.total", { count: itineraryItems.length })}</span>
          </div>

          {error ? <p className="error">{error}</p> : null}
          {isLoading ? <p className="loading-state">{t("details.gatheringItinerary")}</p> : null}

          {!isLoading && itineraryItems.length === 0 ? (
            <p className="empty-state">
              {t("details.noItineraryLong")}
            </p>
          ) : null}

          {!isLoading && itineraryItems.length > 0 ? (
            <ul className="itinerary-list">
              {itineraryItems.map((item) => (
                <li className="itinerary-item" key={item.id}>
                  <div className="itinerary-date">
                    {formatTripDate(item.scheduledDate, formattingLocale)}
                  </div>
                  <div className="itinerary-card">
                    <div className="itinerary-card-header">
                      <strong>{item.title}</strong>
                      {canManage ? (
                        <button
                          className="compact-danger-button"
                          type="button"
                          onClick={() => void handleItineraryDelete(item)}
                          disabled={deletingItineraryItemId === item.id}
                        >
                          {deletingItineraryItemId === item.id ? t("details.deleting") : t("common.delete")}
                        </button>
                      ) : null}
                    </div>
                    <p>{item.description || t("trips.noDescriptionShort")}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        </div>
      </section>

      <section
        className="trip-content-section trip-content-section--budget"
        id="trip-budget"
        aria-labelledby="trip-budget-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">04</span>
          <div>
            <h2 id="trip-budget-heading">{t("details.budget")}</h2>
            <p>{t("details.budgetDescription")}</p>
          </div>
        </header>

        <div className={`expenses-layout${canContribute ? "" : " read-only-content-layout"}`}>
        {canContribute ? (
          <section className="panel expense-form-card">
          <h2>{t("details.addExpense")}</h2>

          <form className="form-stack" onSubmit={handleExpenseSubmit}>
            <label>
              {t("details.title")}
              <input
                value={expenseTitle}
                onChange={(event) => setExpenseTitle(event.target.value)}
                required
              />
            </label>

            <div className="expense-inputs">
              <label>
                {t("details.amount")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  required
                />
              </label>

              <label>
                {t("details.currency")}
                <select
                  value={expenseCurrency}
                  onChange={(event) => setExpenseCurrency(event.target.value)}
                >
                  {supportedCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {t(`details.currencies.${code}`)} ({code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              {t("details.category")}
              <input
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value)}
              />
            </label>

            <button className="primary-button" type="submit" disabled={isExpenseSubmitting}>
              {isExpenseSubmitting ? t("details.adding") : t("details.addExpense")}
            </button>
          </form>

          {expenseSuccessMessage ? <p className="success">{expenseSuccessMessage}</p> : null}
          </section>
        ) : null}

        <section className="expenses-section">
          <div className="expense-total-card">
            <div className="expense-total-heading">
              <div>
                <p className="eyebrow">{t("details.estimatedTotal")}</p>
                <strong>
                  {isConversionLoading
                    ? t("details.converting")
                    : convertedExpenseTotal !== null
                      ? formatExpenseAmount(
                          convertedExpenseTotal,
                          conversionCurrency,
                          formattingLocale
                        )
                      : t("details.unavailable")}
                </strong>
              </div>

              <label className="conversion-currency">
                {t("details.displayCurrency")}
                <select
                  value={conversionCurrency}
                  onChange={(event) => setConversionCurrency(event.target.value)}
                >
                  {supportedCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {t(`details.currencies.${code}`)} ({code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {expenseCurrencies.length > 0 ? (
              <p className="expense-subtotals">
                {t("details.originalTotals", { totals: expenseCurrencies
                  .map((currency) =>
                    formatExpenseAmount(expenseSubtotals[currency], currency, formattingLocale)
                  )
                  .join(" · ") })}
              </p>
            ) : null}
            {conversionRateDate ? (
              <p className="conversion-note">
                {t("details.ratesNote", { date: conversionRateDate })}
              </p>
            ) : null}
            {conversionError ? (
              <p className="error conversion-error">{conversionError}</p>
            ) : null}
          </div>

          <div className="section-heading">
            <h2>{t("details.expenses")}</h2>
            <span>{t("common.total", { count: expenses.length })}</span>
          </div>

          {expenseError ? <p className="error">{expenseError}</p> : null}
          {isExpensesLoading ? <p className="loading-state">{t("details.gatheringExpenses")}</p> : null}

          {!isExpensesLoading && expenses.length === 0 ? (
            <p className="empty-state">
              {t("details.noExpensesLong")}
            </p>
          ) : null}

          {!isExpensesLoading && expenses.length > 0 ? (
            <ul className="expense-list">
              {expenses.map((expense) => (
                <li className="expense-card" key={expense.id}>
                  <div>
                    <strong>{expense.title}</strong>
                    <p>{expense.category || t("details.uncategorized")}</p>
                  </div>
                  <div className="item-card-actions">
                    <span>{formatExpenseAmount(expense.amount, expense.currency, formattingLocale)}</span>
                    {canManage ? (
                      <button
                        className="compact-danger-button"
                        type="button"
                        onClick={() => void handleExpenseDelete(expense)}
                        disabled={deletingExpenseId === expense.id}
                      >
                        {deletingExpenseId === expense.id ? t("details.deleting") : t("common.delete")}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        </div>
      </section>
    </section>
  );
}

export default TripDetailsPage;
