# 11. Responsive Interaction

## Real, verified behavior

The shell's responsive behavior is implemented against [M21's exact breakpoint tokens](../design-system/03-design-tokens.md) (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px, `3xl` 1920px, all now real Tailwind config values in `tailwind.config.ts`, not just documented numbers):

- **Mobile / Tablet** (`< md`): `PrimarySidebar` is hidden (`hidden ... md:flex` in `app-shell.tsx`); `MobileNavDrawer` is the only navigation surface, opened via the header's menu button.
- **Laptop / Desktop** (`≥ md`): `PrimarySidebar` renders persistently; the mobile menu button is hidden (`md:hidden` on the trigger).
- **Ultra-wide** (`≥ 3xl`): the Workspace Area's parent is capped at `max-w-content` (1440px, [M21 §5](../design-system/05-grid-system.md)) with `3xl:px-8` extra side padding — content never stretches edge-to-edge on a wide monitor, verified structurally in `app-shell.tsx`'s `main` element classes.

## Consistency across breakpoints — what this actually guarantees

Every interactive element (Button, Input, DropdownMenu, Toast) is the same component at every breakpoint — there is no separate "mobile Button" or "desktop DropdownMenu." Only layout (the Sidebar/Drawer split) and type scale ([M21 §4](../design-system/04-typography-system.md)'s two-tier responsive sizes, already wired into `tailwind.config.ts`'s `display`/`display-md` etc. token pairs) change across breakpoints — behavior (what a click does, what a loading state looks like) never does, which is the concrete meaning of the milestone's "behavior changes should never confuse users" requirement.

## What wasn't tested

This milestone's verification (a production build, a dev-server boot, and live API calls) did not include a real visual check across every breakpoint in an actual browser — no browser-automation tool was available in this environment. The Tailwind classes are correct by construction (matching [M21's real, already-specified breakpoint behavior](../design-system/10-responsive-strategy.md) exactly), but a visual QA pass across real device widths is real, outstanding work — named plainly in [14-risks-and-future-expansion.md](14-risks-and-future-expansion.md) rather than silently assumed to be fine.
