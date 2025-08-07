// API Configuration
const API_BASE_URL = 'http://localhost:3000';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const stockFilterCheckbox = document.getElementById('stockFilter');
const resultsContainer = document.getElementById('resultsContainer');
const resultsInfo = document.getElementById('resultsInfo');
const totalCountSpan = document.getElementById('totalCount');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const queryTimeSpan = document.getElementById('queryTime');
const paginationContainer = document.getElementById('paginationContainer');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const loadingSpinner = document.querySelector('.loading-spinner');
const noResults = document.querySelector('.no-results');
const errorMessage = document.querySelector('.error-message');
const errorText = document.getElementById('errorText');

// Pagination state
let currentPage = 1;
let currentQuery = '';
let currentLimit = 20;
let pagination = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    searchButton.addEventListener('click', () => performSearch(1));
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch(1);
        }
    });
    
    rowsPerPageSelect.addEventListener('change', function() {
        currentLimit = parseInt(this.value);
        if (currentQuery) {
            performSearch(1);
        }
    });
    
    stockFilterCheckbox.addEventListener('change', function() {
        if (currentQuery) {
            performSearch(1);
        }
    });
    
    prevPageBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (pagination && pagination.hasPrev) {
            performSearch(currentPage - 1);
        }
    });
    
    nextPageBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (pagination && pagination.hasNext) {
            performSearch(currentPage + 1);
        }
    });
});

// Main search function
function performSearch(page = 1) {
    const query = searchInput.value.trim();
    
    if (!query) {
        showError('Por favor, ingrese un término de búsqueda');
        return;
    }

    currentQuery = query;
    currentPage = page;
    currentLimit = parseInt(rowsPerPageSelect.value);
    const onlyWithStock = stockFilterCheckbox.checked;

    showLoading();
    
    let url = `${API_BASE_URL}/articles?search=${encodeURIComponent(query)}&page=${page}&limit=${currentLimit}`;
    if (onlyWithStock) {
        url += '&onlyWithStock=true';
    }
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            hideLoading();
            displayResults(data);
        })
        .catch(error => {
            hideLoading();
            console.error('Error:', error);
            showError('Error al conectar con el servidor. Verifique que la API esté ejecutándose en http://localhost:3000');
        });
}

// Display search results
function displayResults(response) {
    // Handle both old format (array) and new format (object with data and pagination)
    const articles = response.data || response;
    pagination = response.pagination || null;
    const meta = response.meta || null;

    if (!articles || articles.length === 0) {
        showNoResults();
        return;
    }

    hideAllMessages();
    
    // Update pagination info
    if (pagination) {
        updatePaginationInfo(pagination, meta);
        showPaginationControls();
    } else {
        hidePaginationControls();
    }
    
    const html = articles.map(article => createArticleCard(article)).join('');
    resultsContainer.innerHTML = html;
}

// Create HTML card for a single article
function createArticleCard(article) {
    const {
        id,
        descripcion,
        marca,
        rubro,
        nota,
        precio,
        stock,
        aplicaciones = [],
        complementarios = [],
        sustitutos = []
    } = article;

    const priceFormatted = precio ? formatPrice(precio) : 'No disponible';
    const stockClass = stock === null ? '' : (stock <= 0 ? 'stock-zero' : 'stock-positive');
    const stockText = stock === null ? 'No disponible' : stock;

    return `
        <div class="article-card card">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <h5 class="card-title">
                            <i class="fas fa-cog"></i> ${id} - ${descripcion || 'Sin descripción'}
                        </h5>
                        <div class="mb-2">
                            ${marca ? `<span class="badge bg-secondary me-2"><i class="fas fa-tag"></i> ${marca}</span>` : ''}
                            ${rubro ? `<span class="badge bg-info"><i class="fas fa-folder"></i> ${rubro}</span>` : ''}
                        </div>
                        ${nota ? `<div class="alert alert-info py-2 mb-2"><i class="fas fa-comment"></i> ${nota}</div>` : ''}
                    </div>
                    <div class="col-md-4 text-md-end">
                        <div class="price mb-2">
                            <i class="fas fa-dollar-sign"></i> ${priceFormatted}
                        </div>
                        <div class="${stockClass}">
                            <i class="fas fa-boxes"></i> Stock: ${stockText}
                        </div>
                    </div>
                </div>

                ${aplicaciones.length > 0 ? createAplicacionesSection(aplicaciones) : ''}

                ${complementarios.length > 0 || sustitutos.length > 0 ? `
                    <div class="mt-3">
                        ${complementarios.length > 0 ? createRelatedArticlesSection('Complementarios', complementarios, 'complementario') : ''}
                        ${sustitutos.length > 0 ? createRelatedArticlesSection('Sustitutos', sustitutos, 'sustituto') : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Create aplicaciones section with collapsible functionality
function createAplicacionesSection(aplicaciones) {
    const aplicacionesId = `aplicaciones-${Math.random().toString(36).substr(2, 9)}`;
    
    return `
        <div class="mt-3">
            <button class="btn btn-outline-primary btn-sm" 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#${aplicacionesId}" 
                    aria-expanded="false">
                <i class="fas fa-car"></i> Aplicaciones (${aplicaciones.length})
                <i class="fas fa-chevron-down ms-1"></i>
            </button>
            <div class="collapse" id="${aplicacionesId}">
                <div class="aplicaciones-list">
                    ${aplicaciones.map(app => `
                        <div class="mb-2">
                            <strong>${app.aplicacion || 'Sin especificar'}</strong>
                            ${app.desde || app.hasta ? `
                                <small class="text-muted">
                                    (${app.desde ? formatDate(app.desde) : ''} - ${app.hasta ? formatDate(app.hasta) : ''})
                                </small>
                            ` : ''}
                            ${app.nota ? `<br><small class="text-info"><i class="fas fa-info-circle"></i> ${app.nota}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Create related articles section (complementarios/sustitutos) with full details
function createRelatedArticlesSection(title, articles, type) {
    const sectionId = `${type}-${Math.random().toString(36).substr(2, 9)}`;
    const iconClass = type === 'complementario' ? 'fas fa-plus-circle' : 'fas fa-exchange-alt';
    
    return `
        <div class="mt-3">
            <button class="btn btn-outline-secondary btn-sm" 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#${sectionId}" 
                    aria-expanded="false">
                <i class="${iconClass}"></i> ${title} (${articles.length})
                <i class="fas fa-chevron-down ms-1"></i>
            </button>
            <div class="collapse" id="${sectionId}">
                <div class="related-articles-list mt-2">
                    ${articles.map(article => createRelatedArticleCard(article, type)).join('')}
                </div>
            </div>
        </div>
    `;
}

// Create individual related article card
function createRelatedArticleCard(article, type) {
    // Handle both new format (object with details) and old format (just ID)
    if (typeof article === 'object' && article.descripcion) {
        const priceFormatted = article.precio ? formatPrice(article.precio) : 'No disponible';
        const stockClass = article.stock === null ? '' : (article.stock <= 0 ? 'stock-zero' : 'stock-positive');
        const stockText = article.stock === null ? 'No disponible' : article.stock;
        
        return `
            <div class="card mb-2 border-${type === 'complementario' ? 'primary' : 'secondary'}">
                <div class="card-body p-2">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <h6 class="mb-1">
                                <i class="fas fa-cog"></i> ${article.id} - ${article.descripcion}
                            </h6>
                            ${article.marca ? `<span class="badge bg-secondary"><i class="fas fa-tag"></i> ${article.marca}</span>` : ''}
                        </div>
                        <div class="col-md-3 text-center">
                            <small class="text-muted">Precio:</small><br>
                            <span class="price">${priceFormatted}</span>
                        </div>
                        <div class="col-md-3 text-center">
                            <small class="text-muted">Stock:</small><br>
                            <span class="${stockClass}">${stockText}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Fallback for old format (just ID)
        const articleId = typeof article === 'object' ? article.id : article;
        return `<span class="badge badge-${type} me-1">${articleId}</span>`;
    }
}

// Utility functions
function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(price);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.getFullYear().toString();
}

function showLoading() {
    hideAllMessages();
    loadingSpinner.style.display = 'block';
    resultsContainer.innerHTML = '';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showNoResults() {
    hideAllMessages();
    hidePaginationControls();
    noResults.style.display = 'block';
    resultsContainer.innerHTML = '';
}

function showError(message) {
    hideAllMessages();
    hidePaginationControls();
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    resultsContainer.innerHTML = '';
}

function hideAllMessages() {
    loadingSpinner.style.display = 'none';
    noResults.style.display = 'none';
    errorMessage.style.display = 'none';
}

// Pagination functions
function updatePaginationInfo(paginationData, metaData) {
    totalCountSpan.textContent = paginationData.total.toLocaleString();
    currentPageSpan.textContent = paginationData.page;
    totalPagesSpan.textContent = paginationData.totalPages;
    
    // Update query time if available
    if (metaData && metaData.queryTime) {
        queryTimeSpan.textContent = metaData.queryTime;
    } else {
        queryTimeSpan.textContent = '-';
    }
    
    // Update button states
    if (paginationData.hasPrev) {
        prevPageBtn.classList.remove('disabled');
    } else {
        prevPageBtn.classList.add('disabled');
    }
    
    if (paginationData.hasNext) {
        nextPageBtn.classList.remove('disabled');
    } else {
        nextPageBtn.classList.add('disabled');
    }
}

function showPaginationControls() {
    resultsInfo.style.display = 'block';
    paginationContainer.style.display = 'block';
}

function hidePaginationControls() {
    resultsInfo.style.display = 'none';
    paginationContainer.style.display = 'none';
} 