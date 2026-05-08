# @qbt/data

Canonical Drizzle schema for the `sales` Postgres schema in Neon.

Single source of truth for `orders_detail`, `orders_daily_aggregate`, and `product_catalog`. Consumed by `qbt-data-pipelines` (writer) and `qbt-data-reports` / `qbt-dashboards` (readers).

## Usage

```ts
import { ordersDetail, ordersDailyAggregate, productCatalog } from "@qbt/data";
// or:
import * as salesSchema from "@qbt/data/sales";
```

When passing to drizzle:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@qbt/data";

export const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
```

## Consuming

Consumers depend via a GitHub git URL pinned to a commit SHA:

```jsonc
{
  "dependencies": {
    "@qbt/data": "github:QBT-ACAVE/qbt-shared#<sha>"
  }
}
```

The `prepare` script runs `tsc` during install, so `dist/` is available immediately after `npm install`.

## Updating the schema

1. Edit `src/sales.ts`
2. `npm run typecheck` to verify
3. Commit, push, note the new SHA
4. In each consumer, bump the dep to the new SHA and `npm install`
5. In `qbt-data-pipelines`, run `npm run db:generate` to produce a migration. In `qbt-data-reports`, run `drizzle-kit push` if the change is column-additive only.

## Future packages

This repo started as a single-package repo. To add a second shared package later, restructure to an npm workspace (root becomes orchestrator with `workspaces: ["packages/*"]`, move current code to `packages/data/`, publish each via GitHub Packages so consumers can resolve them by name).
