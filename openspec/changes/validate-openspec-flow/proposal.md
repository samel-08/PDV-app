## Why

We need a very small, low-risk change to validate that the OpenSpec proposal, design, spec, and task workflow is functioning in this project before using it for real PDV features.

## What Changes

- Add a discreet validation marker in the existing Configuracoes screen.
- Keep the marker purely presentational, with no database, API, Prisma, payment, stock, or sales changes.
- Use the current UI style and existing dependencies only.
- Do not implement the change as part of this proposal.

## Capabilities

### New Capabilities

- `openspec-validation-marker`: Covers a simple visible marker used only to validate the OpenSpec change workflow in the PDV project.

### Modified Capabilities

- None.

## Impact

- Expected future code impact is limited to the existing Configuracoes page.
- No Prisma schema changes.
- No database migration.
- No new dependency.
- No changes to sales, stock, cashier, printing, barcode reading, or payment behavior.
