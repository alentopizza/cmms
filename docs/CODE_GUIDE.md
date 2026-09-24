# Code structure and maintainability guide

This document defines the repository convention for making large modules understandable to human contributors and AI agents without requiring chat history.

## Principle

Comments should explain **responsibility, boundaries, invariants and non-obvious decisions**. They should not narrate obvious syntax.

Prefer:

```ts
// ── Server-authoritative geofence validation ────────────────────────────────
// Client distance is feedback only; authorization and distance are recalculated here.
```

Avoid:

```ts
// Set loading to true.
setLoading(true);
```

## Section comments

Use section separators in files that contain multiple responsibilities or are long enough that navigation becomes difficult.

Recommended form:

```ts
// ── Authorization and tenant scope ──────────────────────────────────────────
```

Typical sections:

- Public data contracts / types
- Authorization and tenant scope
- Input parsing and validation
- Query / persistence
- Client state
- Browser permissions
- Camera / biometric capture
- Geolocation / geofence
- Server-authoritative verification
- Rendering / view composition
- Error mapping
- Audit logging

Do not add a separator for every small function. Group functions that serve one responsibility.

## Function comments

Add a short doc comment when a function:

- implements a security or privacy boundary;
- has side effects not obvious from its name;
- performs cross-module orchestration;
- depends on a domain invariant;
- accepts data that is advisory on the client but authoritative on the server.

## Security-sensitive flows

For authentication, RBAC, biometrics, geolocation, subscriptions, destructive actions and tenant isolation:

1. mark the server authority section explicitly;
2. state which client values are advisory;
3. revalidate organization/site/user scope server-side;
4. do not rely on hidden/disabled UI as authorization;
5. leave an audit event when identity/security state changes.

## Biometric code map

- `lib/client-biometric.ts`: browser model loading and live face sample generation.
- `components/SupervisedBiometricEnrollment.tsx`: supervised enrollment UI.
- `app/api/attendance/enrollment-supervised/route.ts`: server authorization, verified enrollment persistence and revocation audit.
- `components/AttendanceCapture.tsx`: field presence state machine (GPS → face → clock).
- `app/api/attendance/clock/route.ts`: server-authoritative attendance validation.
- `lib/biometric.ts`: server-side embedding encryption, similarity and distance helpers.
- migrations `013`, `017`, `018`: attendance/geofence schema, defaults and supervised enrollment audit.

## Documentation synchronization

When a code change introduces a new section or responsibility that another contributor must discover:

- update this guide if the pattern is reusable;
- update `AGENTS.md` if it is an invariant;
- update architecture/functional docs when behavior or data flow changes;
- update the changelog.

## Refactoring rule

When touching a large existing file, improve section readability opportunistically, but do not create noisy comment-only churn across the entire repository. New complex files should follow this convention from their first commit.


## Frontend Design System implementation rules

For visual work, read `docs/DESIGN_SYSTEM.md` and `docs/UI_KIT.md` before adding CSS/components.

- Prefer semantic Design Tokens over raw color/spacing/radius values.
- Do not put new hardcoded hex colors in JSX/TSX.
- Before creating a Button/Input/Card/Badge/Modal/Table/Tabs/KPI/Search/Filter primitive, inspect the UI Kit.
- Extend a reusable variant before copying a component into a module.
- Business UI may own domain composition, but visual primitives stay shared.
- Keep server/business logic outside visual primitives.
- When migrating an existing component, preserve event/form/API contracts unless the functional change is separately approved.
- Responsive behavior and keyboard/focus behavior belong in the component's implementation, not as a later module patch.
- Component comments should document non-obvious composition/accessibility constraints rather than restating CSS.
