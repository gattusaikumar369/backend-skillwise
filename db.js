// db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "inventory.db");
const db = new sqlite3.Database(dbPath);

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      oldStock INTEGER NOT NULL,
      newStock INTEGER NOT NULL,
      changedBy TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(productId) REFERENCES products(id)
    )
  `);
});

module.exports = db;
