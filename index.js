const express = require('express');
const Firebird = require('node-firebird-dev');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Validate required environment variables
const EMP_ID = process.env.EMP_ID;
const DEP_ID = process.env.DEP_ID;

if (!EMP_ID) {
  console.error('❌ EMP_ID environment variable is required');
  process.exit(1);
}

if (!DEP_ID) {
  console.error('❌ DEP_ID environment variable is required');
  process.exit(1);
}

console.log(`✅ Using EMP_ID: ${EMP_ID}, DEP_ID: ${DEP_ID}`);

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
  // Handle Buffer objects (common in Firebird)
  if (value instanceof Buffer) {
    value = value.toString('utf8');
  }
  return value && typeof value === 'string' ? value.trim() : null;
}

// Basic test endpoint
app.get('/', authenticateAPIKey, (req, res) => {
  res.send('API is working');
});

// Aplicaciones endpoint - search-only with required search parameter
app.get('/aplicaciones', authenticateAPIKey, (req, res) => {
  const startTime = Date.now();
  const search = req.query.search;
  const forBot = req.query.forBot === 'true';

  // Filter aplicaciones by EMP_ID
  const baseWhere = `ap.EMP_ID = ${EMP_ID}`;
  
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
        const result = aplicaciones.map(app => {
          const item = {
            id: app.APLIC_ID,
            aplicacion: safeTrim(app.APLICACION_PATH) || '',
            articleCount: app.ARTICLE_COUNT || 0
          };
          
          // Only include nota if it has a value
          const nota = safeTrim(app.NOTA_MEMO);
          if (nota && nota.trim() !== '') {
            item.nota = nota;
          }
          
          return item;
        });

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

  // Filter familias by EMP_ID
  const baseWhere = `r.EMP_ID = ${EMP_ID}`;
  
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



// Articles endpoint - supports search, application IDs, and rubro filtering
app.get('/articles', authenticateAPIKey, (req, res) => {
  const startTime = Date.now(); // Performance monitoring
  const onlyWithStock = req.query.onlyWithStock === 'true'; // Stock filter
  const search = req.query.search; // Add search parameter
  const rubroId = req.query.rubroId ? parseInt(req.query.rubroId) : null; // Rubro filter
  
  // Parse application ID - support single applicationId only
  let applicationIds = [];
  
  if (req.query.applicationId) {
    // Single application ID
    const singleId = parseInt(req.query.applicationId);
    if (!isNaN(singleId)) {
      applicationIds = [singleId];
    }
  }
  
  // Make application ID optional if search or rubroId is provided
  if ((!applicationIds || applicationIds.length === 0) && !search && !rubroId) {
    return res.status(400).json({
      error: 'Application ID, search, or rubroId required',
      message: 'Please provide applicationId parameter, search parameter, or rubroId parameter'
    });
  }
  
  const baseWhere = `a.EMP_ID = ${EMP_ID}`;
  
  // Create search filter for articulo (RUBRO_PATH)
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

  // Add stock filter to WHERE clause if needed - include articles with substitute stock
  const stockFilter = onlyWithStock 
    ? `AND (s.EXISTENCIA > 0 OR EXISTS (
        SELECT 1 FROM ART_ART aa_stock 
        INNER JOIN STOCK s_sub ON aa_stock.ART_REL_ID = s_sub.ART_ID AND s_sub.DEP_ID = ${DEP_ID} 
        WHERE aa_stock.ART_ID = a.ART_ID AND aa_stock.ART_REL_TIPO_ID = 1 AND s_sub.EXISTENCIA > 0
      ))` 
    : "";
  
  // Determine if we need to join STOCK table
  const stockJoin = onlyWithStock 
    ? `LEFT JOIN STOCK s ON a.ART_ID = s.ART_ID AND s.DEP_ID = ${DEP_ID}` 
    : "";

  // Create application filter for multiple IDs (only if applicationIds provided)
  let applicationJoin = "";
  let applicationFilter = "";
  
  if (applicationIds && applicationIds.length > 0) {
    const applicationIdsString = applicationIds.join(',');
    applicationJoin = "INNER JOIN ART_APLICACION aa ON a.ART_ID = aa.ART_ID";
    applicationFilter = `AND aa.APLIC_ID IN (${applicationIdsString})`;
  }

  // Add rubro filter to WHERE clause if needed
  const rubroFilter = rubroId 
    ? `AND a.RUBRO_ID = ${rubroId}` 
    : "";

  // Main query without pagination - return all results
  const sql = `
    SELECT DISTINCT
      a.ART_ID,
      a.MOD,
      a.MED, 
      a.NOTA,
      a.DESC_ETIQUETA,
      a.CALC_DESC_EXTEND as ORIGINAL_DESC,
      (SELECT LIST(aa_desde.DESDE, ', ') 
       FROM ART_APLICACION aa_desde 
       WHERE aa_desde.ART_ID = a.ART_ID AND aa_desde.DESDE IS NOT NULL) AS ART_APLICACION_DESDE,
      (SELECT LIST(aa_hasta.HASTA, ', ') 
       FROM ART_APLICACION aa_hasta 
       WHERE aa_hasta.ART_ID = a.ART_ID AND aa_hasta.HASTA IS NOT NULL) AS ART_APLICACION_HASTA,
      (SELECT LIST(aa_nota.NOTA, ', ') 
       FROM ART_APLICACION aa_nota 
       WHERE aa_nota.ART_ID = a.ART_ID AND aa_nota.NOTA IS NOT NULL) AS ART_APLICACION_NOTAS,
      a.NOTA AS CALC_DESC_EXTEND,
      m.MARCA,
      r.RUBRO_PATH AS RUBRO_NOMBRE
    FROM
      ARTICULOS a
    LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
    LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
    ${stockJoin}
    ${applicationJoin}
    WHERE ${baseWhere} ${searchFilter} ${stockFilter} ${applicationFilter} ${rubroFilter}
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
          
        console.log(`🎯 By-Applications: Search: "${search || 'none'}" | App IDs: [${applicationIds.join(',') || 'none'}] | Rubro Filter: ${rubroId || 'none'} | Stock Filter: ${onlyWithStock} | Results: 0 | Time: ${queryTime}ms`);
          
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

      stock: `SELECT ART_ID, EXISTENCIA FROM STOCK WHERE DEP_ID = ${DEP_ID} AND ART_ID IN (${ids})`,

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
            TRIM(COALESCE(a.MOD, '') || ' ' || COALESCE(a.MED, '') || ' ' || COALESCE(a.NOTA, '') ||
                 CASE WHEN (SELECT LIST(aa_desde_rel.DESDE, ', ') 
                            FROM ART_APLICACION aa_desde_rel 
                            WHERE aa_desde_rel.ART_ID = a.ART_ID AND aa_desde_rel.DESDE IS NOT NULL) IS NOT NULL
                      THEN ' DESDE ' || (SELECT LIST(aa_desde_rel.DESDE, ', ') 
                                         FROM ART_APLICACION aa_desde_rel 
                                         WHERE aa_desde_rel.ART_ID = a.ART_ID AND aa_desde_rel.DESDE IS NOT NULL)
                      ELSE '' END ||
                 CASE WHEN (SELECT LIST(aa_hasta_rel.HASTA, ', ') 
                            FROM ART_APLICACION aa_hasta_rel 
                            WHERE aa_hasta_rel.ART_ID = a.ART_ID AND aa_hasta_rel.HASTA IS NOT NULL) IS NOT NULL
                      THEN ' HASTA ' || (SELECT LIST(aa_hasta_rel.HASTA, ', ') 
                                         FROM ART_APLICACION aa_hasta_rel 
                                         WHERE aa_hasta_rel.ART_ID = a.ART_ID AND aa_hasta_rel.HASTA IS NOT NULL)
                      ELSE '' END ||
                 CASE WHEN (SELECT LIST(aa_rel.NOTA, ', ') 
                            FROM ART_APLICACION aa_rel 
                            WHERE aa_rel.ART_ID = a.ART_ID AND aa_rel.NOTA IS NOT NULL) IS NOT NULL 
                      THEN ' - Nota: ' || (SELECT LIST(aa_rel.NOTA, ', ') 
                                           FROM ART_APLICACION aa_rel 
                                           WHERE aa_rel.ART_ID = a.ART_ID AND aa_rel.NOTA IS NOT NULL)
                      ELSE '' END) AS CALC_DESC_EXTEND,
            m.MARCA,
            r.RUBRO_PATH AS RUBRO_NOMBRE,
            lp.PR_FINAL as PRECIO,
            s.EXISTENCIA as STOCK
          FROM ARTICULOS a
          LEFT JOIN MARCAS m ON a.MARCA_ID = m.MARCA_ID
          LEFT JOIN ARTRUBROS r ON a.RUBRO_ID = r.RUBRO_ID
          LEFT JOIN ARTLPR lp ON a.ART_ID = lp.ART_ID AND lp.LISTA_ID = 7
          LEFT JOIN STOCK s ON a.ART_ID = s.ART_ID AND s.DEP_ID = ${DEP_ID}
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
          const precio = precioItem ? Math.floor(precioItem.PR_FINAL) : null;

          const stockItem = responses.stock.find(s => s.ART_ID === id);
          let stock = stockItem ? (stockItem.EXISTENCIA || 0) : 0;

          // Process complementarios with full article details
          const complementarios = (responses.rels || [])
            .filter(r => r.ART_ID === id && r.ART_REL_TIPO_ID === 2)
            .map(r => {
              const relatedArticle = responses.relatedArticles.find(ra => ra.ART_ID === r.ART_REL_ID);
              if (relatedArticle) {
                // Convert buffer to string if needed
                const relatedDescripcion = relatedArticle.CALC_DESC_EXTEND instanceof Buffer 
                  ? relatedArticle.CALC_DESC_EXTEND.toString('utf8') 
                  : relatedArticle.CALC_DESC_EXTEND;
                  
                // For now, set medida and años to null for related articles
                // TODO: Update related articles query to include MED and ART_APLICACION fields
                
                const complementarioData = {
                  id: relatedArticle.ART_ID,
                  articulo: safeTrim(relatedArticle.RUBRO_NOMBRE),
                  marca: safeTrim(relatedArticle.MARCA),
                  precio: relatedArticle.PRECIO ? Math.floor(relatedArticle.PRECIO) : null,
                  stock: relatedArticle.STOCK || 0
                };

                // Only include descripcion if it has a value
                const relatedDesc = safeTrim(relatedDescripcion);
                if (relatedDesc && relatedDesc.trim() !== '') {
                  complementarioData.descripcion = relatedDesc;
                }

                // Note: medida and años are null for related articles since we don't fetch that data
                // They will be excluded from the response



                return complementarioData;
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
                // Convert buffer to string if needed
                const relatedDescripcion = relatedArticle.CALC_DESC_EXTEND instanceof Buffer 
                  ? relatedArticle.CALC_DESC_EXTEND.toString('utf8') 
                  : relatedArticle.CALC_DESC_EXTEND;
                  
                // For now, set medida and años to null for related articles
                // TODO: Update related articles query to include MED and ART_APLICACION fields
                
                const sustitutoData = {
                  id: relatedArticle.ART_ID,
                  articulo: safeTrim(relatedArticle.RUBRO_NOMBRE),
                  marca: safeTrim(relatedArticle.MARCA),
                  precio: relatedArticle.PRECIO ? Math.floor(relatedArticle.PRECIO) : null,
                  stock: relatedArticle.STOCK || 0
                };

                // Only include descripcion if it has a value
                const relatedDesc = safeTrim(relatedDescripcion);
                if (relatedDesc && relatedDesc.trim() !== '') {
                  sustitutoData.descripcion = relatedDesc;
                }

                // Note: medida and años are null for related articles since we don't fetch that data
                // They will be excluded from the response



                return sustitutoData;
              }
              // Fallback to just ID if details not found
              return { id: r.ART_REL_ID };
            });

          // Check if sustitutos have stock when main article doesn't
          const sustitutosWithStock = sustitutos.filter(s => s.stock && s.stock > 0);
          if ((!stock || stock <= 0) && sustitutosWithStock.length > 0) {
            stock = "0 - Posee stock de sustitutos";
          }

            // Convert buffer to string if needed
            const descripcion = a.CALC_DESC_EXTEND instanceof Buffer 
              ? a.CALC_DESC_EXTEND.toString('utf8') 
              : a.CALC_DESC_EXTEND;

          // Create años field from DESDE and HASTA
          let años = null;
          
          // Convert buffers to strings before processing
          let rawDesde = a.ART_APLICACION_DESDE;
          let rawHasta = a.ART_APLICACION_HASTA;
          
          if (rawDesde instanceof Buffer) {
            rawDesde = rawDesde.toString('utf8');
          }
          if (rawHasta instanceof Buffer) {
            rawHasta = rawHasta.toString('utf8');
          }

          const desde = safeTrim(rawDesde);
          const hasta = safeTrim(rawHasta);
          
          if (desde || hasta) {
            // Parse comma-separated dates and extract years
            let desdeYear = '';
            let hastaYear = '';
          
            if (desde) {
              // Take the first date from comma-separated list and extract year
              const firstDesde = desde.split(',')[0].trim();
              if (firstDesde.length >= 4) {
                desdeYear = firstDesde.substring(0, 4);
          }
        }

            if (hasta) {
              // Take the first date from comma-separated list and extract year
              const firstHasta = hasta.split(',')[0].trim();
              if (firstHasta.length >= 4) {
                hastaYear = firstHasta.substring(0, 4);
              }
            }
            
            if (desdeYear && hastaYear) {
              años = `Desde: ${desdeYear} - Hasta: ${hastaYear}`;
            } else if (desdeYear) {
              años = `Desde: ${desdeYear}`;
            } else if (hastaYear) {
              años = `Hasta: ${hastaYear}`;
            }
          }

          const articleData = {
            id,
            articulo: safeTrim(a.RUBRO_NOMBRE),
            marca: safeTrim(a.MARCA)
          };

          // Only include descripcion if it has a value
          const desc = safeTrim(descripcion);
          if (desc && desc.trim() !== '') {
            articleData.descripcion = desc;
          }

          // Only include medida if it has a value (after descripcion)
          const medida = safeTrim(a.MED);
          if (medida && medida.trim() !== '') {
            articleData.medida = medida;
          }

          // Only include años if it has a value (after medida)
          if (años) {
            articleData.años = años;
          }

          // Only include nota if it has a value (after años)
          // Convert buffer to string if needed
          let rawNota = a.ART_APLICACION_NOTAS;
          if (rawNota instanceof Buffer) {
            rawNota = rawNota.toString('utf8');
          }
          
          const nota = safeTrim(rawNota);
          if (nota && nota.trim() !== '') {
            articleData.nota = nota;
          }

          // Add remaining fields
          articleData.precio = precio;
          articleData.stock = stock;
          articleData.complementarios = complementarios;
          articleData.sustitutos = sustitutos;



          // No aplicaciones field - not needed for this endpoint

          return articleData;
        });

        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        // Log performance for monitoring
        console.log(`🎯 By-Applications: Search: "${search || 'none'}" | App IDs: [${applicationIds.join(',') || 'none'}] | Rubro Filter: ${rubroId || 'none'} | Stock Filter: ${onlyWithStock} | Results: ${result.length} | Time: ${queryTime}ms`);
        
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

  // Filter rubros by EMP_ID
  const baseWhere = `r.EMP_ID = ${EMP_ID}`;
  
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
    LEFT JOIN ARTICULOS a ON r.RUBRO_ID = a.RUBRO_ID AND a.EMP_ID = ${EMP_ID}
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
          id: rubro.RUBRO_ID,
          rubro: safeTrim(rubro.RUBRO) || '',
          rubroPath: safeTrim(rubro.RUBRO_PATH) || ''
        };
        
        // Only include otrosNombres if it has a value (not null and not empty)
        const otrosNombres = safeTrim(rubro.NOTA);
        if (otrosNombres && otrosNombres.trim() !== '') {
          item.otrosNombres = otrosNombres;
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
