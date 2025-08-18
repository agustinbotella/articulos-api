# 🚀 Articles API - Endpoints Documentation

Base URL: `http://192.168.1.106:3000`

## 📋 Available Endpoints

Total: 6 endpoints

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
- `rubroId` (integer, optional): Filter articles by specific rubro ID

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

# Filter by specific rubro
GET /articles?search=bujia&rubroId=45

# Combined filters
GET /articles?search=motor&onlyWithStock=true&applicationId=365&rubroId=45&limit=50

# Word-based search (order doesn't matter)
GET /articles?search=gol power bujia
```

**Response Format:**
```json
{
  "data": [
    {
      "id": 61085,
      "articulo": "Encendido",
      "marca": "BOSCH", 
      "descripcion": "Bujía Gol Power",
      "medida": "14mm",
      "años": "Desde: 2018 - Hasta: 2020",
      "nota": "Producto de alta demanda",
      "detalle": "Bujía de alta performance",
      "precio": 1234.56,
      "stock": 42,
      "complementarios": [
        {
          "id": 208,
          "articulo": "FILTROS > ACEITE",
          "marca": "MANN",
          "descripcion": "Filtro de Aceite",
          "medida": null,
          "años": null,
          "precio": 890.50,
          "stock": 15
        }
      ],
      "sustitutos": [
        {
          "id": 102,
          "articulo": "ENCENDIDO > BUJIAS",
          "marca": "NGK",
          "descripcion": "Bujía Gol Power Alternativa",
          "medida": null,
          "años": null,
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

### 3. Get Articles by Application IDs
**GET** `/articles/by-applications`

Retrieve all articles that belong to specific application IDs. This endpoint requires application ID(s) and returns all matching articles without pagination.

**Parameters:**
- `applicationId` (integer, optional): Single application ID to filter by
- `applicationIds` (string/array, optional): Multiple application IDs (comma-separated string or array)
- `search` (string, optional): Search term - supports word-based search across articulo (RUBRO_PATH)
- `rubroId` (integer, optional): Filter articles by specific rubro ID
- `onlyWithStock` (boolean, optional): Filter only articles with stock (default: false)

**Note:** At least one of `applicationId`, `applicationIds`, `search`, or `rubroId` must be provided. If none are provided, the endpoint returns a 400 error.

**Example Requests:**
```bash
# Single application ID
GET /articles/by-applications?applicationId=365

# Multiple application IDs (comma-separated)
GET /articles/by-applications?applicationIds=365,421,508

# With stock filter
GET /articles/by-applications?applicationIds=365,421&onlyWithStock=true

# Search only (no application IDs needed)
GET /articles/by-applications?search=FILTROS

# Filter by rubro only
GET /articles/by-applications?rubroId=45

# Combined filters
GET /articles/by-applications?applicationIds=365,421&search=MOTOR&rubroId=45&onlyWithStock=true
```

**Response Format:**
```json
{
  "data": [
    {
      "id": 61085,
      "articulo": "Encendido",
      "marca": "BOSCH", 
      "descripcion": "Bujía Gol Power",
      "medida": "14mm",
      "años": "Desde: 2018 - Hasta: 2020",
      "nota": "Producto de alta demanda",
      "detalle": "Bujía de alta performance",
      "precio": 1234.56,
      "stock": 42,
      "complementarios": [
        {
          "id": 208,
          "articulo": "FILTROS > ACEITE",
          "marca": "MANN",
          "descripcion": "Filtro de Aceite",
          "medida": null,
          "años": null,
          "precio": 890.50,
          "stock": 15
        }
      ],
      "sustitutos": [
        {
          "id": 102,
          "articulo": "ENCENDIDO > BUJIAS",
          "marca": "NGK",
          "descripcion": "Bujía Gol Power Alternativa",
          "medida": null,
          "años": null,
          "precio": 1100.00,
          "stock": 8
        }
      ]
    }
  ],
  "meta": {
    "queryTime": "125ms",
    "applicationIds": [365, 421, 508],
    "totalCount": 1
  }
}
```

**Error Response (when no parameters provided):**
```json
{
  "error": "Application IDs, search, or rubroId required",
  "message": "Please provide applicationId/applicationIds parameter, search parameter, or rubroId parameter"
}
```

---

### 4. Search Applications
**GET** `/aplicaciones`

Returns applications from the APLICACIONES table. Search parameter is required for performance reasons. Article counts are calculated only for the current page results.

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

### 5. Get Familias
**GET** `/familias`

Returns all familias/categories from the ARTRUBROS table with optional search functionality. No pagination is applied - returns all matching results.

**Parameters:**
- `search` (string, optional): Search term - supports word-based search across RUBRO_PATH

**Example Requests:**
```bash
# Get all familias
GET /familias

# Search for specific familias
GET /familias?search=motor
GET /familias?search=filtro aceite
GET /familias?search=encendido
```

**Response Format:**
```json
{
  "data": [
    {
      "id": 45,
      "empId": 2,
      "rubroPadreId": 12,
      "rubro": "Filtros de Aceite",
      "rubroPath": "LUBRICACION > FILTROS > ACEITE",
      "imagen": "filtros_aceite.jpg",
      "nota": "Filtros de alta calidad",
      "notaMemo": "Verificar compatibilidad antes de la instalación"
    },
    {
      "id": 46,
      "empId": 2,
      "rubroPadreId": null,
      "rubro": "Motor",
      "rubroPath": "MOTOR",
      "imagen": null,
      "nota": null,
      "notaMemo": "Categoría principal de componentes del motor"
    }
  ],
  "meta": {
    "queryTime": 25,
    "totalCount": 156,
    "searchTerm": "motor"
  }
}
```

**Response Fields:**
- `id`: Rubro ID (RUBRO_ID)
- `empId`: Company ID (EMP_ID) - always 2
- `rubroPadreId`: Parent rubro ID (RUBRO_PADRE_ID) - null for root categories
- `rubro`: Rubro name (RUBRO)
- `rubroPath`: Full hierarchical path (RUBRO_PATH)
- `imagen`: Image filename if available (IMAGEN)
- `nota`: Short note (NOTA)
- `notaMemo`: Extended notes (NOTA_MEMO)

---

### 6. Get Rubros
**GET** `/rubros`

Returns all rubros/categories from the ARTRUBROS table with optional search functionality and article counts. No pagination is applied - returns all matching results.

**Parameters:**
- `search` (string, optional): Search term - supports word-based search across both RUBRO and RUBRO_PATH fields

**Example Requests:**
```bash
# Get all rubros
GET /rubros

# Search for specific rubros
GET /rubros?search=motor
GET /rubros?search=filtro aceite
GET /rubros?search=encendido
```

**Response Format:**
```json
{
  "data": [
    {
      "rubro": "FILTROS",
      "rubroPath": "LUBRICACION > FILTROS > ACEITE",
      "nota": "Filtros de alta calidad",
      "notaMemo": "Verificar compatibilidad antes de la instalación"
    },
    {
      "rubro": "MOTOR",
      "rubroPath": "MOTOR"
    }
  ],
  "meta": {
    "queryTime": 25,
    "totalCount": 156,
    "searchTerm": "motor"
  }
}
```

**Response Fields:**
- `rubro`: Rubro name (RUBRO)
- `rubroPath`: Full hierarchical path (RUBRO_PATH)
- `nota`: Short note (NOTA) - only included if has value
- `notaMemo`: Extended notes (NOTA_MEMO) - only included if has value

**Note:** The `nota` and `notaMemo` fields are only included in the response when they have actual values (not null or empty).

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
- **Familias endpoint:** < 30ms (simple query, no pagination)
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
curl "http://192.168.1.106:3000/aplicaciones?search=motor"

# Test familias endpoint
curl http://192.168.1.106:3000/familias
curl "http://192.168.1.106:3000/familias?search=filtro"

# Test rubros endpoint
curl http://192.168.1.106:3000/rubros
curl "http://192.168.1.106:3000/rubros?search=motor"

# Test articles search
curl "http://192.168.1.106:3000/articles?search=bujia"

# Test articles by application IDs
curl "http://192.168.1.106:3000/articles/by-applications?applicationId=365"
curl "http://192.168.1.106:3000/articles/by-applications?applicationIds=365,421,508"

# Test articles by-applications with search
curl "http://192.168.1.106:3000/articles/by-applications?search=FILTROS"

# Test with filters
curl "http://192.168.1.106:3000/articles?search=bujia&onlyWithStock=true&rubroId=45&limit=10"
curl "http://192.168.1.106:3000/articles/by-applications?applicationIds=365&search=MOTOR&rubroId=45&onlyWithStock=true"
```

### Load Testing
```bash
# Using Apache Bench
ab -n 1000 -c 10 "http://192.168.1.106:3000/aplicaciones"
ab -n 100 -c 5 "http://192.168.1.106:3000/articles?search=motor"
``` 