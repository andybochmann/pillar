---
applyTo: "src/components/**"
---

# Component Instructions

## General Rules

- Use functional components with named exports
- Only add `"use client"` when the component uses hooks, event handlers, or browser APIs
- Server components are the default — prefer them for data fetching
- Import UI components from `@/components/ui/` (shadcn)
- Use `cn()` from `@/lib/utils` for conditional class merging

## shadcn/ui Usage

- Check installed components in `src/components/ui/` before installing new ones
- Follow shadcn composition patterns (e.g., Card with CardHeader, CardContent, CardFooter)
- Use the Sonner toast component for notifications
- Use Sheet for slide-over panels (task detail editing)
- Use Dialog for modal confirmations

## Accessibility

- All interactive elements must be keyboard accessible
- Use semantic HTML elements (button, nav, main, aside)
- Include aria-labels for icon-only buttons
- Touch targets must be at least 44x44px for mobile
- Support keyboard navigation in Kanban board
- **Every `Dialog` must include `DialogDescription`** — even if visually hidden with `className="sr-only"`. Radix UI logs console warnings without it.
- **Every `Sheet` must include `SheetDescription`** — same rule as Dialog above.

## Styling

- Use Tailwind CSS v4 utility classes
- Responsive design: mobile-first approach
- Support dark mode via Tailwind dark: variant
- Use CSS variables defined in globals.css for theme colors

## Testing

- Component tests use React Testing Library
- Test what users see, not implementation details
- Use `screen.getByRole()` as primary query
- Test keyboard interactions and accessibility
