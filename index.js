const express = require('express');
const Firebird = require('node-firebird-dev');

const app = express();
const PORT = 3000;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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

app.get('/articles', (req, res) => {
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 rows
  const offset = (page - 1) * limit;
  
  const baseWhere = "a.EMP_ID = 2";
  
  // Create word-based search filter
  let searchFilter = "";
  if (search) {
    // Split search into individual words and filter out empty strings
    const words = search.trim().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length > 0) {
      // Create a condition for each word (must contain all words, order doesn't matter)
      const wordConditions = words.map(word => {
        const cleanWord = word.replace(/'/g, "''").toUpperCase();
        return `UPPER(a.CALC_DESC_EXTEND) LIKE '%${cleanWord}%'`;
      });
      
      searchFilter = `AND (${wordConditions.join(' AND ')})`;
    }
  }

  // Count query for total records
  const countSql = `
    SELECT COUNT(*) as TOTAL_COUNT
    FROM
      ARTICULOS a
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    WHERE ${baseWhere} ${searchFilter}
  `;

  // Main query with pagination
  const sql = `
    SELECT
      a.ART_ID,
      a.CALC_DESC_EXTEND,
      a.NOTA,
      m.MARCA,
      r.RUBRO AS RUBRO_NOMBRE
    FROM
      ARTICULOS a
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    WHERE ${baseWhere} ${searchFilter}
    ORDER BY a.ART_ID
    ROWS ${offset + 1} TO ${offset + limit}
  `;

  Firebird.attach(dbOptions, (err, db) => {
    if (err) return res.status(500).json({ error: 'DB connection failed' });

    // First, get the total count
    db.query(countSql, (err, countResult) => {
      if (err) {
        db.detach();
        return res.status(500).json({ error: 'Count query failed', details: err.message });
      }

      const totalCount = countResult[0] ? countResult[0].TOTAL_COUNT : 0;
      const totalPages = Math.min(Math.ceil(totalCount / limit), 100); // Max 100 pages

      // Then get the articles
      db.query(sql, (err, articles) => {
        if (err) {
          db.detach();
          return res.status(500).json({ error: 'Query failed', details: err.message });
        }

        if (articles.length === 0) {
          db.detach();
          return res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          });
        }

      const ids = articles.map(a => a.ART_ID).join(',');

      const queries = {
        aplicaciones: `SELECT aa.ART_ID, ap.APLICACION_PATH, aa.NOTA, aa.DESDE, aa.HASTA
                       FROM ART_APLICACION aa
                       JOIN APLICACIONES ap ON aa.APLIC_ID = ap.APLIC_ID
                       WHERE aa.ART_ID IN (${ids})`,

        precios: `SELECT ART_ID, PR_FINAL FROM ARTLPR WHERE LISTA_ID = 7 AND ART_ID IN (${ids})`,

        stock: `SELECT ART_ID, EXISTENCIA FROM STOCK WHERE DEP_ID = 12 AND ART_ID IN (${ids})`,

        rels: `SELECT ART_ID, ART_REL_ID, ART_REL_TIPO_ID FROM ART_ART
               WHERE ART_ID IN (${ids})`
      };

      const responses = {};
      const keys = Object.keys(queries);

      const runSequentially = (i = 0) => {
        if (i >= keys.length) {
          db.detach();

          const result = articles.map(a => {
            const id = a.ART_ID;

            const aplicaciones = responses.aplicaciones
              .filter(ap => ap.ART_ID === id)
              .map(ap => ({
                aplicacion: ap.APLICACION_PATH ? ap.APLICACION_PATH.trim() : null,
                nota: ap.NOTA ? ap.NOTA.trim() : null,
                desde: ap.DESDE,
                hasta: ap.HASTA
              }));

            const precioItem = responses.precios.find(p => p.ART_ID === id);
            const precio = precioItem ? precioItem.PR_FINAL : null;

            const stockItem = responses.stock.find(s => s.ART_ID === id);
            const stock = stockItem ? stockItem.EXISTENCIA : null;

            const complementarios = responses.rels
              .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 2)
              .map(r => r.ART_REL_ID);

            const sustitutos = responses.rels
              .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 1)
              .map(r => r.ART_REL_ID);

            return {
              id,
              descripcion: a.CALC_DESC_EXTEND ? a.CALC_DESC_EXTEND.trim() : '',
              marca: a.MARCA ? a.MARCA.trim() : null,
              rubro: a.RUBRO_NOMBRE ? a.RUBRO_NOMBRE.trim() : null,
              nota: a.NOTA ? a.NOTA.trim() : null,
              aplicaciones,
              precio,
              stock,
              complementarios,
              sustitutos
            };
          });

          return res.json({
            data: result,
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          });
        }

        const key = keys[i];
        const query = queries[key];

        db.query(query, (err, rows) => {
          responses[key] = !err ? rows : [];
          runSequentially(i + 1);
        });
      };

      runSequentially();
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
