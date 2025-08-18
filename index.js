const express = require('express');
const Firebird = require('node-firebird-dev');
require('dotenv').config();

const app = express();
const PORT = 3000;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
  next();
});

// Authentication middleware
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.APIKEY;

  // Check if APIKEY is defined in environment
  if (!validApiKey) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'API key not configured on server'
    });
  }

  // Check if API key header is provided
  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'API key header (X-API-Key) is required'
    });
  }

  // Validate API key
  if (apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid API key'
    });
  }

  // API key is valid, proceed to next middleware
  next();
};

// Firebird connection options using LECTURA
const dbOptions = {
  host: '192.168.1.30',
  database: '/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'LECTURA',
  password: 'LECTURA'
};

// Performance Note: For optimal search performance, consider creating:
// 1. Index on RUBRO_PATH: CREATE INDEX IDX_ARTRUBROS_PATH ON ARTRUBROS (RUBRO_PATH);
// 2. Computed column for uppercase search: ALTER TABLE ARTRUBROS ADD RUBRO_PATH_UPPER COMPUTED BY (UPPER(RUBRO_PATH));
// 3. Index on computed column: CREATE INDEX IDX_ARTRUBROS_PATH_UPPER ON ARTRUBROS (RUBRO_PATH_UPPER);

// Utility function to safely trim database strings
function safeTrim(value) {
  return value && typeof value === 'string' ? value.trim() : null;
}

// Basic test endpoint
app.get('/', (req, res) => {
  res.send('API is working');
});

// Aplicaciones endpoint - search-only with required search parameter
app.get('/aplicaciones', authenticateAPIKey, (req, res) => {
  const startTime = Date.now();
  const search = req.query.search;
  const forBot = req.query.forBot === 'true';

  // Filter aplicaciones by EMP_ID = 2
  const baseWhere = "ap.EMP_ID = 2";
  
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
      
      searchFilter = `AND (${wordConditions.join(' AND ')})`;
    }
  }
  
  // Count query for total records
  const countSql = `
    SELECT COUNT(DISTINCT ap.APLIC_ID) as TOTAL_COUNT
    FROM APLICACIONES ap
    LEFT JOIN ART_APLICACION aa ON ap.APLIC_ID = aa.APLIC_ID
    WHERE ${baseWhere} ${searchFilter}
  `;

  // Main query with optional pagination
  const sql = `
    SELECT 
      ap.APLIC_ID,
      ap.APLICACION_PATH,
      ap.NOTA_MEMO,
      COUNT(DISTINCT aa.ART_ID) as ARTICLE_COUNT
    FROM APLICACIONES ap
    LEFT JOIN ART_APLICACION aa ON ap.APLIC_ID = aa.APLIC_ID
    WHERE ${baseWhere} ${searchFilter}
    GROUP BY ap.APLIC_ID, ap.APLICACION_PATH, ap.NOTA_MEMO
    ORDER BY ap.APLICACION_PATH
    ${forBot ? '' : `ROWS ${offset + 1} TO ${offset + limit}`}
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
        
        console.log(`📋 Aplicaciones: "${search || 'all'}" | ${forBot ? 'Bot' : `Page: ${page}`} | Results: 0 | Total: 0 | Time: ${queryTime}ms`);
        
        if (forBot) {
          return res.json({
            data: [],
            meta: {
              queryTime: queryTime,
              totalCount: totalCount
            }
          });
        } else {
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
          articleCount: app.ARTICLE_COUNT || 0
        }));

        db.detach();
        
        console.log(`📋 Aplicaciones: "${search || 'all'}" | ${forBot ? 'Bot' : `Page: ${page}`} | Results: ${result.length} | Total: ${totalCount} | Time: ${queryTime}ms`);
        
        if (forBot) {
          res.json({
            data: result,
            meta: {
              queryTime: queryTime,
              totalCount: totalCount
            }
          });
        } else {
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
        }
      });
    });
  });
});

// Familias endpoint - return all ARTRUBROS with optional search
app.get('/familias', authenticateAPIKey, (req, res) => {
  const startTime = Date.now();
  const search = req.query.search;
  const forBot = req.query.forBot === 'true';

  // Filter familias by EMP_ID = 2
  const baseWhere = "r.EMP_ID = 2";
  
  // Create search filter for RUBRO_PATH
  let searchFilter = "";
  if (search && search.trim() !== '') {
    const words = search.trim().split(/\s+/)
      .filter(word => word.length > 0)
      .slice(0, 5); // Limit to 5 words max for performance
    
    if (words.length > 0) {
      const wordConditions = words.map(word => {
        const cleanWord = word.replace(/'/g, "''").toUpperCase();
        return `UPPER(r.RUBRO_PATH) LIKE '%${cleanWord}%'`;
      });
      
      searchFilter = `AND (${wordConditions.join(' AND ')})`;
    }
  }

  // Query to get all familias/rubros
  const sql = `
    SELECT 
      r.RUBRO_ID,
      r.EMP_ID,
      r.RUBRO_PADRE_ID,
      r.RUBRO,
      r.RUBRO_PATH,
      r.IMAGEN,
      r.NOTA,
      r.NOTA_MEMO
    FROM ARTRUBROS r
    WHERE ${baseWhere} ${searchFilter}
    ORDER BY r.RUBRO_PATH
  `;

  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error('DB connection failed:', err);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: err.message 
      });
    }

    db.query(sql, (err, familias) => {
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      if (err) {
        db.detach();
        console.error('Familias query failed:', err);
        return res.status(500).json({ 
          error: 'Query failed', 
          details: err.message 
        });
      }

      // Process results and safely trim strings
      const result = familias.map(familia => ({
        id: familia.RUBRO_ID,
        empId: familia.EMP_ID,
        rubroPadreId: familia.RUBRO_PADRE_ID,
        rubro: safeTrim(familia.RUBRO) || '',
        rubroPath: safeTrim(familia.RUBRO_PATH) || '',
        imagen: safeTrim(familia.IMAGEN),
        nota: safeTrim(familia.NOTA),
        notaMemo: safeTrim(familia.NOTA_MEMO)
      }));

      db.detach();
      
      console.log(`👥 Familias: "${search || 'all'}" | ${forBot ? 'Bot' : 'Web'} | Results: ${result.length} | Time: ${queryTime}ms`);
      
      res.json({
        data: result,
        meta: {
          queryTime: queryTime,
          totalCount: result.length,
          searchTerm: search || null
        }
      });
    });
  });
});

app.get('/articles', authenticateAPIKey, (req, res) => {
  const startTime = Date.now(); // Performance monitoring
  const search = req.query.search;
  const forBot = req.query.forBot === 'true';
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
        return `UPPER(r.RUBRO_PATH) LIKE '%${cleanWord}%'`;
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
      a.MED, 
      a.NOTA,
      aa.DESDE AS ART_APLICACION_DESDE,
      aa.HASTA AS ART_APLICACION_HASTA,
      m.MARCA,
      r.RUBRO_PATH AS RUBRO_NOMBRE
    FROM
      ARTICULOS a
    LEFT JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    ${stockJoin}
    WHERE ${baseWhere} ${searchFilter} ${stockFilter} ${applicationId ? `AND aa.APLIC_ID = ${applicationId}` : ''}
    ORDER BY a.ART_ID
    ${forBot ? '' : `ROWS ${offset + 1} TO ${offset + limit}`}
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
          
          console.log(`🔍 Search: "${search}" | Words: ${words.length} | Stock Filter: ${onlyWithStock} | App Filter: ${applicationId || 'none'} | ${forBot ? 'Bot' : `Page: ${page}`} | Results: 0 | Time: ${queryTime}ms`);
          
          if (forBot) {
            return res.json({
              data: [],
              meta: {
                queryTime: `${queryTime}ms`,
                searchWords: words.length,
                totalCount: totalCount
              }
            });
          } else {
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
        }

      const ids = articles.map(a => a.ART_ID).join(',');

          const queries = {
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
            a.MED,
            a.NOTA,
            aa.DESDE AS ART_APLICACION_DESDE,
            aa.HASTA AS ART_APLICACION_HASTA,
            m.MARCA,
            r.RUBRO_PATH AS RUBRO_NOMBRE,
            lp.PR_FINAL as PRECIO,
            s.EXISTENCIA as STOCK
          FROM ARTICULOS a
          LEFT JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID
          LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
          LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
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

        let debugCounter = 0;
        const result = articles.map(a => {
            const id = a.ART_ID;

                            // Remove aplicaciones - not needed for this endpoint, but include complementarios and sustitutos

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
                // Build años field from DESDE and HASTA
                let años = null;
                const desde = safeTrim(relatedArticle.ART_APLICACION_DESDE);
                const hasta = safeTrim(relatedArticle.ART_APLICACION_HASTA);
                
                if (desde || hasta) {
                  const desdeYear = desde ? desde.substring(0, 4) : '';
                  const hastaYear = hasta ? hasta.substring(0, 4) : '';
                  años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
                }

                const relatedItem = {
                  id: relatedArticle.ART_ID,
                  articulo: safeTrim(relatedArticle.RUBRO_NOMBRE),
                  marca: safeTrim(relatedArticle.MARCA)
                };

                // Only include medida if it has a value
                const medida = safeTrim(relatedArticle.MED);
                if (medida && medida.trim() !== '') {
                  relatedItem.medida = medida;
                }

                // Only include años if it was built
                if (años) {
                  relatedItem.años = años;
                }

                // Only include nota if it has a value
                const nota = safeTrim(relatedArticle.NOTA);
                if (nota && nota.trim() !== '') {
                  relatedItem.nota = nota;
                }

                // Add precio and stock (stock defaults to 0 if null)
                relatedItem.precio = relatedArticle.PRECIO;
                relatedItem.stock = relatedArticle.STOCK || 0;
                
                return relatedItem;
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
                // Build años field from DESDE and HASTA
                let años = null;
                const desde = safeTrim(relatedArticle.ART_APLICACION_DESDE);
                const hasta = safeTrim(relatedArticle.ART_APLICACION_HASTA);
                
                if (desde || hasta) {
                  const desdeYear = desde ? desde.substring(0, 4) : '';
                  const hastaYear = hasta ? hasta.substring(0, 4) : '';
                  años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
                }

                const relatedItem = {
                  id: relatedArticle.ART_ID,
                  articulo: safeTrim(relatedArticle.RUBRO_NOMBRE),
                  marca: safeTrim(relatedArticle.MARCA)
                };

                // Only include medida if it has a value
                const medida = safeTrim(relatedArticle.MED);
                if (medida && medida.trim() !== '') {
                  relatedItem.medida = medida;
                }

                // Only include años if it was built
                if (años) {
                  relatedItem.años = años;
                }

                // Only include nota if it has a value
                const nota = safeTrim(relatedArticle.NOTA);
                if (nota && nota.trim() !== '') {
                  relatedItem.nota = nota;
                }

                // Add precio and stock (stock defaults to 0 if null)
                relatedItem.precio = relatedArticle.PRECIO;
                relatedItem.stock = relatedArticle.STOCK || 0;
                
                return relatedItem;
              }
              // Fallback to just ID if details not found
              return { id: r.ART_REL_ID };
            });

            // Build años field from DESDE and HASTA
            let años = null;
            const desde = safeTrim(a.ART_APLICACION_DESDE);
            const hasta = safeTrim(a.ART_APLICACION_HASTA);
            
            if (desde || hasta) {
              const desdeYear = desde ? desde.substring(0, 4) : '';
              const hastaYear = hasta ? hasta.substring(0, 4) : '';
              años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
            }

            const articleData = {
              id,
              articulo: safeTrim(a.RUBRO_NOMBRE),
              marca: safeTrim(a.MARCA)
            };

            // Only include medida if it has a value
            const medida = safeTrim(a.MED);
            if (medida && medida.trim() !== '') {
              articleData.medida = medida;
            }

            // Only include años if it was built
            if (años) {
              articleData.años = años;
            }

            // Only include nota if it has a value
            const nota = safeTrim(a.NOTA);
            if (nota && nota.trim() !== '') {
              articleData.nota = nota;
            }

            // Add precio and stock (stock defaults to 0 if null)
            articleData.precio = precio;
            articleData.stock = stock || 0;
            articleData.complementarios = complementarios;
            articleData.sustitutos = sustitutos;

          // No aplicaciones field - not needed for this endpoint

          return articleData;
          });

          const endTime = Date.now();
          const queryTime = endTime - startTime;
          
          // Log performance for monitoring
          console.log(`🔍 Search: "${search}" | Words: ${words ? words.length : 0} | Stock Filter: ${onlyWithStock} | App Filter: ${applicationId || 'none'} | ${forBot ? 'Bot' : `Page: ${page}`} | Results: ${result.length} | Time: ${queryTime}ms`);
          
          if (forBot) {
            return res.json({
              data: result,
              meta: {
                queryTime: `${queryTime}ms`,
                searchWords: words ? words.length : 0,
                totalCount: totalCount
              }
            });
          } else {
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
        }

      runSequentially();
      });
    });
  });
});

// New endpoint: Get articles by application IDs
app.get('/articles/by-applications', authenticateAPIKey, (req, res) => {
  const startTime = Date.now(); // Performance monitoring
  const onlyWithStock = req.query.onlyWithStock === 'true'; // Stock filter
  
  // Parse application IDs - support both single applicationId and array applicationIds
  let applicationIds = [];
  
  if (req.query.applicationId) {
    // Single application ID
    const singleId = parseInt(req.query.applicationId);
    if (!isNaN(singleId)) {
      applicationIds = [singleId];
    }
  } else if (req.query.applicationIds) {
    // Array of application IDs - can be comma-separated string or actual array
    const idsParam = req.query.applicationIds;
    if (typeof idsParam === 'string') {
      applicationIds = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    } else if (Array.isArray(idsParam)) {
      applicationIds = idsParam.map(id => parseInt(id)).filter(id => !isNaN(id));
    }
  }
  
  // Validate that application IDs are provided
  if (!applicationIds || applicationIds.length === 0) {
    return res.status(400).json({
      error: 'Application IDs required',
      message: 'Please provide either applicationId (single) or applicationIds (array) parameter'
    });
  }
  
  const baseWhere = "a.EMP_ID = 2";
  
  // Add stock filter to WHERE clause if needed
  const stockFilter = onlyWithStock 
    ? "AND s.EXISTENCIA > 0" 
    : "";
  
  // Determine if we need to join STOCK table
  const stockJoin = onlyWithStock 
    ? "LEFT JOIN STOCK s ON a.ART_ID = s.ART_ID AND s.DEP_ID = 12" 
    : "";

  // Create application filter for multiple IDs
  const applicationIdsString = applicationIds.join(',');
  const applicationJoin = "INNER JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID";
  const applicationFilter = `AND aa.APLIC_ID IN (${applicationIdsString})`;

  // Main query without pagination - return all results
  const sql = `
    SELECT DISTINCT
      a.ART_ID,
      a.MED, 
      a.NOTA,
      aa.DESDE AS ART_APLICACION_DESDE,
      aa.HASTA AS ART_APLICACION_HASTA,
      m.MARCA,
      r.RUBRO_PATH AS RUBRO_NOMBRE
    FROM
      ARTICULOS a
    LEFT JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    ${stockJoin}
    WHERE ${baseWhere} ${stockFilter} AND aa.APLIC_ID IN (${applicationIdsString})
    ORDER BY a.ART_ID
  `;

  Firebird.attach(dbOptions, (err, db) => {
    if (err) return res.status(500).json({ error: 'DB connection failed' });

    // Get the articles (no count query needed since we return all)
    db.query(sql, (err, articles) => {
      if (err) {
        db.detach();
        return res.status(500).json({ error: 'Query failed', details: err.message });
      }

      if (articles.length === 0) {
        db.detach();
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        console.log(`🎯 By-Applications: App IDs: [${applicationIdsString}] | Stock Filter: ${onlyWithStock} | Results: 0 | Time: ${queryTime}ms`);
        
        return res.json({
          data: [],
          meta: {
            queryTime: `${queryTime}ms`,
            applicationIds: applicationIds,
            totalCount: 0
          }
        });
      }

    const ids = articles.map(a => a.ART_ID).join(',');

    const queries = {
      precios: `SELECT ART_ID, PR_FINAL FROM ARTLPR WHERE LISTA_ID = 7 AND ART_ID IN (${ids})`,

      stock: `SELECT ART_ID, EXISTENCIA FROM STOCK WHERE DEP_ID = 12 AND ART_ID IN (${ids})`,

      rels: `SELECT ART_ID, ART_REL_ID, ART_REL_TIPO_ID FROM ART_ART
             WHERE ART_ID IN (${ids})`
    };

    const responses = {};
    const keys = Object.keys(queries);

    // Initialize response arrays to prevent undefined errors
    responses.rels = [];
    responses.relatedArticles = [];

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
            a.MED,
            a.NOTA,
            aa.DESDE AS ART_APLICACION_DESDE,
            aa.HASTA AS ART_APLICACION_HASTA,
            m.MARCA,
            r.RUBRO_PATH AS RUBRO_NOMBRE,
            lp.PR_FINAL as PRECIO,
            s.EXISTENCIA as STOCK
          FROM ARTICULOS a
          LEFT JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID
          LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
          LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
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

          // Remove aplicaciones - not needed for this endpoint

          const precioItem = responses.precios.find(p => p.ART_ID === id);
          const precio = precioItem ? precioItem.PR_FINAL : null;

          const stockItem = responses.stock.find(s => s.ART_ID === id);
          const stock = stockItem ? stockItem.EXISTENCIA : null;

          // Process complementarios with full article details
          const complementarios = (responses.rels || [])
            .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 2)
            .map(r => {
              const relatedArticle = responses.relatedArticles.find(ra => ra.ART_ID === r.ART_REL_ID);
              if (relatedArticle) {
                // Build años field from DESDE and HASTA
                let años = null;
                const desde = safeTrim(relatedArticle.ART_APLICACION_DESDE);
                const hasta = safeTrim(relatedArticle.ART_APLICACION_HASTA);
                
                if (desde || hasta) {
                  const desdeYear = desde ? desde.substring(0, 4) : '';
                  const hastaYear = hasta ? hasta.substring(0, 4) : '';
                  años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
                }

                const relatedItem = {
                  id: relatedArticle.ART_ID,
                  articulo: safeTrim(relatedArticle.RUBRO_NOMBRE),
                  marca: safeTrim(relatedArticle.MARCA)
                };

                // Only include medida if it has a value
                const medida = safeTrim(relatedArticle.MED);
                if (medida && medida.trim() !== '') {
                  relatedItem.medida = medida;
                }

                // Only include años if it was built
                if (años) {
                  relatedItem.años = años;
                }

                // Only include nota if it has a value
                const nota = safeTrim(relatedArticle.NOTA);
                if (nota && nota.trim() !== '') {
                  relatedItem.nota = nota;
                }

                // Add precio and stock (stock defaults to 0 if null)
                relatedItem.precio = relatedArticle.PRECIO;
                relatedItem.stock = relatedArticle.STOCK || 0;
                
                return relatedItem;
              }
              // Fallback to just ID if details not found
              return { id: r.ART_REL_ID };
            });

          // Process sustitutos with full article details  
          const sustitutos = (responses.rels || [])
            .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 1)
            .map(r => {
              const relatedArticle = (responses.relatedArticles || []).find(ra => ra.ART_ID === r.ART_REL_ID);
              if (relatedArticle) {
                // Build años field from DESDE and HASTA
                let años = null;
                const desde = safeTrim(relatedArticle.ART_APLICACION_DESDE);
                const hasta = safeTrim(relatedArticle.ART_APLICACION_HASTA);
                
                if (desde || hasta) {
                  const desdeYear = desde ? desde.substring(0, 4) : '';
                  const hastaYear = hasta ? hasta.substring(0, 4) : '';
                  años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
                }

                const relatedItem = {
                  id: relatedArticle.ART_ID,
                  articulo: safeTrim(relatedArticle.RUBRO_NOMBRE),
                  marca: safeTrim(relatedArticle.MARCA)
                };

                // Only include medida if it has a value
                const medida = safeTrim(relatedArticle.MED);
                if (medida && medida.trim() !== '') {
                  relatedItem.medida = medida;
                }

                // Only include años if it was built
                if (años) {
                  relatedItem.años = años;
                }

                // Only include nota if it has a value
                const nota = safeTrim(relatedArticle.NOTA);
                if (nota && nota.trim() !== '') {
                  relatedItem.nota = nota;
                }

                // Add precio and stock (stock defaults to 0 if null)
                relatedItem.precio = relatedArticle.PRECIO;
                relatedItem.stock = relatedArticle.STOCK || 0;
                
                return relatedItem;
              }
              // Fallback to just ID if details not found
              return { id: r.ART_REL_ID };
            });

          // Build años field from DESDE and HASTA
          let años = null;
          const desde = safeTrim(a.ART_APLICACION_DESDE);
          const hasta = safeTrim(a.ART_APLICACION_HASTA);
          
          if (desde || hasta) {
            const desdeYear = desde ? desde.substring(0, 4) : '';
            const hastaYear = hasta ? hasta.substring(0, 4) : '';
            años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
          }

          const articleData = {
            id,
            articulo: safeTrim(a.RUBRO_NOMBRE),
            marca: safeTrim(a.MARCA)
          };

          // Only include medida if it has a value
          const medida = safeTrim(a.MED);
          if (medida && medida.trim() !== '') {
            articleData.medida = medida;
          }

          // Only include años if it was built
          if (años) {
            articleData.años = años;
          }

          // Only include nota if it has a value
          const nota = safeTrim(a.NOTA);
          if (nota && nota.trim() !== '') {
            articleData.nota = nota;
          }

          // Add precio and stock (stock defaults to 0 if null)
          articleData.precio = precio;
          articleData.stock = stock || 0;
          articleData.complementarios = complementarios;
          articleData.sustitutos = sustitutos;

          // No aplicaciones field - not needed for this endpoint

          return articleData;
        });

        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        // Log performance for monitoring
        console.log(`🎯 By-Applications: App IDs: [${applicationIdsString}] | Stock Filter: ${onlyWithStock} | Results: ${result.length} | Time: ${queryTime}ms`);
        
        return res.json({
          data: result,
          meta: {
            queryTime: `${queryTime}ms`,
            applicationIds: applicationIds,
            totalCount: result.length
          }
        });
      }

    runSequentially();
    });
  });
});

// Rubros endpoint - return all ARTRUBROS with optional search
app.get('/rubros', authenticateAPIKey, (req, res) => {
  const startTime = Date.now();
  const search = req.query.search;
  const forBot = req.query.forBot === 'true';

  // Filter rubros by EMP_ID = 2
  const baseWhere = "r.EMP_ID = 2";
  
  // Create search filter for RUBRO_PATH and RUBRO
  let searchFilter = "";
  if (search && search.trim() !== '') {
    const words = search.trim().split(/\s+/)
      .filter(word => word.length > 0)
      .slice(0, 5); // Limit to 5 words max for performance
    
    if (words.length > 0) {
      const wordConditions = words.map(word => {
        const cleanWord = word.replace(/'/g, "''").toUpperCase();
        return `(UPPER(r.RUBRO_PATH) LIKE '%${cleanWord}%' OR UPPER(r.RUBRO) LIKE '%${cleanWord}%')`;
      });
      
      searchFilter = `AND (${wordConditions.join(' AND ')})`;
    }
  }

  // Query to get all rubros
  const sql = `
    SELECT 
      r.RUBRO_ID,
      r.EMP_ID,
      r.RUBRO_PADRE_ID,
      r.RUBRO,
      r.RUBRO_PATH,
      r.IMAGEN,
      r.NOTA,
      r.NOTA_MEMO,
      COUNT(a.ART_ID) as ARTICLE_COUNT
    FROM ARTRUBROS r
    LEFT JOIN ARTICULOS a ON r.RUBRO_ID = a.RUBRO_ID AND a.EMP_ID = 2
    WHERE ${baseWhere} ${searchFilter}
    GROUP BY r.RUBRO_ID, r.EMP_ID, r.RUBRO_PADRE_ID, r.RUBRO, r.RUBRO_PATH, r.IMAGEN, r.NOTA, r.NOTA_MEMO
    ORDER BY r.RUBRO_PATH
  `;

  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error('DB connection failed:', err);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: err.message 
      });
    }

    db.query(sql, (err, rubros) => {
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      if (err) {
        db.detach();
        console.error('Rubros query failed:', err);
        return res.status(500).json({ 
          error: 'Query failed', 
          details: err.message 
        });
      }

      // Process results and safely trim strings
      const result = rubros.map(rubro => {
        const item = {
          rubro: safeTrim(rubro.RUBRO) || '',
          rubroPath: safeTrim(rubro.RUBRO_PATH) || ''
        };
        
        // Only include nota if it has a value (not null and not empty)
        const nota = safeTrim(rubro.NOTA);
        if (nota && nota.trim() !== '') {
          item.nota = nota;
        }
        
        // Only include notaMemo if it has a value (not null and not empty)
        const notaMemo = safeTrim(rubro.NOTA_MEMO);
        if (notaMemo && notaMemo.trim() !== '') {
          item.notaMemo = notaMemo;
        }
        
        return item;
      });

      db.detach();
      
      console.log(`📂 Rubros: "${search || 'all'}" | ${forBot ? 'Bot' : 'Web'} | Results: ${result.length} | Time: ${queryTime}ms`);
      
      res.json({
        data: result,
        meta: {
          queryTime: queryTime,
          totalCount: result.length,
          searchTerm: search || null
        }
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API listening at http://localhost:${PORT}`);
});
