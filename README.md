# qbt-shared

Internal shared TypeScript packages used across QBT projects.

## Packages

| Name | Purpose |
| --- | --- |
| [`@qbt/data`](./packages/data) | Drizzle schema for the `sales` Postgres schema in Neon. Single source of truth for table definitions consumed by `qbt-data-pipelines`, `qbt-data-reports`, and (eventually) `qbt-dashboards`. |

## Consuming a package

Consumers depend on packages via a GitHub git URL pinned to a commit SHA:

```jsonc
{
  "dependencies": {
    "@qbt/data": "github:QBT-ACAVE/qbt-shared#<sha>"
  }
}
```

The `prepare` script in each package runs `tsc` during install, producing `dist/`. Consumers import the compiled output via the package's `exports` field.

## Adding a package

1. `mkdir -p packages/<name>/src`
2. Add `package.json` with `name: "@qbt/<name>"`, `exports`, `prepare: "tsc"`
3. Add `tsconfig.json` extending the root config
4. Push and pin consumers to the new SHA
