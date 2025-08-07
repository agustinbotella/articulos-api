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

// Performance Note: For optimal search performance, consider creating:
// 1. Index on CALC_DESC_EXTEND: CREATE INDEX IDX_ARTICULOS_DESC ON ARTICULOS (CALC_DESC_EXTEND);
// 2. Computed column for uppercase search: ALTER TABLE ARTICULOS ADD CALC_DESC_UPPER COMPUTED BY (UPPER(CALC_DESC_EXTEND));
// 3. Index on computed column: CREATE INDEX IDX_ARTICULOS_DESC_UPPER ON ARTICULOS (CALC_DESC_UPPER);

// Utility function to safely trim database strings
function safeTrim(value) {
  return value && typeof value === 'string' ? value.trim() : null;
}

// Basic test endpoint
app.get('/', (req, res) => {
  res.send('API is working');
});

// Aplicaciones endpoint - search-only with required search parameter
app.get('/aplicaciones', (req, res) => {
  const startTime = Date.now();
  const search = req.query.search;
  
  // Require search parameter
  if (!search || search.trim() === '') {
    return res.status(400).json({
      error: 'Search parameter is required',
      message: 'Por favor ingrese un término de búsqueda'
    });
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 20); // Max 20 rows, default 20
  const offset = (page - 1) * limit;
  
  // Create search filter
  let searchFilter = "";
  if (search) {
    const words = search.trim().split(/\s+/)
      .filter(word => word.length > 0)
      .slice(0, 5); // Limit to 5 words max for performance
    
    if (words.length > 0) {
      const wordConditions = words.map(word => {
        const cleanWord = word.replace(/'/g, "''").toUpperCase();
        return `UPPER(ap.APLICACION_PATH) LIKE '%${cleanWord}%'`;
      });
      
      searchFilter = `WHERE (${wordConditions.join(' AND ')})`;
    }
  }
  
  // Count query for total records
  const countSql = `
    SELECT COUNT(DISTINCT ap.APLIC_ID) as TOTAL_COUNT
    FROM APLICACIONES ap
    LEFT JOIN ART_APLICACION aa ON ap.APLIC_ID = aa.APLIC_ID
    ${searchFilter}
  `;

  // Main query with pagination
  const sql = `
    SELECT 
      ap.APLIC_ID,
      ap.APLICACION_PATH,
      ap.NOTA_MEMO,
      aa.NOTA as ART_APLICACION_NOTA,
      COUNT(DISTINCT aa2.ART_ID) as ARTICLE_COUNT
    FROM APLICACIONES ap
    LEFT JOIN ART_APLICACION aa ON ap.APLIC_ID = aa.APLIC_ID
    LEFT JOIN ART_APLICACION aa2 ON ap.APLIC_ID = aa2.APLIC_ID
    ${searchFilter}
    GROUP BY ap.APLIC_ID, ap.APLICACION_PATH, ap.NOTA_MEMO, aa.NOTA
    ORDER BY ap.APLICACION_PATH
    ROWS ${offset + 1} TO ${offset + limit}
  `;

  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error('DB connection failed:', err);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: err.message 
      });
    }

    // First get the total count
    db.query(countSql, (err, countResult) => {
      if (err) {
        db.detach();
        console.error('Count query failed:', err);
        return res.status(500).json({ 
          error: 'Count query failed', 
          details: err.message 
        });
      }

      const totalCount = countResult[0] ? countResult[0].TOTAL_COUNT : 0;
      const totalPages = Math.ceil(totalCount / limit);

      // If no results, return early
      if (totalCount === 0) {
        db.detach();
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        console.log(`📋 Aplicaciones: "${search || 'all'}" | Page: ${page} | Results: 0 | Total: 0 | Time: ${queryTime}ms`);
        
        return res.json({
          data: [],
          pagination: {
            currentPage: page,
            totalPages: Math.min(totalPages, 100), // Max 100 pages
            totalCount: totalCount,
            limit: limit,
            hasNextPage: false,
            hasPreviousPage: false
          },
          meta: {
            queryTime: queryTime
          }
        });
      }

      // Execute main query
      db.query(sql, (err, aplicaciones) => {
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        if (err) {
          db.detach();
          console.error('Query failed:', err);
          return res.status(500).json({ 
            error: 'Query failed', 
            details: err.message 
          });
        }

        // Process results and safely trim strings
        const result = aplicaciones.map(app => ({
          id: app.APLIC_ID,
          aplicacion: safeTrim(app.APLICACION_PATH) || '',
          nota: safeTrim(app.NOTA_MEMO),
          artAplicacionNota: safeTrim(app.ART_APLICACION_NOTA),
          articleCount: app.ARTICLE_COUNT || 0
        }));

        db.detach();
        
        console.log(`📋 Aplicaciones: "${search || 'all'}" | Page: ${page} | Results: ${result.length} | Total: ${totalCount} | Time: ${queryTime}ms`);
        
        res.json({
          data: result,
          pagination: {
            currentPage: page,
            totalPages: Math.min(totalPages, 100), // Max 100 pages
            totalCount: totalCount,
            limit: limit,
            hasNextPage: page < Math.min(totalPages, 100),
            hasPreviousPage: page > 1
          },
          meta: {
            queryTime: queryTime
          }
        });
      });
    });
  });
});

app.get('/articles', (req, res) => {
  const startTime = Date.now(); // Performance monitoring
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 rows
  const offset = (page - 1) * limit;
  const onlyWithStock = req.query.onlyWithStock === 'true'; // Stock filter
  const applicationId = req.query.applicationId ? parseInt(req.query.applicationId) : null; // Application filter
  
  const baseWhere = "a.EMP_ID = 2";
  
  // Create word-based search filter with performance optimizations
  let searchFilter = "";
  let words = [];
  if (search) {
    // Split search into individual words and filter out empty strings
    words = search.trim().split(/\s+/)
      .filter(word => word.length > 0)
      .slice(0, 5); // Limit to 5 words max for performance
    
    if (words.length > 0) {
      // Performance optimization: Use single UPPER() call with multiple LIKE conditions
      const wordConditions = words.map(word => {
        const cleanWord = word.replace(/'/g, "''").toUpperCase();
        return `UPPER(a.CALC_DESC_EXTEND) LIKE '%${cleanWord}%'`;
      });
      
      searchFilter = `AND (${wordConditions.join(' AND ')})`;
    }
  }

  // Add stock filter to WHERE clause if needed
  const stockFilter = onlyWithStock 
    ? "AND s.EXISTENCIA > 0" 
    : "";
  
  // Determine if we need to join STOCK table
  const stockJoin = onlyWithStock 
    ? "LEFT JOIN STOCK s ON a.ART_ID = s.ART_ID AND s.DEP_ID = 12" 
    : "";

  // Add application filter join if needed
  const applicationJoin = applicationId 
    ? "INNER JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID" 
    : "";

  // Add application filter to WHERE clause if needed
  const applicationFilter = applicationId 
    ? `AND aa.APLIC_ID = ${applicationId}` 
    : "";

  // Count query for total records
  const countSql = `
    SELECT COUNT(DISTINCT a.ART_ID) as TOTAL_COUNT
    FROM
      ARTICULOS a
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    ${stockJoin}
    ${applicationJoin}
    WHERE ${baseWhere} ${searchFilter} ${stockFilter} ${applicationFilter}
  `;

  // Main query with pagination
  const sql = `
    SELECT DISTINCT
      a.ART_ID,
      a.CALC_DESC_EXTEND,
      a.NOTA,
      m.MARCA,
      r.RUBRO AS RUBRO_NOMBRE
    FROM
      ARTICULOS a
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    ${stockJoin}
    ${applicationJoin}
    WHERE ${baseWhere} ${searchFilter} ${stockFilter} ${applicationFilter}
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
          const endTime = Date.now();
          const queryTime = endTime - startTime;
          
          console.log(`🔍 Search: "${search}" | Words: ${words.length} | Stock Filter: ${onlyWithStock} | App Filter: ${applicationId || 'none'} | Results: 0 | Time: ${queryTime}ms`);
          
          return res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            },
            meta: {
              queryTime: `${queryTime}ms`,
              searchWords: words.length
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
          // Collect all related article IDs
          const allRelatedIds = new Set();
          responses.rels.forEach(rel => {
            allRelatedIds.add(rel.ART_REL_ID);
          });
          
          if (allRelatedIds.size === 0) {
            // No related articles, proceed with normal processing
            processResults();
            return;
          }
          
          // Fetch details for related articles
          const relatedIdsArray = Array.from(allRelatedIds);
          const relatedIdsString = relatedIdsArray.join(',');
          
          const relatedArticlesQuery = `
            SELECT 
              a.ART_ID,
              a.CALC_DESC_EXTEND,
              m.MARCA,
              lp.PR_FINAL as PRECIO,
              s.EXISTENCIA as STOCK
            FROM ARTICULOS a
            LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
            LEFT JOIN ARTLPR lp ON a.ART_ID = lp.ART_ID AND lp.LISTA_ID = 7
            LEFT JOIN STOCK s ON a.ART_ID = s.ART_ID AND s.DEP_ID = 12
            WHERE a.ART_ID IN (${relatedIdsString})
          `;
          
          db.query(relatedArticlesQuery, (err, relatedArticles) => {
            if (!err && relatedArticles) {
              responses.relatedArticles = relatedArticles;
            } else {
              responses.relatedArticles = [];
            }
            processResults();
          });
          return;
        }
        
        const key = keys[i];
        const query = queries[key];

        db.query(query, (err, rows) => {
          responses[key] = !err ? rows : [];
          runSequentially(i + 1);
        });
      };
      
      function processResults() {
        db.detach();

        const result = articles.map(a => {
            const id = a.ART_ID;

            const aplicaciones = responses.aplicaciones
              .filter(ap => ap.ART_ID === id)
              .map(ap => ({
                aplicacion: safeTrim(ap.APLICACION_PATH),
                nota: safeTrim(ap.NOTA),
                desde: ap.DESDE,
                hasta: ap.HASTA
              }));

            const precioItem = responses.precios.find(p => p.ART_ID === id);
            const precio = precioItem ? precioItem.PR_FINAL : null;

            const stockItem = responses.stock.find(s => s.ART_ID === id);
            const stock = stockItem ? stockItem.EXISTENCIA : null;

            // Process complementarios with full article details
            const complementarios = responses.rels
              .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 2)
              .map(r => {
                const relatedArticle = responses.relatedArticles.find(ra => ra.ART_ID === r.ART_REL_ID);
                if (relatedArticle) {
                  return {
                    id: relatedArticle.ART_ID,
                    descripcion: safeTrim(relatedArticle.CALC_DESC_EXTEND) || '',
                    marca: safeTrim(relatedArticle.MARCA),
                    precio: relatedArticle.PRECIO,
                    stock: relatedArticle.STOCK
                  };
                }
                // Fallback to just ID if details not found
                return { id: r.ART_REL_ID };
              });

            // Process sustitutos with full article details  
            const sustitutos = responses.rels
              .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 1)
              .map(r => {
                const relatedArticle = responses.relatedArticles.find(ra => ra.ART_ID === r.ART_REL_ID);
                if (relatedArticle) {
                  return {
                    id: relatedArticle.ART_ID,
                    descripcion: safeTrim(relatedArticle.CALC_DESC_EXTEND) || '',
                    marca: safeTrim(relatedArticle.MARCA),
                    precio: relatedArticle.PRECIO,
                    stock: relatedArticle.STOCK
                  };
                }
                // Fallback to just ID if details not found
                return { id: r.ART_REL_ID };
              });

            return {
              id,
              descripcion: safeTrim(a.CALC_DESC_EXTEND) || '',
              marca: safeTrim(a.MARCA),
              rubro: safeTrim(a.RUBRO_NOMBRE),
              nota: safeTrim(a.NOTA),
              aplicaciones,
              precio,
              stock,
              complementarios,
              sustitutos
            };
          });

          const endTime = Date.now();
          const queryTime = endTime - startTime;
          
          // Log performance for monitoring
          console.log(`🔍 Search: "${search}" | Words: ${words ? words.length : 0} | Stock Filter: ${onlyWithStock} | App Filter: ${applicationId || 'none'} | Results: ${result.length} | Time: ${queryTime}ms`);
          
          return res.json({
            data: result,
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            },
            meta: {
              queryTime: `${queryTime}ms`,
              searchWords: words ? words.length : 0
            }
          });
        }

      runSequentially();
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
