# Coding Standards

- Always offer a design with reasoning first, and only implement code changes after seeking approval.

## TypeScript Preferences

- Use `type` instead of `interface` for type definitions
- Prefer type aliases for object shapes, unions, and intersections
- Add JSDoc notation including param descriptions, returns, and error throws on any exported functions.

## React Preferences

- Prefer JSX only being returned from the main return function in a component. If JSX should be rendered in a sub-function, consider whether a sub-component would be appropriate.

## Naming Conventions

- Property-based test generators use `Arb` suffix (e.g., `validNameArb`) — short for "Arbitrary"
- Constants in UPPER_SNAKE_CASE
- Functions and variables in camelCase
- Types in PascalCase

## Testing

- Unit tests in `tests/unit/`
- Property tests in `tests/property/`
- Test generators in `tests/generators/`
- Property tests use 20 runs by default (no custom timeout needed)
- Vitest runs in watch mode by default; use `npm test -- --run 2>&1` to get a single test run with results
