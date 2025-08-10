// API Configuration
const API_BASE_URL = '/api'; // Use local proxy instead of direct API

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('resultsContainer');
const resultsInfo = document.getElementById('resultsInfo');
const totalCountSpan = document.getElementById('totalCount');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const queryTimeSpan = document.getElementById('queryTime');
const paginationControls = document.getElementById('paginationControls');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const loadingSpinner = document.querySelector('.loading-spinner');
const noResults = document.querySelector('.no-results');
const errorMessage = document.querySelector('.error-message');
const errorText = document.getElementById('errorText');

// Current search state
let currentQuery = '';
let currentPage = 1;
let pagination = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    searchButton.addEventListener('click', () => performSearch(1));
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch(1);
        }
    });
    
    prevPageBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1 && currentQuery) {
            performSearch(currentPage - 1);
        }
    });
    
    nextPageBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (pagination && currentPage < pagination.totalPages && currentQuery) {
            performSearch(currentPage + 1);
        }
    });
    
    // Show initial empty state with instructions
    showInitialState();
});

// Main search function
function performSearch(page = 1) {
    const query = searchInput.value.trim();
    
    if (!query) {
        showEmptySearch();
        return;
    }

    currentQuery = query;
    currentPage = page;
    searchApplications(query, page);
}

// Show empty search message
function showEmptySearch() {
    hideAllMessages();
    resultsContainer.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-search text-muted" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <h4 class="text-muted">Ingrese un término de búsqueda</h4>
            <p class="text-muted">Escriba el nombre de una marca, modelo o especificación para buscar aplicaciones.</p>
        </div>
    `;
    hidePaginationControls();
    resultsInfo.style.display = 'none';
}

// Show initial state
function showInitialState() {
    hideAllMessages();
    resultsContainer.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-car text-success" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <h4 class="text-success">Buscador de Aplicaciones</h4>
            <p class="text-muted">Utilice el campo de búsqueda para encontrar aplicaciones específicas.</p>
            <p class="text-muted"><strong>Ejemplos:</strong> "chevrolet", "motor ford", "corsa 1.4"</p>
        </div>
    `;
    hidePaginationControls();
    resultsInfo.style.display = 'none';
    currentQuery = '';
    currentPage = 1;
}

// Search applications function
function searchApplications(query, page = 1) {
    showLoading();
    
    let url = `${API_BASE_URL}/aplicaciones?page=${page}&limit=20`;
    if (query) {
        url += `&search=${encodeURIComponent(query)}`;
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
            if (error.message.includes('400')) {
                showEmptySearch();
            } else {
                showError('Error al conectar con el servidor. Verifique que la API esté ejecutándose en http://192.168.1.106:3000');
            }
        });
}

// Display search results
function displayResults(response) {
    const aplicaciones = response.data || [];
    const paginationData = response.pagination || null;
    const meta = response.meta || null;

    pagination = paginationData;

    if (!aplicaciones || aplicaciones.length === 0) {
        showNoResults();
        hidePaginationControls();
        return;
    }

    hideAllMessages();
    
    // Update results info and pagination
    updateResultsInfo(paginationData, meta);
    updatePaginationControls(paginationData);
    
    // Group applications by hierarchy level
    const groupedApplications = groupByHierarchy(aplicaciones);
    
    const html = createApplicationsHTML(groupedApplications);
    resultsContainer.innerHTML = html;
    
    // Show results info and pagination
    resultsInfo.style.display = 'block';
    if (paginationData && paginationData.totalPages > 1) {
        paginationControls.style.display = 'block';
    }
}

// Group applications by hierarchy level for better organization
function groupByHierarchy(aplicaciones) {
    return aplicaciones.map(app => {
        const parts = app.aplicacion.split(' -> ');
        const level = Math.min(parts.length - 1, 4); // Max 5 levels (0-4)
        
        return {
            ...app,
            level: level,
            parts: parts,
            displayText: app.aplicacion
        };
    });
}

// Create HTML for applications
function createApplicationsHTML(aplicaciones) {
    return aplicaciones.map(app => createApplicationCard(app)).join('');
}

// Create individual application card
function createApplicationCard(app) {
    const hierarchyClass = `hierarchy-level-${app.level}`;
    const iconClass = getIconForLevel(app.level);
    
    // Create notes section
    let notesSection = '';
    if (app.nota || app.artAplicacionNota) {
        const notes = [];
        if (app.nota) {
            notes.push(`<div class="note-item"><i class="fas fa-info-circle text-info"></i> <strong>Aplicación:</strong> ${app.nota}</div>`);
        }
        if (app.artAplicacionNota) {
            notes.push(`<div class="note-item"><i class="fas fa-sticky-note text-warning"></i> <strong>Artículo:</strong> ${app.artAplicacionNota}</div>`);
        }
        notesSection = `<div class="notes-section">${notes.join('')}</div>`;
    }
    
    // Add article count badge and action buttons
    const articleCountBadge = `
        <span class="badge bg-info text-dark ms-2">
            <i class="fas fa-cog"></i> ${app.articleCount || 0} artículos
        </span>
    `;
    
    const actionButtons = `
        <div class="mt-2 d-flex justify-content-between align-items-center">
            <div>
                ${app.articleCount > 0 ? `<small class="text-muted"><i class="fas fa-info-circle"></i> ${app.articleCount} artículo(s) disponible(s)</small>` : '<small class="text-muted"><i class="fas fa-exclamation-triangle"></i> Sin artículos</small>'}
            </div>
            <button class="btn btn-primary btn-sm ${app.articleCount === 0 ? 'disabled' : ''}" 
                    onclick="searchArticlesForApplication(${app.id}); event.stopPropagation();"
                    ${app.articleCount === 0 ? 'title="No hay artículos para esta aplicación"' : ''}>
                <i class="fas fa-search"></i> Buscar Artículos
            </button>
        </div>
    `;
    
    return `
        <div class="aplicacion-card card" onclick="selectApplication(${app.id}, '${app.aplicacion.replace(/'/g, "\\'")}')">
            <div class="card-body py-2">
                <div class="${hierarchyClass}">
                    <i class="${iconClass}"></i>
                    ${app.displayText}
                    <span class="aplicacion-id">ID: ${app.id}</span>
                    ${articleCountBadge}
                </div>
                ${notesSection}
                ${actionButtons}
            </div>
        </div>
    `;
}

// Get icon based on hierarchy level
function getIconForLevel(level) {
    switch(level) {
        case 0: return 'fas fa-folder';
        case 1: return 'fas fa-folder-open';
        case 2: return 'fas fa-car';
        case 3: return 'fas fa-cog';
        default: return 'fas fa-wrench';
    }
}

// Handle application selection
function selectApplication(id, aplicacion) {
    // You can add functionality here to do something with the selected application
    console.log('Selected application:', { id, aplicacion });
    
    // For now, just show an alert
    alert(`Aplicación seleccionada:\nID: ${id}\nDescripción: ${aplicacion}`);
}

// Search articles for a specific application
function searchArticlesForApplication(applicationId) {
    // Redirect to articles page with the application ID prepopulated
    window.location.href = `articles.html?applicationId=${applicationId}`;
}

// Update results info
function updateResultsInfo(paginationData, meta) {
    if (paginationData) {
        totalCountSpan.textContent = paginationData.totalCount.toLocaleString();
        currentPageSpan.textContent = paginationData.currentPage;
        totalPagesSpan.textContent = paginationData.totalPages;
    } else {
        totalCountSpan.textContent = '0';
        currentPageSpan.textContent = '1';
        totalPagesSpan.textContent = '1';
    }
    
    if (meta && meta.queryTime) {
        queryTimeSpan.textContent = meta.queryTime;
    } else {
        queryTimeSpan.textContent = '-';
    }
}

// Update pagination controls
function updatePaginationControls(paginationData) {
    if (!paginationData) {
        hidePaginationControls();
        return;
    }
    
    // Update button states
    prevPageBtn.disabled = !paginationData.hasPreviousPage;
    nextPageBtn.disabled = !paginationData.hasNextPage;
    
    // Show pagination if more than one page
    if (paginationData.totalPages > 1) {
        paginationControls.style.display = 'block';
    } else {
        paginationControls.style.display = 'none';
    }
}

// Hide pagination controls
function hidePaginationControls() {
    paginationControls.style.display = 'none';
}

// UI State Functions
function showLoading() {
    hideAllMessages();
    loadingSpinner.style.display = 'block';
    resultsContainer.innerHTML = '';
    resultsInfo.style.display = 'none';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showNoResults() {
    hideAllMessages();
    noResults.style.display = 'block';
    resultsContainer.innerHTML = '';
    resultsInfo.style.display = 'none';
    hidePaginationControls();
}

function showError(message) {
    hideAllMessages();
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    resultsContainer.innerHTML = '';
    resultsInfo.style.display = 'none';
    hidePaginationControls();
}

function hideAllMessages() {
    loadingSpinner.style.display = 'none';
    noResults.style.display = 'none';
    errorMessage.style.display = 'none';
} 