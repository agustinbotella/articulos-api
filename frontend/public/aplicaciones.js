// API Configuration
const API_BASE_URL = 'http://192.168.1.106:3000';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const showAllButton = document.getElementById('showAllButton');
const resultsContainer = document.getElementById('resultsContainer');
const resultsInfo = document.querySelector('.results-info');
const totalCountSpan = document.getElementById('totalCount');
const queryTimeSpan = document.getElementById('queryTime');
const loadingSpinner = document.querySelector('.loading-spinner');
const noResults = document.querySelector('.no-results');
const errorMessage = document.querySelector('.error-message');
const errorText = document.getElementById('errorText');

// Current search state
let currentQuery = '';

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    searchButton.addEventListener('click', () => performSearch());
    showAllButton.addEventListener('click', () => showAllApplications());
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Load all applications on page load
    showAllApplications();
});

// Main search function
function performSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        showAllApplications();
        return;
    }

    currentQuery = query;
    searchApplications(query);
}

// Show all applications
function showAllApplications() {
    currentQuery = '';
    searchInput.value = '';
    searchApplications('');
}

// Search applications function
function searchApplications(query) {
    showLoading();
    
    let url = `${API_BASE_URL}/aplicaciones`;
    if (query) {
        url += `?search=${encodeURIComponent(query)}`;
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
            showError('Error al conectar con el servidor. Verifique que la API esté ejecutándose en http://192.168.1.106:3000');
        });
}

// Display search results
function displayResults(response) {
    const aplicaciones = response.data || [];
    const meta = response.meta || null;

    if (!aplicaciones || aplicaciones.length === 0) {
        showNoResults();
        return;
    }

    hideAllMessages();
    
    // Update results info
    updateResultsInfo(aplicaciones.length, meta);
    
    // Group applications by hierarchy level
    const groupedApplications = groupByHierarchy(aplicaciones);
    
    const html = createApplicationsHTML(groupedApplications);
    resultsContainer.innerHTML = html;
    
    // Show results info
    resultsInfo.style.display = 'block';
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
    
    return `
        <div class="aplicacion-card card" onclick="selectApplication(${app.id}, '${app.aplicacion.replace(/'/g, "\\'")}')">
            <div class="card-body py-2">
                <div class="${hierarchyClass}">
                    <i class="${iconClass}"></i>
                    ${app.displayText}
                    <span class="aplicacion-id">ID: ${app.id}</span>
                </div>
                ${app.nota ? `<small class="text-muted ms-3"><i class="fas fa-info-circle"></i> ${app.nota}</small>` : ''}
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
    
    // Future enhancement: could redirect to articles that use this application
    // window.location.href = `index.html?aplicacion=${encodeURIComponent(id)}`;
}

// Update results info
function updateResultsInfo(count, meta) {
    totalCountSpan.textContent = count.toLocaleString();
    
    if (meta && meta.queryTime) {
        queryTimeSpan.textContent = meta.queryTime;
    } else {
        queryTimeSpan.textContent = '-';
    }
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
}

function showError(message) {
    hideAllMessages();
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    resultsContainer.innerHTML = '';
    resultsInfo.style.display = 'none';
}

function hideAllMessages() {
    loadingSpinner.style.display = 'none';
    noResults.style.display = 'none';
    errorMessage.style.display = 'none';
} 