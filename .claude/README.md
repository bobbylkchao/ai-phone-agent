# Claude Code project configuration

This directory uses Claude Code's official project configuration locations:

- Root `CLAUDE.md` imports the shared `AGENTS.md` guidance.
- `rules/` contains path-scoped instructions.
- `skills/` contains on-demand project workflows.
- `settings.json` contains shared safety permissions.

- Use `settings.local.json` for personal project overrides; it is gitignored.
- Do not put secrets or machine-specific paths in committed settings.

Official documentation:

- [Project memory and rules](https://code.claude.com/docs/en/memory)
- [Skills](https://code.claude.com/docs/en/skills)
- [Settings](https://code.claude.com/docs/en/settings)
