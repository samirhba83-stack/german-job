# 4. Interaction Feedback System

One consistent language for every interaction category the milestone named, realized through a small number of shared primitives rather than one bespoke treatment per category.

| Category | Real implementation | Visual/behavioral pattern |
|---|---|---|
| **Loading** | TanStack Query `isLoading`/`isFetching` + `Skeleton`/`SkeletonRegion` | Shape-matching skeleton, `aria-busy` |
| **Saving / Creating / Updating / Deleting / Sending** | `useTrackedMutation` (`lib/hooks/use-tracked-mutation.ts`) | Button `loading` state + Background Activity Center entry + success/error toast — the same three-part pattern regardless of which of these five verbs applies |
| **Retrying** | Reads: TanStack Query's built-in exponential backoff, configured in `app/providers.tsx` (network failures only, never on a 4xx — checked via `ApiError.status`). Writes: never auto-retry ([M20 ADR-007](../frontend-architecture/12-architecture-decision-records.md)) — a failed mutation's toast/Background Activity entry is the retry surface, and the user's next explicit submit is the retry | Consistent with the "no simulated learning/progress" discipline: a retry is either a real, silent background reattempt (reads) or a real, explicit user action (writes), never faked |
| **Recovering** | `use-auth.ts`'s 401-refresh-and-retry (`lib/api-client.ts`) — a real, silent session recovery the user never has to act on unless it genuinely fails (refresh token itself expired/invalid), at which point `clearSession()` + redirect to `/login` is the honest fallback | No silent failure state — recovery either works transparently or the user is told plainly they need to log in again |
| **Validation** | `Input`'s `error` prop (`components/ui/input.tsx`), driven by real form state today (client-side required/match checks in `LoginForm`/`RegisterForm`) and ready to receive `ApiError.fieldErrors` (the real `class-validator` array, per [03](03-execution-feedback.md)'s error-shape finding) the moment a form needs server-side field errors | Inline, `aria-describedby`'d, never a floating toast for a fixable field-level problem |

## Why this is "one language," not five separate systems

Every category above ultimately routes through one of three shared primitives: `Skeleton` (something is loading), `useTrackedMutation` (something is being changed), or `Input`'s error prop (something needs correction). A developer building a new feature reaches for one of these three, not five/nine bespoke patterns — which is what makes the consistency the milestone asks for ("every interaction must follow one consistent language") a structural property of the codebase rather than a style guideline someone has to remember to follow.
