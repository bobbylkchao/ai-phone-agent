# AI coding client configuration

Shared guidance lives in root `AGENTS.md`. Each client adds only what it needs.

Claude Code (`.claude/`):

- Root `CLAUDE.md` imports `AGENTS.md`. Recent Claude Code versions also read
  `AGENTS.md` natively; the import keeps older versions and restricted sessions
  working and never loads the file twice.
- `rules/` contains path-scoped instructions.
- `skills/` contains on-demand project workflows.
- `settings.json` contains shared safety permissions, including deny rules for
  `.env` files (`.env.example` stays readable).
- Use `settings.local.json` for personal project overrides; it is gitignored.

Cursor (`.cursor/`):

- Reads `AGENTS.md` directly.
- `rules/*.mdc` mirrors the path-scoped rules above.
- Discovers the skills under `.claude/skills/`, so they are not duplicated.

Keep the Claude and Cursor copies of a rule in sync when you edit one. Do not put
secrets or machine-specific paths in committed settings.

Official documentation:

- [Claude Code memory and rules](https://code.claude.com/docs/en/memory)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code permissions](https://code.claude.com/docs/en/permissions)
- [Cursor rules](https://cursor.com/docs/context/rules)
