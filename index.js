const express = require('express');
const Firebird = require('node-firebird-dev');

const app = express();
const PORT = 3000;

// Firebird connection options using LECTURA
const dbOptions = {
  host: '192.168.1.30',
  database: '/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'LECTURA',
  password: 'LECTURA'
};

app.get('/articles/relations', (req, res) => {
  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      return res.status(500).json({ error: 'DB connection error' });
    }

    const sql = `
      SELECT
        rc.RDB$CONSTRAINT_NAME AS constraint_name,
        rc.RDB$RELATION_NAME AS table_name,
        rfc.RDB$FIELD_NAME AS field_name,
        i.RDB$RELATION_NAME AS referenced_table,
        s.RDB$FIELD_NAME AS referenced_column
      FROM
        RDB$RELATION_CONSTRAINTS rc
        JOIN RDB$REF_CONSTRAINTS ref ON rc.RDB$CONSTRAINT_NAME = ref.RDB$CONSTRAINT_NAME
        JOIN RDB$RELATION_CONSTRAINTS rc2 ON ref.RDB$CONST_NAME_UQ = rc2.RDB$CONSTRAINT_NAME
        JOIN RDB$INDEX_SEGMENTS rfc ON rc.RDB$INDEX_NAME = rfc.RDB$INDEX_NAME
        JOIN RDB$INDICES i ON rc2.RDB$INDEX_NAME = i.RDB$INDEX_NAME
        JOIN RDB$INDEX_SEGMENTS s ON i.RDB$INDEX_NAME = s.RDB$INDEX_NAME
      WHERE
        rc.RDB$RELATION_NAME = 'ARTICULOS'
    `;

    db.query(sql, (err, result) => {
      db.detach();

      if (err) {
        return res.status(500).json({ error: 'Query error', details: err.message });
      }

      // Trim padded CHAR fields
      const cleaned = result.map(row => ({
        constraint_name: row.CONSTRAINT_NAME?.trim(),
        table_name: row.TABLE_NAME?.trim(),
        field_name: row.FIELD_NAME?.trim(),
        referenced_table: row.REFERENCED_TABLE?.trim(),
        referenced_column: row.REFERENCED_COLUMN?.trim()
      }));

      res.json(cleaned);
    });
  });
});

app.get('/articles', (req, res) => {
  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error('❌ DB Connect Error:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    db.query('SELECT FIRST 1 * FROM articulos', (err, result) => {
      db.detach();

      if (err) {
        console.error('❌ Query Error:', err.message);
        return res.status(500).json({ error: 'Query failed' });
      }

      res.json(result);
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
