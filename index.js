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

app.get('/articles', (req, res) => {
  const search = req.query.search;
  const baseWhere = "a.EMP_ID = 2";
  const searchFilter = search
    ? `AND UPPER(a.CALC_DESC_EXTEND) LIKE '%${search.replace(/'/g, "''").toUpperCase()}%'`
    : "";

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
    ROWS 20
  `;

  Firebird.attach(dbOptions, (err, db) => {
    if (err) return res.status(500).json({ error: 'DB connection failed' });

    db.query(sql, async (err, articles) => {
      if (err) {
        db.detach();
        return res.status(500).json({ error: 'Query failed', details: err.message });
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
      let pending = Object.keys(queries).length;

      Object.entries(queries).forEach(([key, q]) => {
        db.query(q, (err, rows) => {
          responses[key] = !err ? rows : [];
          if (--pending === 0) {
            db.detach();
            const result = articles.map(a => {
              const id = a.ART_ID;

              const aplicaciones = responses.aplicaciones
                .filter(ap => ap.ART_ID === id)
                .map(ap => ({
                  aplicacion: ap.APLICACION_PATH?.trim(),
                  nota: ap.NOTA?.trim(),
                  desde: ap.DESDE,
                  hasta: ap.HASTA
                }));

              const precio = responses.precios.find(p => p.ART_ID === id)?.PR_FINAL || null;
              const stock = responses.stock.find(s => s.ART_ID === id)?.EXISTENCIA || null;

              const complementarios = responses.rels
                .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 2)
                .map(r => r.ART_REL_ID);

              const sustitutos = responses.rels
                .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 1)
                .map(r => r.ART_REL_ID);

              return {
                id: id,
                descripcion: a.CALC_DESC_EXTEND?.trim() || '',
                marca: a.MARCA?.trim() || null,
                rubro: a.RUBRO_NOMBRE?.trim() || null,
                nota: a.NOTA?.trim() || null,
                aplicaciones,
                precio,
                stock,
                complementarios,
                sustitutos
              };
            });

            res.json(result);
          }
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
