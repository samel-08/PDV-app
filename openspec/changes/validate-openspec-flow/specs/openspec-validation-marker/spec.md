## ADDED Requirements

### Requirement: Display OpenSpec validation marker
The system SHALL display a discreet OpenSpec validation marker on the Configuracoes screen.

#### Scenario: Marker is visible on Configuracoes
- **WHEN** an operator opens the Configuracoes screen
- **THEN** the system shows a small marker indicating the OpenSpec validation change is present

### Requirement: Keep validation marker presentational
The validation marker MUST be presentational only and MUST NOT read or write persistent data.

#### Scenario: Marker does not alter system data
- **WHEN** the Configuracoes screen renders the validation marker
- **THEN** the system does not call a new API route, mutate settings, or require database changes

### Requirement: Preserve existing PDV behavior
The validation marker MUST NOT change sales, stock, payments, cashier, printing, barcode reading, or product behavior.

#### Scenario: Operational flows remain unchanged
- **WHEN** the validation marker is added to the Configuracoes screen
- **THEN** existing operational flows continue to behave as before
