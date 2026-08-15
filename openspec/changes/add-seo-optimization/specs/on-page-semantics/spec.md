## ADDED Requirements

### Requirement: The primary heading carries the venue's subject

The page's single `<h1>` SHALL contain text identifying the venue as a pickleball facility
and naming its location, without altering the visible headline design.

#### Scenario: Crawler extracts heading text

- **WHEN** the rendered `<h1>` text content is read
- **THEN** it includes "pickleball", "Talisay", and "Cebu"

#### Scenario: Visitor views the hero

- **WHEN** the hero renders on any viewport
- **THEN** the visible headline still reads "Your court. Anytime."
- **AND** the added text is not visible and does not affect layout or the weight-sweep timing

#### Scenario: Screen reader announces the heading

- **WHEN** a screen reader reaches the `<h1>`
- **THEN** it announces the headline followed by the descriptive clause as one coherent phrase

### Requirement: Exactly one h1 per document

Each route SHALL contain exactly one `<h1>`, with section headings at `<h2>` and below in
document order.

#### Scenario: Heading structure is audited

- **WHEN** the homepage's headings are enumerated
- **THEN** exactly one `<h1>` is found
- **AND** no heading level is skipped going down the document

### Requirement: Section headings carry local search intent

Section headings SHALL include the terms prospective visitors search for, rather than
relying on abstract phrasing alone.

#### Scenario: Locations section is read

- **WHEN** the Locations heading is extracted
- **THEN** it names the activity and the city rather than reading only "Your court. One tap."

#### Scenario: Visit section is read

- **WHEN** the Visit section headings are extracted
- **THEN** the branch name and city are present as text

### Requirement: Meaningful alternative text on all imagery

Every image and image-role canvas SHALL carry alternative text describing the subject.
Decorative elements SHALL be hidden from assistive technology instead.

#### Scenario: Court photography is described

- **WHEN** the court render's alternative text is read
- **THEN** it describes the court and identifies the venue

#### Scenario: Logo images are described

- **WHEN** a wordmark image is encountered
- **THEN** its alternative text is the venue name, not a filename

#### Scenario: Decorative layers are encountered

- **WHEN** a purely decorative overlay is rendered
- **THEN** it is marked `aria-hidden` and carries no alternative text

### Requirement: No raw img elements

The codebase SHALL use the framework image component for all raster imagery.

#### Scenario: Source is audited before delivery

- **WHEN** the source tree is searched for `<img`
- **THEN** no matches are found
