# 🚀 Articles API - Endpoints Documentation

Base URL: `http://192.168.1.106:3000`

## 📋 Available Endpoints

### 1. Health Check
**GET** `/`

Simple endpoint to verify the API is running.

**Response:**
```
API is working
```

---

### 2. Search Articles
**GET** `/articles`

Search for articles with pagination, filtering, and full relationship data.

**Parameters:**
- `search` (string, required): Search term - supports word-based search
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Results per page (default: 20, max: 100)
- `onlyWithStock` (boolean, optional): Filter only articles with stock (default: false)
- `applicationId` (integer, optional): Filter articles by specific application ID

**Example Requests:**
```bash
# Basic search
GET /articles?search=bujia

# Search with pagination
GET /articles?search=bujia&page=2&limit=50

# Search only articles with stock
GET /articles?search=bujia&onlyWithStock=true

# Filter by specific application
GET /articles?search=bujia&applicationId=365

# Combined filters
GET /articles?search=motor&onlyWithStock=true&applicationId=365&limit=50

# Word-based search (order doesn't matter)
GET /articles?search=gol power bujia
```

**Response Format:**
```json
{
  "data": [
    {
      "id": 61085,
      "descripcion": "Bujía Gol Power",
      "marca": "BOSCH",
      "rubro": "Encendido",
      "nota": "Producto de alta demanda",
      "precio": 1234.56,
      "stock": 42,
      "aplicaciones": [
        {
          "aplicacion": "MOTORES > VW > 1.6 8V",
          "nota": null,
          "desde": "2018-01-01",
          "hasta": "2020-01-01"
        }
      ],
      "complementarios": [
        {
          "id": 208,
          "descripcion": "Filtro de Aceite",
          "marca": "MANN",
          "precio": 890.50,
          "stock": 15
        }
      ],
      "sustitutos": [
        {
          "id": 102,
          "descripcion": "Bujía Gol Power Alternativa",
          "marca": "NGK",
          "precio": 1100.00,
          "stock": 8
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1250,
    "totalPages": 63,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "queryTime": "245ms",
    "searchWords": 3
  }
}
```

---

### 3. Search Applications
**GET** `/aplicaciones`

Returns applications from the APLICACIONES table with optional search functionality.

**Parameters:**
- `search` (string, **required**): Search term - supports word-based search across application paths
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Results per page (default: 20, max: 20)

**Example Requests:**
```bash
# Search is required - no longer supports listing all
# GET /aplicaciones  # This will return 400 error

# Search for specific applications
GET /aplicaciones?search=chevrolet
GET /aplicaciones?search=motor ford&page=1&limit=20
GET /aplicaciones?search=corsa 1.4
```

**Response Format:**
```json
{
  "data": [
    {
      "id": 1,
      "aplicacion": "MOTORES > CHEVROLET > 1.4 8V",
      "nota": "Para motores a nafta",
      "artAplicacionNota": "Verificar compatibilidad con turbo",
      "articleCount": 25
    },
    {
      "id": 2,
      "aplicacion": "MOTORES > FORD > 1.6 16V",
      "nota": null,
      "artAplicacionNota": "Solo para versiones 2010+",
      "articleCount": 12
    },
    {
      "id": 3,
      "aplicacion": "MOTORES > VW > 1.6 8V",
      "nota": "Compatible con todas las versiones",
      "artAplicacionNota": null,
      "articleCount": 0
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 3,
    "limit": 20,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "queryTime": 15
  }
}
```

**Response Fields:**
- `id`: Application ID (APLIC_ID)
- `aplicacion`: Application path/description (APLICACION_PATH)
- `nota`: Application notes (NOTA_MEMO from APLICACIONES table)
- `artAplicacionNota`: Article application notes (NOTA from ART_APLICACION table)
- `articleCount`: Number of articles that use this application

---

## 🔧 Technical Details

### Database Configuration
- **Database:** Firebird 3.0
- **Host:** 192.168.1.30
- **Database:** `/var/lib/firebird/3.0/data/DBSIF.FDB`
- **User:** LECTURA (read-only access)

### Performance Features
- **Query timing:** All endpoints include execution time in response
- **Connection management:** Automatic connection pooling and cleanup
- **Error handling:** Comprehensive error responses with details
- **Logging:** Performance monitoring for all queries

### CORS Support
All endpoints support cross-origin requests with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept`

### Search Features (Articles endpoint)
- **Word-based search:** Search terms are split into words, all must be present
- **Case insensitive:** Automatic uppercase conversion for consistency
- **Performance optimization:** Limited to 5 words maximum
- **SQL injection protection:** Proper string escaping

### Error Responses
All endpoints return consistent error format:
```json
{
  "error": "Error description",
  "details": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `500`: Database connection or query error

---

## 📊 Performance Benchmarks

### Expected Response Times
- **Applications endpoint:** < 50ms (simple query)
- **Articles search (1-2 words):** < 200ms
- **Articles search (3-4 words):** < 500ms
- **Articles search (5 words):** < 800ms

### Database Optimization
For optimal performance, consider creating these indexes:
```sql
-- Basic indexes
CREATE INDEX IDX_ARTICULOS_DESC ON ARTICULOS (CALC_DESC_EXTEND);
CREATE INDEX IDX_ARTICULOS_MARCA ON ARTICULOS (MARCA_ID);
CREATE INDEX IDX_ARTICULOS_RUBRO ON ARTICULOS (RUBRO_ID);
CREATE INDEX IDX_ARTICULOS_EMP ON ARTICULOS (EMP_ID);

-- Advanced optimization
ALTER TABLE ARTICULOS ADD CALC_DESC_UPPER COMPUTED BY (UPPER(CALC_DESC_EXTEND));
CREATE INDEX IDX_ARTICULOS_DESC_UPPER ON ARTICULOS (CALC_DESC_UPPER);
```

---

## 🧪 Testing

### Manual Testing
```bash
# Test API health
curl http://192.168.1.106:3000/

# Test applications endpoint
curl http://192.168.1.106:3000/aplicaciones

# Test articles search
curl "http://192.168.1.106:3000/articles?search=bujia"

# Test with filters
curl "http://192.168.1.106:3000/articles?search=bujia&onlyWithStock=true&limit=10"
```

### Load Testing
```bash
# Using Apache Bench
ab -n 1000 -c 10 "http://192.168.1.106:3000/aplicaciones"
ab -n 100 -c 5 "http://192.168.1.106:3000/articles?search=motor"
``` 