## Context

The project already has a Configuracoes screen and an OpenSpec directory, but the OpenSpec workflow needs a tiny end-to-end validation before larger PDV changes are planned through it.

This change is intentionally presentational. It must not touch Prisma, SQLite data, APIs, checkout, stock, cashier, barcode reading, or printing behavior.

## Goals / Non-Goals

**Goals:**

- Validate that an OpenSpec change can move from proposal to design, spec, tasks, and later implementation.
- Define a harmless UI marker that can be implemented quickly and verified visually.
- Keep future implementation limited to the existing Configuracoes page.

**Non-Goals:**

- Do not add database fields or migrations.
- Do not add a new settings model, API route, dependency, or runtime feature flag.
- Do not alter business logic for sales, products, stock, payments, cashier reports, or receipts.

## Decisions

- Use a static visual marker instead of a persisted setting.
  - Rationale: the purpose is to validate the OpenSpec workflow, not introduce real product state.
  - Alternative considered: store a validation flag in `ConfigSistema`; rejected because it would require database/schema work for a test-only change.

- Place the marker on the existing Configuracoes page.
  - Rationale: this page is low-risk and already communicates system-level information.
  - Alternative considered: add it to the Dashboard; rejected to avoid adding test-only content to the main operational screen.

- Reuse existing styling and components.
  - Rationale: avoids new dependencies and keeps the change small for low-memory PCs.
  - Alternative considered: add a custom component; rejected because the marker can be inline and temporary.

## Risks / Trade-offs

- Test-only UI could confuse operators if too prominent -> keep it discreet and clearly worded.
- The marker could be forgotten after validation -> keep the implementation isolated so it is easy to remove later.
- The change does not validate backend or database workflows -> acceptable because the requested validation is only for OpenSpec artifact flow.
