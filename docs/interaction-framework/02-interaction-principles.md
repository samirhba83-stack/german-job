# 2. Interaction Principles

Six rules, each with a real, checkable implementation — not aspirational this time.

## Every click has visible feedback

Every `Button` (`components/ui/button.tsx`) supports a real `loading` state (`aria-busy`, disabled, spinner) driven by actual async state — never a bare click with no acknowledgment. Every mutation triggered via `lib/hooks/use-tracked-mutation.ts` automatically reflects this: `isPending` is real TanStack Query mutation state, not a simulated delay.

## Every request has progress

Reads use `Skeleton`/`SkeletonRegion` (`components/ui/skeleton.tsx`) matching the eventual content's shape, per [M20's default loading pattern](../frontend-architecture/10-ux-principles.md), now implemented as a real, reusable component with `aria-busy`/`aria-live` wiring. Long-running, multi-stage operations use `ExecutionStageList` ([03-execution-feedback.md](03-execution-feedback.md)) — real stages only.

## Every background task is visible

`useTrackedMutation` (`lib/hooks/use-tracked-mutation.ts`) registers every mutation with the Background Activity Center (`lib/stores/background-activity-store.ts`) automatically — a developer using this hook gets this property for free; they don't have to remember to wire it per feature. See [06-background-activity-center.md](06-background-activity-center.md).

## Every completed action is acknowledged

`useTrackedMutation`'s `successMessage` option pushes a real toast (`lib/stores/toast-store.ts` + `components/ui/toaster.tsx`) on success — `aria-live="polite"`, auto-dismisses after 5.5s, stacks correctly for multiple concurrent toasts.

## Every failure is explained

Every `ApiError` thrown by `lib/api-client.ts` carries a real, extracted message — verified directly against the live backend (not assumed): a 401 from `LocalAuthGuard` and a 400 from `ValidationPipe` both nest their message inside `{ message: { message, error, statusCode } }`, which `extractMessage()` now unwraps correctly (a genuine bug this milestone found and fixed by testing against the real API, not by re-reading M20's documentation and trusting it). `useTrackedMutation` and `use-auth.ts` both surface this real message via toast — never a generic "error occurred" when a specific one is available.

## Every interruption has a reason

No modal, toast, or redirect in this shell fires without a real, stateful cause: the `AppShell` auth guard redirects to `/login` only when `hydrated && !refreshToken` (a real, checked condition, not a timer); the `MobileNavDrawer` closes only on a real user action (`Escape`, outside click, explicit close). Nothing in this codebase interrupts the user "because enough time has passed" or for any reason that isn't traceable to a real state change.

## The standing test

Users should never wonder whether the system is working — every principle above is, concretely, "here is the real state (loading/success/error) and here is the real UI element that reflects it." Nothing in this shell shows a state that isn't backed by a real value somewhere in the React tree.
