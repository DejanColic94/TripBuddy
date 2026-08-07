# User Guide

## 1. Overview

TripBuddy brings trip details, collaborators, itinerary, weather, and expenses into one application. The interface is responsive and supports English/Serbian plus light/dark themes.

The language and theme controls are available in the application toolbar. Both choices remain saved in the browser.

## 2. Create and verify an account

1. Open TripBuddy.
2. Select **Create account**.
3. Enter your name, email, password, and password confirmation.
4. Submit the form.
5. Open the verification email and follow its link.
6. Return to TripBuddy and log in.

Passwords must contain at least eight characters. An email address identifies one permanent TripBuddy account and cannot be changed from the profile.

If the verification email does not arrive, use the resend-verification flow. Check spam/junk folders before requesting several links; only use the latest valid link.

## 3. Login and account recovery

Enter the verified email and password on the login screen.

If the password is forgotten:

1. Select **Forgot password?**
2. Enter the account email.
3. Open the password-reset email.
4. Choose a new password.
5. Log in using the new password.

Reset links are single-use and time-limited.

## 4. Profile

Open **My Profile** from the trips dashboard.

You can:

- Change the name displayed to other travelers
- Review the permanent account email
- Change the password after confirming the current password

Changing the display name updates the identity shown in trip participant lists and invitations.

## 5. Create a trip

The trips dashboard contains the creation form and all trips visible to the account.

1. Enter a unique trip name.
2. Optionally enter a description.
3. Start typing a city/place and select a destination from the result list.
4. Select start and end dates.
5. Select **Create trip**.

The destination must be selected from autocomplete so TripBuddy receives valid coordinates, timezone, and country metadata. End date cannot be before start date.

Select a trip card to open its details.

## 6. Trip details

The trip page is organized into four sections:

### Overview

- Trip name and description
- Current user's trip role
- Destination and dates
- Creator name
- Weather forecast or historical climate estimate
- Duration, itinerary count, expense total, and expense count

Administrators can edit metadata or delete the trip. Trip deletion also removes its participants, invitations, guest access, itinerary, and expenses.

### People

- Previous-contact participant form
- Participant list and roles
- Email invitation form and invitation list

Only administrators can manage this section.

### Itinerary

- Form for a title, description, and scheduled date
- Timeline of scheduled items

Administrators and users can add items. A scheduled date must be inside the trip date range. Administrators can delete items.

### Budget

- Expense form
- Estimated total in a selected display currency
- Original subtotals by currency
- Exchange-rate reference date
- Full expense list

Administrators and users can add expenses. Administrators can delete them.

## 7. Weather information

Weather information is automatically loaded from the destination and trip dates.

- **Forecast** means provider forecast data is available for that date.
- **Typical** means TripBuddy is showing historical climate conditions for that place/time of year.
- A trip can show both types when its earlier dates are inside the forecast window and later dates are outside it.

Historical climate values are estimates, not promises of future weather.

## 8. Expenses and conversion

Each expense requires:

- Title
- Positive amount
- Supported currency
- Optional category

Supported currencies are EUR, USD, GBP, CHF, RSD, CAD, AUD, and JPY.

The display-currency selector converts combined expenses using Frankfurter reference rates. Original currency subtotals remain visible. Converted values are approximate and should not be treated as accounting or payment-settlement values.

## 9. Roles

### Admin

- View the entire trip
- Edit/delete trip metadata
- Add/remove participants and change roles
- Create invitations
- Add/delete itinerary items
- Add/delete expenses

The trip creator is an administrator.

### User

- View the entire trip
- Add itinerary items
- Add expenses
- Cannot manage trip metadata, people, invitations, or deletions

### Guest participant

- View the same organized trip page
- Cannot change trip data

This registered role is different from a guest link.

## 10. Invite someone by email

An administrator can invite any email:

1. Open the trip's **People** section.
2. Enter an email.
3. Choose `admin`, `user`, or `guest` access.
4. Create the invitation.

The invitation includes the inviter's name and expires after seven days.

### Existing account

The recipient logs in using the exact invited email and accepts the invitation.

### New account

The recipient can create an account directly from the invitation page. The new account is connected to the trip after acceptance.

### Wrong account

If the browser is logged into another email, TripBuddy asks the recipient to log in with the invited account.

## 11. Previous contacts

When two registered users become connected through an accepted invitation, TripBuddy stores that relationship as a previous contact.

On a later trip, an administrator can search those previous contacts by name/email and add one directly. The form does not expose internal database user IDs.

## 12. Read-only guest link

An unregistered recipient can choose guest access from an invitation:

1. Enter a display name.
2. Continue as guest.
3. Keep the generated guest URL private.

The guest can view trip overview, weather, itinerary, and expenses but cannot change anything. Guest access is time-limited and can be revoked by an administrator.

Anyone possessing a valid guest URL can use it, so it should be treated like a password.

## 13. Language and theme

Use **EN** or **SR** in the toolbar to change language. Serbian uses Latin script. Dates, numbers, currencies, labels, validation, and application messages follow the selected language where applicable.

Use the theme button to switch between light and dark mode.

Preferences are stored only in the current browser. A different browser/device starts from its own settings.

## 14. Mobile use

On smaller screens:

- Panels stack vertically.
- Section navigation provides fast movement through the trip page.
- Forms and action buttons expand for touch use.
- The same permissions and features apply as on desktop.

For final release QA, test common mobile browsers in portrait and landscape and verify long destination names, email addresses, and invitation URLs do not break layout.

## 15. Common problems

### Cannot log in

- Confirm the email is verified.
- Confirm the password and exact email.
- Use password recovery if necessary.
- If the account was recreated after a database reset, old credentials no longer exist.

### Invitation cannot be accepted

- Check whether it expired or was already accepted.
- Log in with the exact invited email.
- Ask a trip administrator to create another invitation if necessary.

### Destination cannot be submitted

Select a result from the autocomplete list; typed free text alone is not a validated destination.

### Weather is unavailable

The provider may not recognize the destination or may be temporarily unavailable. Trip data remains usable without weather.

### Converted total is unavailable

Original expenses are still preserved. Try again later if the exchange-rate provider is unavailable.
