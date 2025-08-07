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
- API de artículos ejecutándose en `http://localhost:3000`

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

## 🎯 Funcionalidades

### Búsqueda
- Escribir el término de búsqueda en el campo de texto
- Presionar **Enter** o hacer click en el botón de búsqueda
- Los resultados se mostrarán automáticamente

### Información mostrada por artículo:
- **ID y Descripción** del artículo
- **Marca y Rubro** (como badges)
- **Nota** (si está disponible)
- **Precio** formateado en pesos argentinos
- **Stock** (resaltado en rojo si es 0 o negativo)
- **Aplicaciones** (sección colapsable con detalles)
- **Complementarios y Sustitutos** (como badges numerados)

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
GET http://localhost:3000/articles?search={query}
```

### Ejemplo de respuesta:
```json
[
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
    "complementarios": [208, 333],
    "sustitutos": [102, 305]
  }
]
```

## 🛟 Resolución de Problemas

### La aplicación no carga
- Verificar que Node.js esté instalado: `node --version`
- Verificar que el puerto 3001 esté disponible

### No se muestran resultados
- Verificar que la API esté ejecutándose en `http://localhost:3000`
- Probar la API directamente: `curl "http://localhost:3000/articles?search=test"`
- Verificar la consola del navegador para errores de CORS

### Error de CORS
La API debe permitir requests desde `http://localhost:3001`. Agregar middleware de CORS si es necesario:

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