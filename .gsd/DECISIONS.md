# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 |  | frontend-help | How to provide guided help and quick tutorials in the React frontend | Implement a local HelpAssistant component instead of adding IntroJS | The requested help content is deterministic and app-specific, so a local component avoids adding a new dependency to the already large frontend bundle, keeps tutorials usable without external services, and avoids brittle selector-based tours while still offering quick answers and route shortcuts. | Yes | agent |
