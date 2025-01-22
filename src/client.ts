import K, { type Knex } from 'knex'
import Client from 'knex/lib/dialects/sqlite3/index.js'

export type StarbaseHttpClientConfigConnection = {
  /** Your Starbase account subdomain */
  accountSubdomain: string
  /** Worker subdomain, defaults to "starbasedb" */
  workerSubdomain?: string
  /** Authorization token */
  authToken: string
} & Knex.StaticConnectionConfig

export type StarbaseHttpClientConfig = Knex.Config & {
  connection: StarbaseHttpClientConfigConnection
}

export class StarbaseHttpClient extends (Client as unknown as typeof Knex.Client) {
  declare readonly config: StarbaseHttpClientConfig
  private transactionQueries: { sql: string; params: any[] }[] = []
  private inTransaction = false

  constructor(config: StarbaseHttpClientConfig) {
    ;(config.connection as any).filename = ':memory:'
    config.useNullAsDefault = false

    super(config)

    if (!config.connection?.accountSubdomain) {
      throw Error('Missing required accountSubdomain')
    }

    if (!config.connection?.authToken) {
      throw Error('Missing required authToken')
    }

    this.config = config
  }

  _driver() {
    return this
  }

  acquireRawConnection() {
    return Promise.resolve(this)
  }

  async _query(_, obj) {
    if (!obj.sql) return Promise.reject(Error('The query is empty'))

    const workerSubdomain = this.config.connection.workerSubdomain || 'starbasedb'
    const baseUrl = `https://${workerSubdomain}.${this.config.connection.accountSubdomain}.workers.dev/query`

    // Handle transaction statements
    if (obj.sql === 'BEGIN;') {
      this.inTransaction = true
      this.transactionQueries = []
      return Promise.resolve()
    }

    if (obj.sql === 'COMMIT;') {
      this.inTransaction = false
      // Send all collected queries as a transaction
      const queries = this.transactionQueries
      this.transactionQueries = []

      return fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.connection.authToken}`,
        },
        body: JSON.stringify({
          transaction: queries
        }),
      }).then(res => this._processResponse(res, obj))
    }

    if (obj.sql === 'ROLLBACK;') {
      this.inTransaction = false
      this.transactionQueries = []
      return Promise.resolve()
    }

    // If we're in a transaction, collect the query
    if (this.inTransaction) {
      this.transactionQueries.push({
        sql: obj.sql,
        params: obj.bindings || []
      })
      return Promise.resolve()
    }

    // Regular single query
    return fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.connection.authToken}`,
      },
      body: JSON.stringify({
        sql: obj.sql,
        params: obj.bindings || [],
      }),
    }).then(res => this._processResponse(res, obj))
  }

  async _processResponse(res, obj) {
    return res.json().then(body => {
      if (res.ok) {
        if (obj.output) return obj.output.call(null, body.result)

        switch (obj.method) {
          case 'first':
            return body.result[0]
          case 'pluck':
            return body.result.map(row => row[obj.pluck])
          default:
            return body.result
        }
      }

      throw Error(body.error)
    })
  }

  async processResponse(res) {
    return res
  }
}

/**
 * Create a new connection and return the Knex instance.
 *
 * @example
 * ```ts
 * const db = createConnection({
 *   accountSubdomain: 'your-identifier',
 *   authToken: 'your-token',
 * })
 *
 * await db('users').first()
 * ```
 */
export function createConnection(
  connection: StarbaseHttpClientConfigConnection
) {
  return K({
    client: StarbaseHttpClient,
    connection,
  })
}
