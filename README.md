# starbase-http-knex

[![License: MIT](https://img.shields.io/npm/l/starbase-http-knex.svg)](https://github.com/jjjrmy/starbase-http-knex/blob/main/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/starbase-http-knex.svg)](https://www.npmjs.com/package/starbase-http-knex)

An npm package that queries Starbase databases through HTTP endpoints using [Knex](https://knexjs.org/).

## Installation

```bash
npm install starbase-http-knex

# or
bun add starbase-http-knex
```

## Usage

```ts
import { createConnection } from "starbase-http-knex";

// The connection function returns a Knex instance
const connection = createConnection({
  accountSubdomain: "your-identifier",
  workerSubdomain: "starbasedb", // optional, defaults to "starbasedb"
  authToken: "your-token",
});

// Basic query
const query = await connection("table_name").select("*");

// Transaction example
await connection.transaction(async (trx) => {
  await trx("users").insert({ user_id: 1 });
  const user = await trx("users").where({ user_id: 1 }).first();
});
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
