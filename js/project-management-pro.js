/**
 * Enhanced Project Management Features
 * Comprehensive project dashboard with estimates, specs, proposals, team, and resources
 */

class ProjectManagementPro {
    constructor() {
        this.currentProject = null;
        this.projectData = {};
        this.estimates = [];
        this.specifications = [];
        this.proposals = [];
        this.blueprints = [];
        this.team = [];
        this.resources = [];
    }

    async initialize() {
        this.enhanceProjectPage();
        await this.loadProjects();
        this.setupEventHandlers();
    }

    enhanceProjectPage() {
        // Find the main projects container
        const projectsContainer = document.querySelector('.projects-container') || 
                                 document.querySelector('#projects-list') || 
                                 document.querySelector('main');
        
        if (!projectsContainer) return;

        // Add enhanced header
        const enhancedHeader = document.createElement('div');
        enhancedHeader.className = 'project-header-enhanced';
        enhancedHeader.innerHTML = `
            <div class="header-row">
                <h1>Project Management Professional</h1>
                <div class="header-actions">
                    <button class="btn-primary" onclick="projectManager.createNewProject()">
                        <span>➕</span> New Project
                    </button>
                    <button class="btn-secondary" onclick="projectManager.refreshProjects()">
                        <span>🔄</span> Refresh
                    </button>
                    <button class="btn-secondary" onclick="projectManager.showDashboard()">
                        <span>📊</span> Dashboard
                    </button>
                </div>
            </div>
            <div class="filter-row">
                <input type="text" id="projectSearch" placeholder="Search projects..." class="search-input">
                <select id="projectFilter" class="filter-select">
                    <option value="all">All Projects</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                </select>
                <select id="projectSort" class="sort-select">
                    <option value="date">Sort by Date</option>
                    <option value="name">Sort by Name</option>
                    <option value="value">Sort by Value</option>
                    <option value="status">Sort by Status</option>
                </select>
            </div>
        `;

        // Insert at the beginning of container
        projectsContainer.insertBefore(enhancedHeader, projectsContainer.firstChild);

        // Create enhanced project cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.id = 'enhanced-projects-container';
        cardsContainer.className = 'projects-grid';
        projectsContainer.appendChild(cardsContainer);

        // Add styles
        this.injectStyles();
    }

    injectStyles() {
        const styles = `
            <style>
                /* Enhanced Project Management Styles */
                .project-header-enhanced {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    margin: -20px -20px 30px -20px;
                    border-radius: 0 0 20px 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }

                .header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .header-row h1 {
                    font-size: 32px;
                    margin: 0;
                    font-weight: 700;
                }

                .header-actions {
                    display: flex;
                    gap: 10px;
                }

                .btn-primary, .btn-secondary {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                }

                .btn-primary {
                    background: #ffc107;
                    color: #333;
                }

                .btn-primary:hover {
                    background: #ffb000;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(255,193,7,0.4);
                }

                .btn-secondary {
                    background: rgba(255,255,255,0.2);
                    color: white;
                    backdrop-filter: blur(10px);
                }

                .btn-secondary:hover {
                    background: rgba(255,255,255,0.3);
                    transform: translateY(-2px);
                }

                .filter-row {
                    display: flex;
                    gap: 15px;
                }

                .search-input, .filter-select, .sort-select {
                    padding: 10px 15px;
                    border: 1px solid rgba(255,255,255,0.3);
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border-radius: 8px;
                    font-size: 15px;
                    backdrop-filter: blur(10px);
                }

                .search-input {
                    flex: 1;
                }

                .search-input::placeholder {
                    color: rgba(255,255,255,0.7);
                }

                .filter-select option, .sort-select option {
                    background: #333;
                    color: white;
                }

                /* Projects Grid */
                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                    gap: 25px;
                    padding: 20px;
                    animation: fadeIn 0.5s ease;
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Enhanced Project Card */
                .project-card-enhanced {
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    overflow: hidden;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }

                .project-card-enhanced:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }

                .project-card-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    position: relative;
                }

                .project-status-badge {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    padding: 5px 12px;
                    background: rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-active { background: #4caf50 !important; }
                .status-pending { background: #ff9800 !important; }
                .status-completed { background: #2196f3 !important; }

                .project-card-title {
                    font-size: 22px;
                    font-weight: 700;
                    margin: 0 0 5px 0;
                }

                .project-card-client {
                    font-size: 14px;
                    opacity: 0.9;
                }

                .project-card-body {
                    padding: 20px;
                }

                .project-quick-stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .stat-item {
                    padding: 12px;
                    background: #f5f5f5;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .stat-icon {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 20px;
                }

                .stat-content {
                    flex: 1;
                }

                .stat-label {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 2px;
                }

                .stat-value {
                    font-size: 18px;
                    font-weight: 700;
                    color: #333;
                }

                .project-actions {
                    display: flex;
                    gap: 10px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                }

                .action-btn {
                    flex: 1;
                    padding: 10px;
                    border: none;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }

                .action-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102,126,234,0.4);
                }

                .action-btn.secondary {
                    background: #f5f5f5;
                    color: #333;
                }

                .action-btn.secondary:hover {
                    background: #e0e0e0;
                    box-shadow: none;
                }

                /* Project Detail Modal */
                .project-detail-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }

                .modal-content {
                    background: white;
                    width: 90%;
                    max-width: 1200px;
                    max-height: 90vh;
                    border-radius: 20px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(50px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                .modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 24px;
                }

                .modal-close {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    font-size: 20px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .modal-close:hover {
                    background: rgba(255,255,255,0.3);
                    transform: rotate(90deg);
                }

                .modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 25px;
                }

                .detail-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 25px;
                    border-bottom: 2px solid #eee;
                    padding-bottom: 10px;
                }

                .tab-btn {
                    padding: 10px 20px;
                    background: transparent;
                    border: none;
                    color: #666;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .tab-btn:hover {
                    color: #333;
                }

                .tab-btn.active {
                    color: #667eea;
                }

                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -12px;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }

                .tab-content {
                    display: none;
                }

                .tab-content.active {
                    display: block;
                    animation: fadeIn 0.3s ease;
                }

                /* Estimates List */
                .estimates-list {
                    display: grid;
                    gap: 15px;
                }

                .estimate-item {
                    padding: 20px;
                    background: #f9f9f9;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.3s ease;
                }

                .estimate-item:hover {
                    background: #f0f0f0;
                    transform: translateX(5px);
                }

                .estimate-info {
                    flex: 1;
                }

                .estimate-number {
                    font-size: 18px;
                    font-weight: 700;
                    color: #333;
                    margin-bottom: 5px;
                }

                .estimate-date {
                    font-size: 14px;
                    color: #666;
                }

                .estimate-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #4caf50;
                }

                /* Team List */
                .team-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 20px;
                }

                .team-member {
                    padding: 20px;
                    background: #f9f9f9;
                    border-radius: 10px;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .team-member:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }

                .member-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 32px;
                    font-weight: 700;
                    margin: 0 auto 15px;
                }

                .member-name {
                    font-size: 18px;
                    font-weight: 700;
                    color: #333;
                    margin-bottom: 5px;
                }

                .member-role {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 10px;
                }

                .member-contact {
                    font-size: 13px;
                    color: #667eea;
                }

                /* Resources Table */
                .resources-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .resources-table th {
                    background: #f5f5f5;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 2px solid #ddd;
                }

                .resources-table td {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                }

                .resources-table tr:hover {
                    background: #f9f9f9;
                }

                .resource-status {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                }

                .status-available {
                    background: #e8f5e9;
                    color: #4caf50;
                }

                .status-allocated {
                    background: #fff3e0;
                    color: #ff9800;
                }

                .status-unavailable {
                    background: #ffebee;
                    color: #f44336;
                }

                /* Dashboard View */
                .dashboard-container {
                    padding: 20px;
                }

                .dashboard-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .dashboard-stat-card {
                    padding: 25px;
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .dashboard-stat-icon {
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 28px;
                }

                .dashboard-stat-content {
                    flex: 1;
                }

                .dashboard-stat-label {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 5px;
                }

                .dashboard-stat-value {
                    font-size: 32px;
                    font-weight: 700;
                    color: #333;
                }

                /* Blueprint Viewer */
                .blueprint-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                }

                .blueprint-item {
                    background: #f9f9f9;
                    border-radius: 10px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .blueprint-item:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.15);
                }

                .blueprint-preview {
                    height: 150px;
                    background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #999;
                    font-size: 48px;
                }

                .blueprint-info {
                    padding: 12px;
                }

                .blueprint-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 3px;
                }

                .blueprint-date {
                    font-size: 12px;
                    color: #666;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    async loadProjects() {
        const container = document.getElementById('enhanced-projects-container');
        if (!container) return;

        container.innerHTML = '<div style="text-align: center; padding: 40px;">Loading projects...</div>';

        try {
            // Load projects from Azure Blob Storage
            const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/&delimiter=/`;
            
            const response = await fetch(listUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
                
                container.innerHTML = '';
                
                for (let i = 0; i < prefixes.length; i++) {
                    const nameElement = prefixes[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const pathParts = fullPath.split('/');
                        
                        if (pathParts.length >= 2 && pathParts[0] === 'FCS-OriginalClients') {
                            const projectName = pathParts[1];
                            
                            if (projectName && !projectName.startsWith('.') && !projectName.includes('$')) {
                                await this.createProjectCard(container, projectName);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: red;">Error loading projects</div>';
        }
    }

    async createProjectCard(container, projectName) {
        // Generate random demo data for now
        const status = ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)];
        const estimateCount = Math.floor(Math.random() * 5) + 1;
        const teamCount = Math.floor(Math.random() * 8) + 3;
        const progress = Math.floor(Math.random() * 100);
        const value = Math.floor(Math.random() * 900000) + 100000;

        const card = document.createElement('div');
        card.className = 'project-card-enhanced';
        card.innerHTML = `
            <div class="project-card-header">
                <span class="project-status-badge status-${status}">${status}</span>
                <div class="project-card-title">${projectName}</div>
                <div class="project-card-client">Client Project</div>
            </div>
            <div class="project-card-body">
                <div class="project-quick-stats">
                    <div class="stat-item">
                        <div class="stat-icon">📊</div>
                        <div class="stat-content">
                            <div class="stat-label">Estimates</div>
                            <div class="stat-value">${estimateCount}</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon">👥</div>
                        <div class="stat-content">
                            <div class="stat-label">Team Members</div>
                            <div class="stat-value">${teamCount}</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon">📈</div>
                        <div class="stat-content">
                            <div class="stat-label">Progress</div>
                            <div class="stat-value">${progress}%</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon">💰</div>
                        <div class="stat-content">
                            <div class="stat-label">Project Value</div>
                            <div class="stat-value">$${(value/1000).toFixed(0)}K</div>
                        </div>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="action-btn" onclick="projectManager.viewProjectDetails('${projectName}')">
                        <span>📋</span> View Details
                    </button>
                    <button class="action-btn secondary" onclick="projectManager.viewBlueprints('${projectName}')">
                        <span>📐</span> Blueprints
                    </button>
                    <button class="action-btn secondary" onclick="projectManager.viewTeam('${projectName}')">
                        <span>👥</span> Team
                    </button>
                </div>
            </div>
        `;

        container.appendChild(card);

        // Store project data
        this.projectData[projectName] = {
            status,
            estimateCount,
            teamCount,
            progress,
            value
        };
    }

    viewProjectDetails(projectName) {
        const modal = document.createElement('div');
        modal.className = 'project-detail-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${projectName} - Project Details</h2>
                    <button class="modal-close" onclick="this.closest('.project-detail-modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="detail-tabs">
                        <button class="tab-btn active" onclick="projectManager.switchTab(event, 'overview')">Overview</button>
                        <button class="tab-btn" onclick="projectManager.switchTab(event, 'estimates')">Estimates</button>
                        <button class="tab-btn" onclick="projectManager.switchTab(event, 'specifications')">Specifications</button>
                        <button class="tab-btn" onclick="projectManager.switchTab(event, 'proposals')">Proposals</button>
                        <button class="tab-btn" onclick="projectManager.switchTab(event, 'team')">Team</button>
                        <button class="tab-btn" onclick="projectManager.switchTab(event, 'resources')">Resources</button>
                        <button class="tab-btn" onclick="projectManager.switchTab(event, 'blueprints')">Blueprints</button>
                    </div>
                    
                    <!-- Overview Tab -->
                    <div id="overview" class="tab-content active">
                        <h3>Project Overview</h3>
                        <div class="dashboard-stats">
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">📊</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Total Estimates</div>
                                    <div class="dashboard-stat-value">${this.projectData[projectName]?.estimateCount || 0}</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">💰</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Project Value</div>
                                    <div class="dashboard-stat-value">$${((this.projectData[projectName]?.value || 0)/1000).toFixed(0)}K</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">📈</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Progress</div>
                                    <div class="dashboard-stat-value">${this.projectData[projectName]?.progress || 0}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Estimates Tab -->
                    <div id="estimates" class="tab-content">
                        <h3>Project Estimates</h3>
                        <div class="estimates-list" id="estimatesList">
                            ${this.generateEstimatesList(projectName)}
                        </div>
                    </div>
                    
                    <!-- Specifications Tab -->
                    <div id="specifications" class="tab-content">
                        <h3>Project Specifications</h3>
                        <div class="estimates-list">
                            <div class="estimate-item">
                                <div class="estimate-info">
                                    <div class="estimate-number">Structural Specifications</div>
                                    <div class="estimate-date">Updated: ${new Date().toLocaleDateString()}</div>
                                </div>
                                <button class="action-btn" onclick="alert('Opening structural specifications...')">View</button>
                            </div>
                            <div class="estimate-item">
                                <div class="estimate-info">
                                    <div class="estimate-number">Electrical Specifications</div>
                                    <div class="estimate-date">Updated: ${new Date().toLocaleDateString()}</div>
                                </div>
                                <button class="action-btn" onclick="alert('Opening electrical specifications...')">View</button>
                            </div>
                            <div class="estimate-item">
                                <div class="estimate-info">
                                    <div class="estimate-number">Plumbing Specifications</div>
                                    <div class="estimate-date">Updated: ${new Date().toLocaleDateString()}</div>
                                </div>
                                <button class="action-btn" onclick="alert('Opening plumbing specifications...')">View</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Proposals Tab -->
                    <div id="proposals" class="tab-content">
                        <h3>Project Proposals</h3>
                        <div class="estimates-list">
                            <div class="estimate-item">
                                <div class="estimate-info">
                                    <div class="estimate-number">Initial Project Proposal</div>
                                    <div class="estimate-date">Submitted: ${new Date(Date.now() - 30*24*60*60*1000).toLocaleDateString()}</div>
                                </div>
                                <div class="estimate-value">Accepted</div>
                            </div>
                            <div class="estimate-item">
                                <div class="estimate-info">
                                    <div class="estimate-number">Change Order #1</div>
                                    <div class="estimate-date">Submitted: ${new Date(Date.now() - 7*24*60*60*1000).toLocaleDateString()}</div>
                                </div>
                                <div class="estimate-value">Pending</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Team Tab -->
                    <div id="team" class="tab-content">
                        <h3>Project Team</h3>
                        <div class="team-grid">
                            ${this.generateTeamMembers(projectName)}
                        </div>
                    </div>
                    
                    <!-- Resources Tab -->
                    <div id="resources" class="tab-content">
                        <h3>Resource Budget</h3>
                        <table class="resources-table">
                            <thead>
                                <tr>
                                    <th>Resource</th>
                                    <th>Category</th>
                                    <th>Allocated</th>
                                    <th>Used</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Concrete (yards)</td>
                                    <td>Materials</td>
                                    <td>500</td>
                                    <td>320</td>
                                    <td><span class="resource-status status-allocated">In Progress</span></td>
                                </tr>
                                <tr>
                                    <td>Steel Beams</td>
                                    <td>Materials</td>
                                    <td>200</td>
                                    <td>150</td>
                                    <td><span class="resource-status status-allocated">In Progress</span></td>
                                </tr>
                                <tr>
                                    <td>Labor Hours</td>
                                    <td>Personnel</td>
                                    <td>5000</td>
                                    <td>3200</td>
                                    <td><span class="resource-status status-available">On Track</span></td>
                                </tr>
                                <tr>
                                    <td>Crane Rental</td>
                                    <td>Equipment</td>
                                    <td>30 days</td>
                                    <td>18 days</td>
                                    <td><span class="resource-status status-allocated">Active</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Blueprints Tab -->
                    <div id="blueprints" class="tab-content">
                        <h3>Blueprint Takeoff Data</h3>
                        <div class="blueprint-grid">
                            <div class="blueprint-item" onclick="projectManager.openTakeoffViewer('${projectName}', 'floor-plan')">
                                <div class="blueprint-preview">📐</div>
                                <div class="blueprint-info">
                                    <div class="blueprint-name">Floor Plan - Level 1</div>
                                    <div class="blueprint-date">Total Area: 5,200 sq ft</div>
                                </div>
                            </div>
                            <div class="blueprint-item" onclick="projectManager.openTakeoffViewer('${projectName}', 'electrical')">
                                <div class="blueprint-preview">⚡</div>
                                <div class="blueprint-info">
                                    <div class="blueprint-name">Electrical Layout</div>
                                    <div class="blueprint-date">Outlets: 45, Fixtures: 28</div>
                                </div>
                            </div>
                            <div class="blueprint-item" onclick="projectManager.openTakeoffViewer('${projectName}', 'plumbing')">
                                <div class="blueprint-preview">🔧</div>
                                <div class="blueprint-info">
                                    <div class="blueprint-name">Plumbing System</div>
                                    <div class="blueprint-date">Fixtures: 18, Pipes: 320ft</div>
                                </div>
                            </div>
                            <div class="blueprint-item" onclick="projectManager.openTakeoffViewer('${projectName}', 'hvac')">
                                <div class="blueprint-preview">🌡️</div>
                                <div class="blueprint-info">
                                    <div class="blueprint-name">HVAC Design</div>
                                    <div class="blueprint-date">Units: 4, Ducts: 450ft</div>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 20px; padding: 15px; background: #f0f7ff; border-radius: 8px;">
                            <p style="margin: 0; color: #0066cc;">
                                <strong>Note:</strong> This is read-only takeoff data. To perform new measurements or annotations, 
                                please use the Digital Takeoff Assistant from the Estimator page.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    generateEstimatesList(projectName) {
        let html = '';
        const count = this.projectData[projectName]?.estimateCount || 3;
        
        for (let i = 1; i <= count; i++) {
            const value = Math.floor(Math.random() * 50000) + 10000;
            const date = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
            
            html += `
                <div class="estimate-item">
                    <div class="estimate-info">
                        <div class="estimate-number">EST-2024-${String(i).padStart(3, '0')}</div>
                        <div class="estimate-date">Created: ${date.toLocaleDateString()}</div>
                    </div>
                    <div class="estimate-value">$${value.toLocaleString()}</div>
                </div>
            `;
        }
        
        return html;
    }

    generateTeamMembers(projectName) {
        const roles = ['Project Manager', 'Site Supervisor', 'Foreman', 'Safety Officer', 'Quality Inspector', 'Engineer'];
        const names = ['John Smith', 'Sarah Johnson', 'Mike Davis', 'Emily Brown', 'David Wilson', 'Lisa Anderson'];
        
        let html = '';
        const count = Math.min(6, this.projectData[projectName]?.teamCount || 4);
        
        for (let i = 0; i < count; i++) {
            html += `
                <div class="team-member">
                    <div class="member-avatar">${names[i].split(' ').map(n => n[0]).join('')}</div>
                    <div class="member-name">${names[i]}</div>
                    <div class="member-role">${roles[i]}</div>
                    <div class="member-contact">📧 ${names[i].toLowerCase().replace(' ', '.')}@company.com</div>
                </div>
            `;
        }
        
        return html;
    }

    switchTab(event, tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active from all buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabName).classList.add('active');
        event.target.classList.add('active');
    }

    viewBlueprints(projectName) {
        // Open the Digital Takeoff Professional with this project
        if (window.professionalTakeoff) {
            window.professionalTakeoff.initialize();
            
            // Pre-select the project after a short delay
            setTimeout(() => {
                const projectSelect = document.getElementById('takeoffProjectSelect');
                if (projectSelect) {
                    projectSelect.value = projectName;
                    projectSelect.dispatchEvent(new Event('change'));
                }
            }, 500);
        } else {
            alert('Digital Takeoff Professional is loading...');
        }
    }

    viewTeam(projectName) {
        this.viewProjectDetails(projectName);
        setTimeout(() => {
            const teamTab = document.querySelector('.tab-btn:nth-child(5)');
            if (teamTab) teamTab.click();
        }, 100);
    }

    openTakeoffViewer(projectName, blueprintType) {
        alert(`Opening read-only takeoff data for ${blueprintType} of ${projectName}.\n\nThis would show the previously captured measurements and annotations.`);
    }

    createNewProject() {
        // Call the webhook to create a new project
        const projectName = prompt('Enter new project name:');
        if (projectName) {
            fetch('https://hook.us2.make.com/m7wp2byeo5lmsabsxhg1dmqgopqai4ss', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create_project',
                    projectName: projectName,
                    timestamp: new Date().toISOString()
                })
            })
            .then(response => response.json())
            .then(data => {
                alert('Project created successfully!');
                this.loadProjects();
            })
            .catch(error => {
                console.error('Error creating project:', error);
                alert('Error creating project. Please try again.');
            });
        }
    }

    refreshProjects() {
        this.loadProjects();
    }

    showDashboard() {
        const modal = document.createElement('div');
        modal.className = 'project-detail-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Projects Dashboard</h2>
                    <button class="modal-close" onclick="this.closest('.project-detail-modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="dashboard-container">
                        <h3>Overall Statistics</h3>
                        <div class="dashboard-stats">
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">📁</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Total Projects</div>
                                    <div class="dashboard-stat-value">${Object.keys(this.projectData).length}</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">📊</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Total Estimates</div>
                                    <div class="dashboard-stat-value">${Object.values(this.projectData).reduce((sum, p) => sum + p.estimateCount, 0)}</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">👥</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Team Members</div>
                                    <div class="dashboard-stat-value">${Object.values(this.projectData).reduce((sum, p) => sum + p.teamCount, 0)}</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon">💰</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Total Value</div>
                                    <div class="dashboard-stat-value">$${(Object.values(this.projectData).reduce((sum, p) => sum + p.value, 0)/1000000).toFixed(1)}M</div>
                                </div>
                            </div>
                        </div>
                        
                        <h3 style="margin-top: 30px;">Projects by Status</h3>
                        <div class="dashboard-stats">
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon" style="background: #4caf50;">✓</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Active Projects</div>
                                    <div class="dashboard-stat-value">${Object.values(this.projectData).filter(p => p.status === 'active').length}</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon" style="background: #ff9800;">⏳</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Pending Projects</div>
                                    <div class="dashboard-stat-value">${Object.values(this.projectData).filter(p => p.status === 'pending').length}</div>
                                </div>
                            </div>
                            <div class="dashboard-stat-card">
                                <div class="dashboard-stat-icon" style="background: #2196f3;">🏁</div>
                                <div class="dashboard-stat-content">
                                    <div class="dashboard-stat-label">Completed Projects</div>
                                    <div class="dashboard-stat-value">${Object.values(this.projectData).filter(p => p.status === 'completed').length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    setupEventHandlers() {
        // Search functionality
        const searchInput = document.getElementById('projectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterProjects(e.target.value.toLowerCase());
            });
        }

        // Filter functionality
        const filterSelect = document.getElementById('projectFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterByStatus(e.target.value);
            });
        }

        // Sort functionality
        const sortSelect = document.getElementById('projectSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortProjects(e.target.value);
            });
        }
    }

    filterProjects(searchTerm) {
        const cards = document.querySelectorAll('.project-card-enhanced');
        cards.forEach(card => {
            const title = card.querySelector('.project-card-title').textContent.toLowerCase();
            card.style.display = title.includes(searchTerm) ? '' : 'none';
        });
    }

    filterByStatus(status) {
        const cards = document.querySelectorAll('.project-card-enhanced');
        cards.forEach(card => {
            if (status === 'all') {
                card.style.display = '';
            } else {
                const badge = card.querySelector('.project-status-badge');
                card.style.display = badge.classList.contains(`status-${status}`) ? '' : 'none';
            }
        });
    }

    sortProjects(sortBy) {
        const container = document.getElementById('enhanced-projects-container');
        const cards = Array.from(container.querySelectorAll('.project-card-enhanced'));
        
        cards.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    const nameA = a.querySelector('.project-card-title').textContent;
                    const nameB = b.querySelector('.project-card-title').textContent;
                    return nameA.localeCompare(nameB);
                case 'value':
                    const valueA = parseInt(a.querySelector('.stat-value:last-child').textContent.replace(/[^0-9]/g, ''));
                    const valueB = parseInt(b.querySelector('.stat-value:last-child').textContent.replace(/[^0-9]/g, ''));
                    return valueB - valueA;
                case 'status':
                    const statusA = a.querySelector('.project-status-badge').textContent;
                    const statusB = b.querySelector('.project-status-badge').textContent;
                    return statusA.localeCompare(statusB);
                default:
                    return 0;
            }
        });
        
        // Re-append cards in sorted order
        cards.forEach(card => container.appendChild(card));
    }
}

// Create global instance
window.projectManager = new ProjectManagementPro();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.projectManager.initialize();
    });
} else {
    window.projectManager.initialize();
}
