## ADDED Requirements

### Requirement: Venue is described as a local sports facility

The homepage SHALL emit `SportsActivityLocation` JSON-LD describing the Talisay venue,
including name, description, canonical URL, image, postal address, geo coordinates, and
opening hours.

#### Scenario: Structured data is parsed

- **WHEN** the Rich Results Test parses the homepage
- **THEN** a `SportsActivityLocation` entity is detected with no errors
- **AND** its `address` is a `PostalAddress` with street, locality, postal code, and `PH`
- **AND** its `geo` is a `GeoCoordinates` pair

#### Scenario: Opening hours are published

- **WHEN** the entity's `openingHoursSpecification` is read
- **THEN** it states all seven days, opening at 00:00 and closing at 23:59
- **AND** this matches the "open 24/7" claim in the FAQ and hero

#### Scenario: Coordinates are verified

- **WHEN** the geo coordinates are set from the documented Plus Code
- **THEN** they are confirmed against Google Maps to resolve to the venue before merge

### Requirement: Unverified fields are omitted, never stubbed

The structured-data builder SHALL omit any property whose value is not confirmed by the
client. It SHALL NOT emit placeholder, sample, or guessed values for `telephone`, `email`,
booking actions, court counts, or unconfirmed social profiles.

#### Scenario: Telephone is unknown

- **WHEN** no phone number has been supplied
- **THEN** the emitted JSON-LD contains no `telephone` key at all

#### Scenario: Facebook URL is unconfirmed

- **WHEN** only the Instagram profile is confirmed
- **THEN** `sameAs` contains the Instagram URL alone

#### Scenario: A fact is later supplied

- **WHEN** the client provides a phone number
- **THEN** adding it to configuration is sufficient for it to appear in the JSON-LD

### Requirement: FAQ content is published as structured data

The homepage SHALL emit `FAQPage` JSON-LD whose questions and answers are generated from the
same data that renders the visible FAQ section.

#### Scenario: FAQ schema is validated

- **WHEN** the Rich Results Test parses the homepage
- **THEN** a `FAQPage` entity is detected containing every question rendered on the page

#### Scenario: An FAQ answer is edited

- **WHEN** the text of a visible FAQ answer changes
- **THEN** the structured data reflects the new text without a separate edit

#### Scenario: An answer contains interactive elements

- **WHEN** an FAQ entry renders buttons or links alongside its prose
- **THEN** the structured data carries the prose answer only

### Requirement: Structured data is server-rendered

JSON-LD SHALL be present in the initial HTML response, not injected after hydration.

#### Scenario: HTML is fetched without executing JavaScript

- **WHEN** the homepage is requested and the raw response body is inspected
- **THEN** both JSON-LD script blocks are present in that body

#### Scenario: JSON-LD is serialised

- **WHEN** the JSON-LD is written into the document
- **THEN** its content is escaped so page content cannot break out of the script element
