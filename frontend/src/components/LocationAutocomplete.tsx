import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { searchLocations } from "../api/locations";
import type { LocationSearchResult } from "../types/location";

type LocationAutocompleteProps = {
  label?: string;
  query: string;
  selectedLocation: LocationSearchResult | null;
  onQueryChange: (query: string) => void;
  onSelectionChange: (location: LocationSearchResult | null) => void;
  required?: boolean;
};

function LocationAutocomplete({
  label,
  query,
  selectedLocation,
  onQueryChange,
  onSelectionChange,
  required = false,
}: LocationAutocompleteProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const listId = `${inputId}-locations`;
  const [locations, setLocations] = useState<LocationSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (
      trimmedQuery.length < 2 ||
      selectedLocation?.displayName === query
    ) {
      setLocations([]);
      setIsLoading(false);
      setIsOpen(false);
      setError("");
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const results = await searchLocations(trimmedQuery, controller.signal);
        setLocations(results);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name === "AbortError") return;
        setLocations([]);
        setIsOpen(false);
        setError(
          searchError instanceof Error
            ? searchError.message
            : t("location.searchFailed")
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, selectedLocation, t]);

  const selectLocation = (location: LocationSearchResult) => {
    onQueryChange(location.displayName);
    onSelectionChange(location);
    setLocations([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setError("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || locations.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % locations.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? locations.length - 1 : current - 1
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectLocation(locations[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="location-autocomplete">
      <label htmlFor={inputId}>{label ?? t("location.destination")}</label>
      <div className="location-input-wrapper">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          placeholder={t("location.placeholder")}
          value={query}
          required={required}
          onChange={(event) => {
            onQueryChange(event.target.value);
            onSelectionChange(null);
          }}
          onFocus={() => {
            if (locations.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 100);
          }}
          onKeyDown={handleKeyDown}
        />

        {isLoading ? <span className="location-search-spinner">{t("location.searching")}</span> : null}

        {isOpen ? (
          <ul className="location-results" id={listId} role="listbox">
            {locations.length > 0 ? (
              locations.map((location, index) => (
                <li
                  key={location.id}
                  role="none"
                >
                  <button
                    id={`${listId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "active" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectLocation(location)}
                  >
                    <strong>{location.name}</strong>
                    <span>{location.displayName}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="location-search-empty">{t("location.noMatches")}</li>
            )}
          </ul>
        ) : null}
      </div>
      {error ? <p className="location-search-error">{error}</p> : null}
      <p className="location-attribution">{t("location.attribution")}</p>
    </div>
  );
}

export default LocationAutocomplete;
