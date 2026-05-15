# Contributing

`client-sites` is licensed AGPL-3.0. All contributions are accepted under
the same license · by submitting a PR you agree that your code can be
distributed under AGPL-3.0.

## Development workflow

```bash
git clone https://github.com/emilacho/client-sites.git
cd client-sites
pnpm install
pnpm dev                        # all workspaces
pnpm --filter @client-sites/template dev   # template app only
```

## Pre-commit checks

```bash
pnpm verify                     # typecheck + lint + test (everything)
```

## Adding a new client

See `apps/template/README.md` for the cliente customization workflow and
`docs/AGENT_INTEGRATION.md` for the Phase 1 agent dispatch contract.

## AGPL note

This repo serves websites over a network. If you deploy a modified
version, the AGPL-3.0 license requires you to make the modified source
available to network users · either via a link in the site or a
mechanism the recipients can use to retrieve the source.
