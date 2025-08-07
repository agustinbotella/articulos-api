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

// Basic test endpoint
app.get('/', (req, res) => {
  res.send('API is working');
});

// Get first 20 articles
app.get('/articles', (req, res) => {
  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error('❌ DB Connect Error:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const sql = `
      SELECT
        a.ART_ID,
        a.CALC_DESC_EXTEND,
        a.NOTA,
        m.MARCA,
        r.RUBRO AS RUBRO_NOMBRE
      FROM
        ARTICULOS a
      LEFT JOIN
        MARCAS m ON a.MARCA_ID = m.MARCA_ID
      LEFT JOIN
        ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
      ROWS 20
    `;

    db.query(sql, (err, result) => {
      db.detach();

      if (err) {
        console.error('❌ Query Error:', err.message);
        return res.status(500).json({ error: 'Query failed' });
      }

      const cleaned = result.map(row => ({
        id: row.ART_ID,
        descripcion: row.CALC_DESC_EXTEND ? row.CALC_DESC_EXTEND.trim() : '',
        marca: row.MARCA ? row.MARCA.trim() : null,
        rubro: row.RUBRO_NOMBRE ? row.RUBRO_NOMBRE.trim() : null,
        nota: row.NOTA ? row.NOTA.trim() : null
      }));

      res.json(cleaned);
    });
  });
});




// Get foreign key relations of "articulos"
app.get('/articles/relations', (req, res) => {
  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      return res.status(500).json({ error: 'DB connection error' });
    }

    const sql = `
      SELECT
        rc.RDB$CONSTRAINT_NAME AS CONSTRAINT_NAME,
        rc.RDB$RELATION_NAME AS TABLE_NAME,
        rfc.RDB$FIELD_NAME AS FIELD_NAME,
        i.RDB$RELATION_NAME AS REFERENCED_TABLE,
        s.RDB$FIELD_NAME AS REFERENCED_COLUMN
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

      // Trim CHAR fields (Firebird pads with spaces)
      const cleaned = result.map(row => ({
        constraint_name: row.CONSTRAINT_NAME ? row.CONSTRAINT_NAME.trim() : null,
        table_name: row.TABLE_NAME ? row.TABLE_NAME.trim() : null,
        field_name: row.FIELD_NAME ? row.FIELD_NAME.trim() : null,
        referenced_table: row.REFERENCED_TABLE ? row.REFERENCED_TABLE.trim() : null,
        referenced_column: row.REFERENCED_COLUMN ? row.REFERENCED_COLUMN.trim() : null
      }));

      res.json(cleaned);
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
