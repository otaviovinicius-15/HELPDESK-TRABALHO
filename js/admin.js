// admin.js - Painel administrativo para o sistema de helpdesk

class AdminManager {
    constructor() {
        this.baseURL = window.location.origin;
        this.chamados = [];
        this.filtros = {
            status: '',
            prioridade: '',
            busca: ''
        };
        this.init();
    }

    init() {
        // Verificar autenticação e permissões
        if (!window.authManager || !window.authManager.isLoggedIn() || !window.authManager.isAdmin()) {
            window.location.href = 'index.html';
            return;
        }

        this.usuario = window.authManager.getUser();
        this.setupEventListeners();
        this.carregarChamados();
        this.atualizarInfoUsuario();
    }

    setupEventListeners() {
        // Botão de logout
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
        }

        // Filtros
        const filtroStatus = document.getElementById('filtroStatus');
        const filtroPrioridade = document.getElementById('filtroPrioridade');
        const filtroBusca = document.getElementById('filtroBusca');

        if (filtroStatus) {
            filtroStatus.addEventListener('change', () => {
                this.filtros.status = filtroStatus.value;
                this.aplicarFiltros();
            });
        }

        if (filtroPrioridade) {
            filtroPrioridade.addEventListener('change', () => {
                this.filtros.prioridade = filtroPrioridade.value;
                this.aplicarFiltros();
            });
        }

        if (filtroBusca) {
            filtroBusca.addEventListener('input', () => {
                this.filtros.busca = filtroBusca.value;
                this.aplicarFiltros();
            });
        }

        // Modal de comentários
        const modalComentarios = document.getElementById('modalComentarios');
        if (modalComentarios) {
            modalComentarios.addEventListener('click', (e) => {
                if (e.target === modalComentarios) {
                    this.fecharModalComentarios();
                }
            });
        }

        // Formulário de comentários
        const formComentario = document.getElementById('formComentario');
        if (formComentario) {
            formComentario.addEventListener('submit', (e) => this.adicionarComentario(e));
        }

        // Botão fechar modal
        const btnFecharModal = document.getElementById('btnFecharModal');
        if (btnFecharModal) {
            btnFecharModal.addEventListener('click', () => this.fecharModalComentarios());
        }

        // Modal de atualizar status
        const modalStatus = document.getElementById('modalStatus');
        if (modalStatus) {
            modalStatus.addEventListener('click', (e) => {
                if (e.target === modalStatus) {
                    this.fecharModalStatus();
                }
            });
        }

        // Formulário de status
        const formStatus = document.getElementById('formStatus');
        if (formStatus) {
            formStatus.addEventListener('submit', (e) => this.atualizarStatus(e));
        }

        // Botão fechar modal status
        const btnFecharStatus = document.getElementById('btnFecharStatus');
        if (btnFecharStatus) {
            btnFecharStatus.addEventListener('click', () => this.fecharModalStatus());
        }
    }

    async carregarChamados() {
        try {
            window.authManager.showLoading('Carregando chamados...');

            const params = new URLSearchParams();
            if (this.filtros.status) params.append('status', this.filtros.status);
            if (this.filtros.prioridade) params.append('prioridade', this.filtros.prioridade);
            if (this.filtros.busca) params.append('busca', this.filtros.busca);

            const response = await fetch(`${this.baseURL}/api/chamados.php?action=admin&${params}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.chamados = data.chamados;
                this.estatisticas = data.estatisticas;
                this.renderizarChamados();
                this.renderizarEstatisticas();
            } else {
                window.authManager.showError(data.message || 'Erro ao carregar chamados');
            }
        } catch (error) {
            console.error('Erro ao carregar chamados:', error);
            window.authManager.showError('Erro de conexão');
        } finally {
            window.authManager.hideLoading();
        }
    }

    renderizarChamados() {
        const container = document.getElementById('chamadosContainer');
        if (!container) return;

        if (this.chamados.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Nenhum chamado encontrado</h3>
                    <p>Não há chamados com os filtros aplicados.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.chamados.map(chamado => `
            <div class="chamado-card" data-id="${chamado.id}">
                <div class="chamado-header">
                    <h3>${this.escapeHtml(chamado.titulo)}</h3>
                    <div class="chamado-badges">
                        <span class="prioridade ${chamado.prioridade.toLowerCase()}">${chamado.prioridade}</span>
                        <span class="status ${chamado.status.toLowerCase().replace(' ', '-')}">${chamado.status}</span>
                    </div>
                </div>
                <div class="chamado-body">
                    <p class="descricao">${this.escapeHtml(chamado.descricao)}</p>
                    <div class="chamado-meta">
                        <span class="usuario">👤 ${this.escapeHtml(chamado.usuario_nome)}</span>
                        <span class="email">📧 ${this.escapeHtml(chamado.usuario_email)}</span>
                        <span class="data">📅 ${this.formatarData(chamado.criado_em)}</span>
                        <span class="sla ${chamado.horas_restantes_sla < 0 ? 'atrasado' : 'no-prazo'}">
                            ⏰ ${this.formatarSLA(chamado.prazo_sla, chamado.horas_restantes_sla)}
                        </span>
                    </div>
                </div>
                <div class="chamado-actions">
                    <button class="btn-secondary" onclick="adminManager.abrirComentarios(${chamado.id})">
                        💬 Comentários (${chamado.total_comentarios})
                    </button>
                    <button class="btn-primary" onclick="adminManager.abrirModalStatus(${chamado.id}, '${chamado.status}')">
                        📝 Atualizar Status
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderizarEstatisticas() {
        const statsContainer = document.getElementById('estatisticasContainer');
        if (!statsContainer || !this.estatisticas) return;

        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card total">
                    <h4>Total</h4>
                    <span class="stat-number">${this.estatisticas.total}</span>
                </div>
                <div class="stat-card abertos">
                    <h4>Abertos</h4>
                    <span class="stat-number">${this.estatisticas.abertos}</span>
                </div>
                <div class="stat-card andamento">
                    <h4>Em Andamento</h4>
                    <span class="stat-number">${this.estatisticas.em_andamento}</span>
                </div>
                <div class="stat-card concluidos">
                    <h4>Concluídos</h4>
                    <span class="stat-number">${this.estatisticas.concluidos}</span>
                </div>
                <div class="stat-card cancelados">
                    <h4>Cancelados</h4>
                    <span class="stat-number">${this.estatisticas.cancelados}</span>
                </div>
            </div>
        `;
    }

    aplicarFiltros() {
        // Debounce para evitar muitas requisições
        clearTimeout(this.filtroTimeout);
        this.filtroTimeout = setTimeout(() => {
            this.carregarChamados();
        }, 300);
    }

    async abrirComentarios(chamadoId) {
        this.chamadoAtual = chamadoId;
        await this.carregarComentarios(chamadoId);
        this.abrirModalComentarios();
    }

    async carregarComentarios(chamadoId) {
        try {
            const response = await fetch(`${this.baseURL}/api/comentarios.php?chamado_id=${chamadoId}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.renderizarComentarios(data.comentarios);
            } else {
                window.authManager.showError(data.message || 'Erro ao carregar comentários');
            }
        } catch (error) {
            console.error('Erro ao carregar comentários:', error);
            window.authManager.showError('Erro de conexão');
        }
    }

    renderizarComentarios(comentarios) {
        const container = document.getElementById('comentariosContainer');
        if (!container) return;

        if (comentarios.length === 0) {
            container.innerHTML = '<p class="no-comments">Nenhum comentário ainda.</p>';
        } else {
            container.innerHTML = comentarios.map(comentario => `
                <div class="comentario ${comentario.usuario_tipo === 'admin' ? 'admin' : 'usuario'}">
                    <div class="comentario-header">
                        <strong>${this.escapeHtml(comentario.usuario_nome)}</strong>
                        <span class="comentario-data">${this.formatarData(comentario.criado_em)}</span>
                        ${comentario.usuario_tipo === 'admin' ? '<span class="badge-admin">Admin</span>' : '<span class="badge-user">Usuário</span>'}
                    </div>
                    <div class="comentario-body">
                        ${this.escapeHtml(comentario.texto)}
                    </div>
                </div>
            `).join('');
        }
    }

    async adicionarComentario(event) {
        event.preventDefault();

        const texto = document.getElementById('textoComentario').value.trim();

        if (!texto) {
            window.authManager.showError('Digite um comentário');
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/comentarios.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    chamado_id: this.chamadoAtual,
                    texto
                })
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('textoComentario').value = '';
                await this.carregarComentarios(this.chamadoAtual);
                window.authManager.showSuccess('Comentário adicionado!');
            } else {
                window.authManager.showError(data.message || 'Erro ao adicionar comentário');
            }
        } catch (error) {
            console.error('Erro ao adicionar comentário:', error);
            window.authManager.showError('Erro de conexão');
        }
    }

    abrirModalComentarios() {
        const modal = document.getElementById('modalComentarios');
        if (modal) modal.style.display = 'block';
    }

    fecharModalComentarios() {
        const modal = document.getElementById('modalComentarios');
        if (modal) modal.style.display = 'none';
        this.chamadoAtual = null;
    }

    abrirModalStatus(chamadoId, statusAtual) {
        this.chamadoStatus = chamadoId;
        const selectStatus = document.getElementById('novoStatus');
        if (selectStatus) selectStatus.value = statusAtual;

        const modal = document.getElementById('modalStatus');
        if (modal) modal.style.display = 'block';
    }

    fecharModalStatus() {
        const modal = document.getElementById('modalStatus');
        if (modal) modal.style.display = 'none';
        this.chamadoStatus = null;
    }

    async atualizarStatus(event) {
        event.preventDefault();

        const novoStatus = document.getElementById('novoStatus').value;

        if (!novoStatus) {
            window.authManager.showError('Selecione um status');
            return;
        }

        try {
            window.authManager.showLoading('Atualizando status...');

            const response = await fetch(`${this.baseURL}/api/chamados.php?id=${this.chamadoStatus}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    status: novoStatus
                })
            });

            const data = await response.json();

            if (data.success) {
                this.fecharModalStatus();
                this.carregarChamados();
                window.authManager.showSuccess('Status atualizado com sucesso!');
            } else {
                window.authManager.showError(data.message || 'Erro ao atualizar status');
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            window.authManager.showError('Erro de conexão');
        } finally {
            window.authManager.hideLoading();
        }
    }

    atualizarInfoUsuario() {
        const nomeUsuario = document.getElementById('nomeUsuario');
        const emailUsuario = document.getElementById('emailUsuario');

        if (nomeUsuario) nomeUsuario.textContent = this.usuario.nome;
        if (emailUsuario) emailUsuario.textContent = this.usuario.email;
    }

    // Utilitários
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatarData(dataString) {
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR');
    }

    formatarSLA(prazoString, horasRestantes) {
        const prazo = new Date(prazoString);
        const agora = new Date();

        if (horasRestantes < 0) {
            return `Vencido há ${Math.abs(Math.floor(horasRestantes / 24))} dias`;
        } else if (horasRestantes < 24) {
            return `${Math.floor(horasRestantes)}h restantes`;
        } else {
            return `${Math.floor(horasRestantes / 24)} dias restantes`;
        }
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
});document.addEventListener('DOMContentLoaded', function() {
    const auth = firebase.auth();
    const database = firebase.database();
    const adminGreeting = document.getElementById('admin-greeting');
    const logoutButton = document.getElementById('logout-button');
    const allTicketsList = document.getElementById('all-tickets-list');
    
    // Modal Elements
    const adminModal = document.getElementById('admin-ticket-modal');
    const closeAdminModalBtn = document.getElementById('close-admin-modal-btn');
    const adminChangeStatusSelect = document.getElementById('admin-change-status');
    const btnSaveStatus = document.getElementById('btn-save-status');
    const adminCommentsList = document.getElementById('admin-comments-list');
    const adminNewCommentForm = document.getElementById('admin-new-comment-form');
    const adminCommentTextInput = document.getElementById('admin-comment-text');

    // Metrics Elements
    const metricAbertos = document.getElementById('metric-abertos');
    const metricAndamento = document.getElementById('metric-andamento');
    const metricConcluidos = document.getElementById('metric-concluidos');
    const statusFilter = document.getElementById('admin-status-filter');
    const searchInput = document.getElementById('admin-search-input');

    // Charts
    let statusChartInstance = null;
    let priorityChartInstance = null;

    const ADMIN_EMAIL = 'adm.ti@empresa.com';

    let currentUser = null;
    let currentTicketId = null;
    let allTicketsData = [];

    auth.onAuthStateChanged(function(user) {
        if (user) {
            if (user.email !== ADMIN_EMAIL) {
                alert('Acesso negado.');
                window.location.href = 'home.html';
                return;
            }
            currentUser = user;
            if(adminGreeting) adminGreeting.textContent = `Olá, Admin!`;
            
            Chart.defaults.color = '#D1D5DB';
            Chart.defaults.font.family = "'Poppins', sans-serif";

            loadAllTickets();
        } else {
            window.location.href = 'index.html';
        }
    });

    if(logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            }).catch((error) => console.error("Erro ao fazer logout: ", error));
        });
    }

    // Modal Logic
    if(closeAdminModalBtn) {
        closeAdminModalBtn.addEventListener('click', () => {
            adminModal.classList.add('hidden');
            currentTicketId = null;
        });
    }

    if(btnSaveStatus) {
        btnSaveStatus.addEventListener('click', () => {
            if(!currentTicketId) return;
            const newStatus = adminChangeStatusSelect.value;
            database.ref('chamados/' + currentTicketId).update({ status: newStatus })
                .then(() => alert('Status atualizado!'))
                .catch(err => console.error(err));
        });
    }

    function openAdminModal(ticketId, currentStatus) {
        currentTicketId = ticketId;
        adminChangeStatusSelect.value = currentStatus;
        adminModal.classList.remove('hidden');
        loadAdminComments(ticketId);
    }

    function loadAdminComments(ticketId) {
        const commentsRef = database.ref('comentarios/' + ticketId);
        commentsRef.on('value', (snapshot) => {
            if (currentTicketId !== ticketId) return;
            adminCommentsList.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const c = child.val();
                    const d = document.createElement('div');
                    d.classList.add('comment-item');
                    d.innerHTML = `<div class="comment-header"><strong>${c.autorEmail}</strong> <span>${new Date(c.timestamp).toLocaleString('pt-BR')}</span></div><div class="comment-body">${c.texto}</div>`;
                    adminCommentsList.appendChild(d);
                });
                adminCommentsList.scrollTop = adminCommentsList.scrollHeight;
            } else {
                adminCommentsList.innerHTML = '<p class="text-sm text-gray-400">Nenhum comentário.</p>';
            }
        });
    }

    if(adminNewCommentForm) {
        adminNewCommentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = adminCommentTextInput.value.trim();
            
            if(!currentTicketId) {
                alert("Sessão do Modal Perdida: Recarregue a janela!");
                return;
            }

            if(text && currentUser) {
                const btnSubmit = adminNewCommentForm.querySelector('button[type="submit"]');
                const btnOriginalText = btnSubmit.textContent;
                btnSubmit.textContent = "...";
                btnSubmit.disabled = true;

                database.ref('comentarios/' + currentTicketId).push().set({
                    texto: text,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    autorEmail: currentUser.email
                }).then(() => {
                    adminCommentTextInput.value = '';
                    btnSubmit.textContent = btnOriginalText;
                    btnSubmit.disabled = false;
                }).catch(err => {
                    alert("Firebase Reject: " + err.message);
                    btnSubmit.textContent = btnOriginalText;
                    btnSubmit.disabled = false;
                });
            }
        });
    }

    // Load and Process Data
    function loadAllTickets() {
        if (!allTicketsList) return;
        database.ref('chamados').on('value', (snapshot) => {
            allTicketsData = [];
            let abertos = 0, andamento = 0, concluidos = 0;
            const statusCounts = { 'Aberto': 0, 'Em Andamento': 0, 'Aguardando Resposta do Cliente': 0, 'Concluído': 0, 'Cancelado': 0 };
            const priorityCounts = { 'Baixa': 0, 'Média': 0, 'Alta': 0, 'Urgente': 0 };

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const ticket = child.val();
                    ticket.id = child.key;
                    allTicketsData.push(ticket);

                    // Metrics calculation
                    if (ticket.status === 'Aberto') abertos++;
                    if (ticket.status === 'Em Andamento') andamento++;
                    if (ticket.status === 'Concluído') concluidos++;
                    
                    if (statusCounts[ticket.status] !== undefined) statusCounts[ticket.status]++;
                    if (ticket.prioridade && priorityCounts[ticket.prioridade] !== undefined) priorityCounts[ticket.prioridade]++;
                });
            }
            
            if(metricAbertos) metricAbertos.textContent = abertos;
            if(metricAndamento) metricAndamento.textContent = andamento;
            if(metricConcluidos) metricConcluidos.textContent = concluidos;

            updateCharts(statusCounts, priorityCounts);
            renderTicketsList();
        });
    }

    if(statusFilter) {
        statusFilter.addEventListener('change', renderTicketsList);
    }
    if(searchInput) {
        searchInput.addEventListener('input', renderTicketsList);
    }

    function renderTicketsList() {
        if(!allTicketsList) return;
        allTicketsList.innerHTML = '';
        const filterState = statusFilter ? statusFilter.value : 'Todos';
        const searchStr = searchInput ? searchInput.value.toLowerCase() : '';
        
        const filtered = allTicketsData.filter(t => {
            const matchesStatus = filterState === 'Todos' || t.status === filterState;
            const matchesSearch = !searchStr || 
                (t.titulo && t.titulo.toLowerCase().includes(searchStr)) || 
                (t.descricao && t.descricao.toLowerCase().includes(searchStr)) || 
                (t.userEmail && t.userEmail.toLowerCase().includes(searchStr));
            return matchesStatus && matchesSearch;
        });
        
        // Sort newest first
        filtered.sort((a,b) => (b.criadoEm || 0) - (a.criadoEm || 0));

        if(filtered.length > 0) {
            filtered.forEach(ticket => {
                let slaBadge = '';
                if (ticket.status !== 'Concluído' && ticket.status !== 'Cancelado' && ticket.prazoSLA) {
                    const timeLeft = ticket.prazoSLA - Date.now();
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    if (timeLeft <= 0) {
                        slaBadge = '<span class="badge badge-cancelado" style="animation: pulse 1s infinite alternate;">🔥 VENCIDO</span>';
                    } else if (timeLeft < 4 * 60 * 60 * 1000) {
                        slaBadge = `<span class="badge badge-em-andamento">⚠️ SÓ ${hoursLeft}H</span>`;
                    } else {
                        slaBadge = `<span class="badge" style="border-color:var(--border-color); color:var(--text-muted);">${hoursLeft}H SLA</span>`;
                    }
                }

                const el = document.createElement('div');
                el.classList.add('ticket-item-admin', 'border-left-' + (ticket.prioridade ? ticket.prioridade.toLowerCase() : 'baixa'));
                el.innerHTML = `
                    <div class="ticket-header">
                        <h4>${ticket.titulo} ${slaBadge}</h4>
                        <span class="badge badge-${ticket.status.replace(/\s+/g, '-').toLowerCase()}">${ticket.status}</span>
                    </div>
                    <div class="mt-2 text-sm text-gray-300">
                        <p><strong>Usuário:</strong> ${ticket.userEmail} | <strong>Prioridade:</strong> ${ticket.prioridade || 'N/A'}</p>
                    </div>
                    <p class="mt-2">${ticket.descricao}</p>
                    <div class="ticket-footer mt-4" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm btn-manage" data-id="${ticket.id}" data-status="${ticket.status}">Gerenciar</button>
                    </div>
                `;
                allTicketsList.appendChild(el);
            });

            document.querySelectorAll('.btn-manage').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const st = e.currentTarget.getAttribute('data-status');
                    openAdminModal(id, st);
                });
            });
        } else {
            allTicketsList.innerHTML = '<p class="text-sm text-gray-400">Nenhum chamado corresponde ao filtro.</p>';
        }
    }

    function updateCharts(sData, pData) {
        const sCtx = document.getElementById('ticketsStatusChart');
        const pCtx = document.getElementById('ticketsPriorityChart');
        if(!sCtx || !pCtx) return;

        if(statusChartInstance) statusChartInstance.destroy();
        if(priorityChartInstance) priorityChartInstance.destroy();

        statusChartInstance = new Chart(sCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(sData),
                datasets: [{
                    data: Object.values(sData),
                    backgroundColor: ['#3B82F6', '#F59E0B', '#6366F1', '#10B981', '#EF4444'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });

        priorityChartInstance = new Chart(pCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(pData),
                datasets: [{
                    label: 'Chamados por Prioridade',
                    data: Object.values(pData),
                    backgroundColor: ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

});