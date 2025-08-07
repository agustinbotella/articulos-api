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

app.get('/articles', (req, res) => {
  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error('❌ DB Connect Error:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    db.query('SELECT FIRST 20 * FROM articulos', (err, result) => {
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
