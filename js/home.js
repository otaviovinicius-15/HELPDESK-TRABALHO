// home.js - Dashboard do usuário para o sistema de helpdesk

class HomeManager {
    constructor() {
        const path = window.location.pathname.replace(/\/[^\/]*$/, '');
        this.baseURL = path === '' ? '' : path;
        this.chamados = [];
        this.init();
    }

    init() {
        // Verificar autenticação
        if (!window.authManager || !window.authManager.isLoggedIn()) {
            window.location.href = 'Back end help desk/login.php';
            return;
        }

        this.usuario = window.authManager.getUser();
        this.setupNavigation();
        this.setupEventListeners();
        this.carregarChamados();
        this.atualizarInfoUsuario();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        const sections = document.querySelectorAll('.app-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                
                // Se fomos deslogar, ignora target (o de logout tem outra ID, mas por seguranca)
                if (!targetId) return;

                // Update active nav
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Update active section
                sections.forEach(sec => sec.classList.add('hidden'));
                const targetSection = document.getElementById('section-' + targetId);
                if (targetSection) targetSection.classList.remove('hidden');
            });
        });
    }

    setupEventListeners() {
        // Formulário de novo chamado
        const formNovoChamado = document.getElementById('new-ticket-form');
        if (formNovoChamado) {
            formNovoChamado.addEventListener('submit', (e) => this.criarChamado(e));
        }

        // Botão de logout
        const btnLogout = document.getElementById('logout-button');
        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
        }

        // Modal de comentários
        const modalComentarios = document.getElementById('comments-modal');
        if (modalComentarios) {
            modalComentarios.addEventListener('click', (e) => {
                if (e.target === modalComentarios) {
                    this.fecharModalComentarios();
                }
            });
        }

        // Formulário de comentários
        const formComentario = document.getElementById('new-comment-form');
        if (formComentario) {
            formComentario.addEventListener('submit', (e) => this.adicionarComentario(e));
        }

        // Botão fechar modal
        const btnFecharModal = document.getElementById('close-modal-btn');
        if (btnFecharModal) {
            btnFecharModal.addEventListener('click', () => this.fecharModalComentarios());
        }

        // Formulário de perfil
        const formPerfil = document.getElementById('profile-form');
        if (formPerfil) {
            formPerfil.addEventListener('submit', (e) => this.atualizarPerfil(e));
        }
    }

    async carregarChamados() {
        try {
            window.authManager.showLoading('Carregando chamados...');

            const response = await fetch(`${this.baseURL}/api/chamados.php`, {
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
                this.renderizarChamados();

                // Build ESTATISTICA LOCALS
                const abertos = this.chamados.filter(c => c.status !== 'Concluído' && c.status !== 'Cancelado').length;
                const concluidos = this.chamados.filter(c => c.status === 'Concluído').length;
                const metricAbertos = document.getElementById('user-metric-ativos');
                const metricConcluidos = document.getElementById('user-metric-concluidos');
                if (metricAbertos) metricAbertos.textContent = abertos;
                if (metricConcluidos) metricConcluidos.textContent = concluidos;

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
        const container = document.getElementById('tickets-list');
        if (!container) return;

        if (this.chamados.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Nenhum chamado encontrado</h3>
                    <p>Você ainda não abriu nenhum chamado. Clique em "Novo Chamado" para começar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.chamados.map(chamado => `
            <div class="ticket-item" data-id="${chamado.id}">
                <div class="ticket-header">
                    <h3>${this.escapeHtml(chamado.titulo)}</h3>
                    <span class="badge prioridade ${chamado.prioridade.toLowerCase()}">${chamado.prioridade}</span>
                </div>
                <div class="mt-2 text-sm text-gray-300">
                    <p class="descricao">${this.escapeHtml(chamado.descricao)}</p>
                </div>
                <div class="ticket-footer mt-4">
                    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 1rem;">
                        <span class="badge status ${chamado.status.toLowerCase().replace(/ /g, '-')}">${chamado.status}</span>
                        <span class="data">📅 ${this.formatarData(chamado.criado_em)}</span>
                        <span class="sla ${chamado.horas_restantes_sla < 0 ? 'text-error' : 'text-success'}">
                            ⏰ SLA: ${this.formatarSLA(chamado.prazo_sla, chamado.horas_restantes_sla)}
                        </span>
                    </div>
                    <div class="ticket-actions">
                        <button class="btn btn-secondary btn-sm" onclick="homeManager.abrirComentarios(${chamado.id})">
                            LOGS (${chamado.total_comentarios || 0})
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async criarChamado(event) {
        event.preventDefault();

        const titulo = document.getElementById('ticket-title').value.trim();
        const descricao = document.getElementById('ticket-description').value.trim();
        const prioridade = document.getElementById('ticket-priority').value;

        if (!titulo || !descricao) {
            window.authManager.showError('Preencha todos os campos obrigatórios');
            return;
        }

        try {
            window.authManager.showLoading('Criando chamado...');

            const response = await fetch(`${this.baseURL}/api/chamados.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    titulo,
                    descricao,
                    prioridade
                })
            });

            const data = await response.json();

            if (data.success) {
                window.authManager.showSuccess('Chamado criado com sucesso!');
                document.getElementById('new-ticket-form').reset();
                this.carregarChamados();
                // Vai pra guia de meus chamados simulando click
                document.querySelector('[data-target="meus-chamados"]').click();
            } else {
                window.authManager.showError(data.message || 'Erro ao criar chamado');
            }
        } catch (error) {
            console.error('Erro ao criar chamado:', error);
            window.authManager.showError('Erro de conexão');
        } finally {
            window.authManager.hideLoading();
        }
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
                window.authManager.showError(data.message || 'Erro ao carregar log');
            }
        } catch (error) {
            console.error('Erro ao carregar log:', error);
            window.authManager.showError('Erro de conexão');
        }
    }

    renderizarComentarios(comentarios) {
        const container = document.getElementById('comments-list');
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
            container.scrollTop = container.scrollHeight;
        }
    }

    async adicionarComentario(event) {
        event.preventDefault();

        const texto = document.getElementById('comment-text').value.trim();

        if (!texto) {
            window.authManager.showError('O log não pode ser vazio.');
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
                document.getElementById('comment-text').value = '';
                await this.carregarComentarios(this.chamadoAtual);
                window.authManager.showSuccess('Log adicionado com sucesso!');
                this.carregarChamados();
            } else {
                window.authManager.showError(data.message || 'Erro ao adicionar log no sistema');
            }
        } catch (error) {
            console.error('Erro adicionando log:', error);
            window.authManager.showError('Erro de comunicação.');
        }
    }

    abrirModalComentarios() {
        const modal = document.getElementById('comments-modal');
        if (modal) modal.classList.remove('hidden');
    }

    fecharModalComentarios() {
        const modal = document.getElementById('comments-modal');
        if (modal) modal.classList.add('hidden');
        this.chamadoAtual = null;
    }

    async atualizarPerfil(event) {
        event.preventDefault();

        const nome = document.getElementById('profile-name').value.trim();
        if (!nome) {
            window.authManager.showError('Nome é obrigatório');
            return;
        }

        const dados = { nome, email: this.usuario.email };

        try {
            window.authManager.showLoading('Atualizando perfil...');

            const response = await fetch(`${this.baseURL}/api/usuario.php`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(dados)
            });

            const data = await response.json();

            if (data.success) {
                // Atualizar dados locais
                this.usuario.nome = nome;
                window.authManager.setUser(this.usuario);
                this.atualizarInfoUsuario();
                window.authManager.showSuccess('Perfil atualizado com sucesso!');
            } else {
                window.authManager.showError(data.message || 'Erro ao atualizar perfil');
            }
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            window.authManager.showError('Erro de conexão');
        } finally {
            window.authManager.hideLoading();
        }
    }

    atualizarInfoUsuario() {
        const greeting = document.getElementById('user-greeting');
        const nomeInput = document.getElementById('profile-name');
        const emailInput = document.getElementById('profile-email');

        if (greeting && this.usuario) {
            greeting.textContent = 'Olá, ' + this.usuario.nome + '!';
        }
        if (nomeInput && this.usuario) {
            nomeInput.value = this.usuario.nome;
        }
        if (emailInput && this.usuario) {
            emailInput.value = this.usuario.email;
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
        if(!dataString) return '';
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR');
    }

    formatarSLA(prazoString, horasRestantes) {
        if(!prazoString) return 'N/A';
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
    window.homeManager = new HomeManager();
});
