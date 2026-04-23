// admin.js - Painel administrativo para o sistema de helpdesk

class AdminManager {
    constructor() {
        const path = window.location.pathname.replace(/\/[^\/]*$/, '');
        this.baseURL = path === '' ? '' : path;
        this.chamados = [];
        this.filtros = {
            status: '',
            busca: ''
        };
        this.init();
    }

    init() {
        // Verificar autenticação e permissões
        if (!window.authManager || !window.authManager.isLoggedIn() || !window.authManager.isAdmin()) {
            window.location.href = 'Back end help desk/login.php';
            return;
        }

        this.usuario = window.authManager.getUser();
        this.setupEventListeners();
        this.carregarChamados();
        this.atualizarInfoUsuario();
    }

    setupEventListeners() {
        // Botão de logout
        const btnLogout = document.getElementById('logout-button');
        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
        }

        // Filtros
        const filtroStatus = document.getElementById('admin-status-filter');
        const filtroBusca = document.getElementById('admin-search-input');

        if (filtroStatus) {
            filtroStatus.addEventListener('change', () => {
                this.filtros.status = filtroStatus.value === 'Todos' ? '' : filtroStatus.value;
                this.aplicarFiltros();
            });
        }

        if (filtroBusca) {
            filtroBusca.addEventListener('input', () => {
                this.filtros.busca = filtroBusca.value;
                this.aplicarFiltros();
            });
        }

        // Modal único (Gerenciar Chamado)
        const modalAdmin = document.getElementById('admin-ticket-modal');
        if (modalAdmin) {
            modalAdmin.addEventListener('click', (e) => {
                if (e.target === modalAdmin) {
                    this.fecharModalChamado();
                }
            });
        }

        // Botão fechar modal
        const btnFecharModal = document.getElementById('close-admin-modal-btn');
        if (btnFecharModal) {
            btnFecharModal.addEventListener('click', () => this.fecharModalChamado());
        }

        // Formulário de comentários
        const formComentario = document.getElementById('admin-new-comment-form');
        if (formComentario) {
            formComentario.addEventListener('submit', (e) => this.adicionarComentario(e));
        }

        // Botão de atualizar status
        const btnSaveStatus = document.getElementById('btn-save-status');
        if (btnSaveStatus) {
            btnSaveStatus.addEventListener('click', () => this.atualizarStatus());
        }
    }

    async carregarChamados() {
        try {
            window.authManager.showLoading('Carregando chamados...');

            const params = new URLSearchParams();
            if (this.filtros.status) params.append('status', this.filtros.status);
            if (this.filtros.busca) params.append('busca', this.filtros.busca);

            const response = await fetch(`${this.baseURL}/api/chamados.php?action=admin&${params}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.chamados = data.chamados.map(chamado => ({
                    ...chamado,
                    prazo_sla: chamado.prazo_sla ?? chamado.criado_em,
                    horas_restantes_sla: typeof chamado.horas_restantes_sla !== 'undefined' ? chamado.horas_restantes_sla : 0
                }));
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
        const container = document.getElementById('all-tickets-list');
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
            <div class="ticket-item-admin" data-id="${chamado.id}">
                <div class="ticket-header">
                    <h3>${this.escapeHtml(chamado.titulo)}</h3>
                    <div>
                        <span class="badge prioridade ${chamado.prioridade.toLowerCase()}">${chamado.prioridade}</span>
                        <span class="badge status ${chamado.status.toLowerCase().replace(/ /g, '-')}">
                            ${chamado.status}
                        </span>
                    </div>
                </div>
                <div class="mt-2">
                    <p class="text-gray-300 text-sm">${this.escapeHtml(chamado.descricao)}</p>
                </div>
                <div class="ticket-footer mt-4">
                    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 1rem;">
                        <span>👤 ${this.escapeHtml(chamado.usuario_nome)}</span>
                        <span>📅 ${this.formatarData(chamado.criado_em)}</span>
                        <span class="sla ${chamado.horas_restantes_sla < 0 ? 'text-error' : 'text-success'}">
                            ⏰ SLA: ${this.formatarSLA(chamado.prazo_sla, chamado.horas_restantes_sla)}
                        </span>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="adminManager.abrirModalChamado(${chamado.id}, '${chamado.status}')">
                        GERENCIAR (${chamado.total_comentarios || 0} LOGS)
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderizarEstatisticas() {
        if (!this.estatisticas) return;
        const abertos = document.getElementById('metric-abertos');
        const andamento = document.getElementById('metric-andamento');
        const concluidos = document.getElementById('metric-concluidos');

        if (abertos) abertos.textContent = this.estatisticas.abertos;
        if (andamento) andamento.textContent = this.estatisticas.em_andamento;
        if (concluidos) concluidos.textContent = this.estatisticas.concluidos;
    }

    aplicarFiltros() {
        clearTimeout(this.filtroTimeout);
        this.filtroTimeout = setTimeout(() => {
            this.carregarChamados();
        }, 300);
    }

    async abrirModalChamado(chamadoId, statusAtual) {
        this.chamadoAtual = chamadoId;
        
        const selectStatus = document.getElementById('admin-change-status');
        if (selectStatus) {
            // Find option that matches statusAtual, or set it to blank
            for(let i=0; i<selectStatus.options.length; i++) {
                if(selectStatus.options[i].value === statusAtual) {
                    selectStatus.selectedIndex = i;
                    break;
                }
            }
        }

        await this.carregarComentarios(chamadoId);
        
        const modal = document.getElementById('admin-ticket-modal');
        if (modal) modal.classList.remove('hidden');
    }

    fecharModalChamado() {
        const modal = document.getElementById('admin-ticket-modal');
        if (modal) modal.classList.add('hidden');
        this.chamadoAtual = null;
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
                window.authManager.showError(data.message || 'Erro ao carregar log');
            }
        } catch (error) {
            console.error('Erro ao carregar log:', error);
            window.authManager.showError('Erro de conexão');
        }
    }

    renderizarComentarios(comentarios) {
        const container = document.getElementById('admin-comments-list');
        if (!container) return;

        if (comentarios.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm italic">Nenhum log registrado para este chamado.</p>';
        } else {
            container.innerHTML = comentarios.map(comentario => `
                <div class="comment-item">
                    <div class="comment-header">
                        <span>[${this.formatarData(comentario.criado_em)}] ${this.escapeHtml(comentario.usuario_nome)}</span>
                        ${comentario.usuario_tipo === 'admin' ? '<span class="text-accent">PRIVILEGED</span>' : ''}
                    </div>
                    <div class="comment-body">
                        > ${this.escapeHtml(comentario.texto)}
                    </div>
                </div>
            `).join('');
            // scroll to bottom
            container.scrollTop = container.scrollHeight;
        }
    }

    async adicionarComentario(event) {
        event.preventDefault();

        const texto = document.getElementById('admin-comment-text').value.trim();

        if (!texto) {
            window.authManager.showError('O log não pode ser vazio.');
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/comentarios.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    chamado_id: this.chamadoAtual,
                    texto
                })
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('admin-comment-text').value = '';
                await this.carregarComentarios(this.chamadoAtual);
                window.authManager.showSuccess('Log adicionado com sucesso!');
                // Tambem atualiza count nos chamados recarregando:
                this.carregarChamados();
            } else {
                window.authManager.showError(data.message || 'Erro ao adicionar log no sistema');
            }
        } catch (error) {
            console.error('Erro adicionando log:', error);
            window.authManager.showError('Erro de comunicação.');
        }
    }

    async atualizarStatus() {
        if (!this.chamadoAtual) return;

        const novoStatus = document.getElementById('admin-change-status').value;

        try {
            window.authManager.showLoading('Modificando o status...');

            const response = await fetch(`${this.baseURL}/api/chamados.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: this.chamadoAtual,
                    status: novoStatus
                })
            });

            const data = await response.json();

            if (data.success) {
                this.carregarChamados();
                window.authManager.showSuccess('O status do chamado foi atualizado!');
            } else {
                window.authManager.showError(data.message || 'Falha ao atualizar o status');
            }
        } catch (error) {
            console.error('Falha de comunicacao de status:', error);
            window.authManager.showError('Falha de conexão com o banco.');
        } finally {
            window.authManager.hideLoading();
        }
    }

    atualizarInfoUsuario() {
        const greeting = document.getElementById('admin-greeting');
        if (greeting && this.usuario) {
            greeting.textContent = 'Olá, ' + this.usuario.nome + '!';
        }
    }

    // Utilitários
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatarData(dataString) {
        if (!dataString) return '';
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR');
    }

    formatarSLA(prazoString, horasRestantes) {
        if (!prazoString) return 'N/A';
        const prazo = new Date(prazoString);
        
        if (horasRestantes < 0) {
            const dias_vencido = Math.abs(Math.floor(horasRestantes / 24));
            if(dias_vencido === 0) return `Vencido (hoje)`;
            return `Vencido há ${dias_vencido} ${dias_vencido === 1 ? 'dia' : 'dias'}`;
        } else if (horasRestantes < 24) {
            return `${Math.floor(horasRestantes)}h restantes`;
        } else {
            return `${Math.floor(horasRestantes / 24)} dias restantes`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
});