// routes/products.js
const express = require("express");
const router = express.Router();
const db = require("../db");

const multer = require("multer");
const csv = require("csv-parser");
const { Parser } = require("json2csv");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");

router.get("/", (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

router.get("/search", (req, res) => {
  const q = req.query.name || "";
  db.all(
    "SELECT * FROM products WHERE LOWER(name) LIKE ?",
    [`%${q.toLowerCase()}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

router.put("/:id", (req, res) => {
  const id = req.params.id;
  const { name, unit, category, brand, stock, status, image } = req.body;

  if (stock < 0 || isNaN(stock)) {
    return res.status(400).json({ error: "Stock must be >= 0" });
  }

  // Ensure name unique (except itself)
  db.get(
    "SELECT * FROM products WHERE LOWER(name) = ? AND id != ?",
    [name.toLowerCase(), id],
    (err, existing) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (existing) return res.status(400).json({ error: "Name must be unique" });

      // Get old stock before update
      db.get("SELECT * FROM products WHERE id = ?", [id], (err, oldProduct) => {
        if (err || !oldProduct) return res.status(404).json({ error: "Not found" });

        db.run(
          `UPDATE products
           SET name=?, unit=?, category=?, brand=?, stock=?, status=?, image=?
           WHERE id=?`,
          [name, unit, category, brand, stock, status, image, id],
          function (err2) {
            if (err2) return res.status(500).json({ error: "Update failed" });

            // Insert inventory log if stock changed
            if (oldProduct.stock !== stock) {
              const changedBy = "admin"; // or from auth later
              const timestamp = new Date().toISOString();
              db.run(
                `INSERT INTO inventory_logs (productId, oldStock, newStock, changedBy, timestamp)
                 VALUES (?,?,?,?,?)`,
                [id, oldProduct.stock, stock, changedBy, timestamp]
              );
            }

            db.get("SELECT * FROM products WHERE id = ?", [id], (err3, updated) => {
              if (err3) return res.status(500).json({ error: "Fetch failed" });
              res.json(updated);
            });
          }
        );
      });
    }
  );
});

router.get("/:id/history", (req, res) => {
  const id = req.params.id;
  db.all(
    "SELECT * FROM inventory_logs WHERE productId = ? ORDER BY timestamp DESC",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File required" });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      let added = 0;
      let skipped = 0;
      const duplicates = [];

      const insertNext = (index) => {
        if (index >= results.length) {
          fs.unlinkSync(req.file.path);
          return res.json({ added, skipped, duplicates });
        }
        const row = results[index];
        const { name, unit, category, brand, stock, status, image } = row;

        db.get(
          "SELECT id FROM products WHERE LOWER(name) = ?",
          [name.toLowerCase()],
          (err, existing) => {
            if (existing) {
              skipped++;
              duplicates.push({ name, existingId: existing.id });
              return insertNext(index + 1);
            }

            db.run(
              `INSERT INTO products (name, unit, category, brand, stock, status, image)
               VALUES (?,?,?,?,?,?,?)`,
              [name, unit, category, brand, Number(stock || 0), status, image],
              function (err2) {
                if (!err2) added++;
                else skipped++;
                insertNext(index + 1);
              }
            );
          }
        );
      };

      insertNext(0);
    });
});

router.get("/export", (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });

    const fields = ["name", "unit", "category", "brand", "stock", "status", "image"];
    const parser = new Parser({ fields });
    const csvData = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="products.csv"');
    res.send(csvData);
  });
});

module.exports = router;