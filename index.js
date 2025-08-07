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

app.get('/articles', async (req, res) => {
  const search = req.query.search;

  Firebird.attach(options, function (err, db) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Connection failed' });
    }

    let sql = `
      SELECT FIRST 100
        a.ART_ID,
        a.CALC_DESC_EXTEND,
        m.MARCA,
        a.RUBRO_ID,
        r.RUBRO,
        a.NOTA,
        a.TIENE_SUST,
        a.TIENE_COMPL,
        l.PR_FINAL,
        s.EXISTENCIA
      FROM ARTICULOS a
      LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
      LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
      LEFT JOIN ARTLPR l ON a.ART_ID = l.ART_ID AND l.LISTA_ID = 7
      LEFT JOIN STOCK s ON a.ART_ID = s.ART_ID AND s.DEP_ID = 12
      WHERE a.EMP_ID = 2
    `;

    if (search) {
      sql += ` AND a.CALC_DESC_EXTEND CONTAINING ?`;
    }

    db.query(sql, search ? [search] : [], (err, result) => {
      db.detach();
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Query failed' });
      }

      const articleIds = result.map(r => r.ART_ID);
      if (articleIds.length === 0) return res.json([]);

      // Fetch Aplicaciones
      const placeholders = articleIds.map(() => '?').join(',');
      const apQuery = `
        SELECT aa.ART_ID, aa.NOTA, aa.DESDE, aa.HASTA, ap.APLICACION_PATH
        FROM ART_APLICACION aa
        LEFT JOIN APLICACIONES ap ON aa.APLIC_ID = ap.APLIC_ID
        WHERE aa.ART_ID IN (${placeholders})
      `;

      db.query(apQuery, articleIds, (err2, apResults) => {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: 'APLICACION query failed' });
        }

        const aplicacionesMap = {};
        apResults.forEach(ap => {
          if (!aplicacionesMap[ap.ART_ID]) aplicacionesMap[ap.ART_ID] = [];
          aplicacionesMap[ap.ART_ID].push({
            aplicacion: ap.APLICACION_PATH ? ap.APLICACION_PATH.trim() : null,
            nota: ap.NOTA,
            desde: ap.DESDE,
            hasta: ap.HASTA
          });
        });

        const formatted = result.map(row => ({
          id: row.ART_ID,
          descripcion: row.CALC_DESC_EXTEND,
          marca: row.MARCA,
          rubro: row.RUBRO,
          nota: row.NOTA,
          tieneSustituto: row.TIENE_SUST && row.TIENE_SUST.trim() === 'S',
          tieneComplementario: row.TIENE_COMPL && row.TIENE_COMPL.trim() === 'S',
          precio: row.PR_FINAL,
          stock: row.EXISTENCIA,
          aplicaciones: aplicacionesMap[row.ART_ID] || []
        }));

        return res.json(formatted);
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
