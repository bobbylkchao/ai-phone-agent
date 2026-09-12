---
paths:
  - "src/**/*.{ts,tsx}"
---

# TypeScript style

Follow `eslint.config.mjs` and Prettier first.

- Prefer arrow functions for new named and exported helpers.
- Use arrow functions for callbacks and inline handlers.
- Keep an existing function declaration when hoisting, `this`, or `arguments` requires it.
- Do not rewrite unrelated functions only to change declaration style.
