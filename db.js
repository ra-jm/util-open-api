const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const { Client } = require("pg");
const { v4 } = require("uuid");

const cfg_request_tbl = "requests";

const query = {
  validate_table: `select count(*) from ${cfg_request_tbl};`,
  create_table: `CREATE TABLE ${cfg_request_tbl} (id UUID, path TEXT, host TEXT, method TEXT, headers TEXT, query TEXT, body TEXT, tz timestamp)`,
  get_records: `select * from ${cfg_request_tbl};`,
};

class AppDatabase {
  /** @typedef { import('sqlite').Database } Database */
  /** @typedef { import('pg').Client } Client */
  /** @type {(Database|Client)} */
  db;

  /** @type {boolean} */
  isPostgres = false;

  async #validateOrCreateSqliteDatabase() {
    try {
      console.log("🔃 Trying to validate SQLite table");
      await this.db.exec(query.validate_table);
      console.log("✅ SQLite table already exists.");
    } catch (error) {
      if (error.message.includes("no such table")) {
        this.db
          .exec(query.create_table)
          .then((_) => {
            console.log("✅ Created SQLite table.");
          })
          .catch((err) => {
            console.log("❌ Unable to create SQLite table.");
            throw err;
          });
      } else {
        throw error.message;
      }
    }
  }

  async #validateOrCreatePgDatabase() {
    console.log("🔃 Trying to validate PG table");
    try {
      await this.db.query(query.validate_table);
      console.log("✅ Postgres table already exists.");
    } catch (error) {
      if (error.message.includes("does not exist")) {
        this.db
          .query(query.create_table)
          .then((_) => {
            console.log("✅ Created PG table.");
          })
          .catch((err) => {
            console.log("❌ Unable to create PG table.");
            throw err;
          });
      } else {
        throw error;
      }
    }
  }

  async init() {
    try {
      const PGURL = process.env.PGURL;

      if (PGURL) {
        this.isPostgres = true;
        const client = new Client({
          connectionString: PGURL,
          ssl: {
            rejectUnauthorized: false,
          },
        });
        await client.connect();
        this.db = client;
        console.log("✅ Postgres DB Connection established");
        this.#validateOrCreatePgDatabase();
      } else {
        this.db = await open({
          filename: "./database.db",
          driver: sqlite3.cached.Database,
        });
        console.log("✅ Sqlite DB Connection established");
        await this.#validateOrCreateSqliteDatabase();
      }

      return this;
    } catch (error) {
      console.log("❌ Error validating connection.");
      console.log(error);
    }
  }

  /**
   * @param {string} path
   * @param {string} host
   * @param {string} method
   * @param {Object} headers
   * @param {(Object|string)} query
   * @param {string} body
   * @returns {Promise<boolean>}
   */
  log(path, host, method, headers, query, body) {
    return new Promise(async (resolve, reject) => {
      const id = v4();
      if (this.isPostgres) {
        await this.db.query(
          `INSERT INTO ${cfg_request_tbl} (id, path, host, method, headers, query, body, tz) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, path, host, method, headers, query, body, new Date()]
        );
        resolve(true);
      } else {
        await this.db.run(
          `INSERT INTO ${cfg_request_tbl} (id, path, host, method, headers, query, body, tz) VALUES (?,?,?,?,?,?,?,?)`,
          id,
          path,
          host,
          method,
          headers,
          query,
          body,
          new Date()
        );
        resolve(true);
      }
    });
  }

  async fetchRecords() {
    if (this.isPostgres) {
      return await this.db.query(query.get_records);
    } else {
      return await this.db.all(query.get_records);
    }
  }
}

module.exports = AppDatabase;
