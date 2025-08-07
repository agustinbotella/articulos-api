# 🛍️ Frontend Buscador de Artículos

Una aplicación frontend simple y moderna para buscar artículos usando la API de artículos.

## 🚀 Características

- **Búsqueda en tiempo real** de artículos
- **Interfaz responsive** con Bootstrap 5
- **Visualización completa** de información de artículos
- **Compatible con Node 12+**
- **Sin dependencias de build** - funciona directamente

## 📋 Requisitos

- Node.js 12 o superior
- API de artículos ejecutándose en `http://192.168.1.106:3000`

## 🔧 Instalación y Uso

### 1. Navegar al directorio del frontend
```bash
cd frontend
```

### 2. Iniciar el servidor de desarrollo
```bash
npm start
```

### 3. Abrir en el navegador
Abrir [http://localhost:3001](http://localhost:3001) en tu navegador.

**Nota**: El frontend se conectará automáticamente a la API en `http://192.168.1.106:3000`

## 🎯 Funcionalidades

### Búsqueda
- Escribir el término de búsqueda en el campo de texto
- Seleccionar cantidad de resultados por página (20, 50 o 100)
- **Filtro de stock**: Marcar "Solo con stock" para mostrar únicamente artículos disponibles
- Presionar **Enter** o hacer click en el botón de búsqueda
- Los resultados se mostrarán automáticamente

### Paginación
- **Navegación**: Botones anterior/siguiente para navegar entre páginas
- **Información**: Total de artículos encontrados y página actual
- **Tiempo de consulta**: Muestra el tiempo de ejecución de la búsqueda en la base de datos
- **Límite**: Máximo 100 resultados por página, máximo 100 páginas
- **Selector**: Cambio dinámico de resultados por página

### Información mostrada por artículo:
- **ID y Descripción** del artículo
- **Marca y Rubro** (como badges)
- **Nota** (si está disponible)
- **Precio** formateado en pesos argentinos
- **Stock** (resaltado en rojo si es 0 o negativo)
- **Aplicaciones** (sección colapsable con detalles)
- **Complementarios y Sustitutos** (secciones colapsables con información completa del artículo)

## 🛠️ Estructura del Proyecto

```
frontend/
├── public/
│   ├── index.html      # Página principal
│   └── app.js          # Lógica de la aplicación
├── src/
│   └── app.js          # Archivo fuente (copiado a public)
├── package.json        # Configuración del proyecto
└── README.md          # Este archivo
```

## 🎨 Tecnologías Utilizadas

- **HTML5** - Estructura semántica
- **CSS3** - Estilos personalizados
- **JavaScript (ES6+)** - Lógica de la aplicación
- **Bootstrap 5** - Framework CSS responsive
- **Font Awesome** - Iconos
- **Fetch API** - Comunicación con la API

## 🔗 API Endpoint

La aplicación consume la siguiente API:

```
GET http://192.168.1.106:3000/articles?search={query}&page={page}&limit={limit}&onlyWithStock={boolean}
```

### Parámetros:
- `search`: Término de búsqueda (requerido)
- `page`: Número de página (opcional, por defecto: 1)
- `limit`: Resultados por página (opcional, por defecto: 20, máximo: 100)
- `onlyWithStock`: Filtrar solo artículos con stock (opcional, por defecto: false)

### Ejemplo de respuesta:
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
  }
}
```

## 🛟 Resolución de Problemas

### La aplicación no carga
- Verificar que Node.js esté instalado: `node --version`
- Verificar que el puerto 3001 esté disponible

### No se muestran resultados
- Verificar que la API esté ejecutándose en `http://192.168.1.106:3000`
- Probar la API directamente: `curl "http://192.168.1.106:3000/articles?search=test"`
- Verificar la consola del navegador para errores de CORS

### Error de CORS
La API debe permitir requests desde el frontend. Agregar middleware de CORS si es necesario:

```javascript
// En la API (index.js)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
```

## 🚀 Mejoras Futuras

- [ ] Paginación de resultados
- [ ] Filtros por marca/rubro
- [ ] Historial de búsquedas
- [ ] Favoritos
- [ ] Modo oscuro
- [ ] Progressive Web App (PWA)

## 📝 Notas de Desarrollo

- El archivo `src/app.js` se copia a `public/app.js` para ser servido por el servidor estático
- Compatible con Node 12 (sin uso de módulos ES6 en el servidor)
- No requiere proceso de build ni transpilación
- Utiliza la API nativa `fetch` (compatible con navegadores modernos) 