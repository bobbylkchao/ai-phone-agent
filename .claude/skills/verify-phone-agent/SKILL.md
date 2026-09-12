---
name: verify-phone-agent
description: Verifies AI Phone Agent changes before completion. Use after modifying TypeScript, configuration, dependencies, or call-flow behavior.
---

# Verify AI Phone Agent changes

Run in order and stop on the first failure:

1. `npm run format`
2. `npm run lint:ci`
3. `npm run test:ci`
4. `npm run build`

Report each result. For call-flow changes, also describe the relevant manual Amazon Connect or HTTP probe that remains.
