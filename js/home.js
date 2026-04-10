// home.js - Dashboard do usuário para o sistema de helpdesk

class HomeManager {
    constructor() {
        this.baseURL = window.location.origin;
        this.chamados = [];
        this.init();
    }

    init() {
        // Verificar autenticação
        if (!window.authManager || !window.authManager.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }

        this.usuario = window.authManager.getUser();
        this.setupEventListeners();
        this.carregarChamados();
        this.atualizarInfoUsuario();
    }

    setupEventListeners() {
        // Formulário de novo chamado
        const formNovoChamado = document.getElementById('formNovoChamado');
        if (formNovoChamado) {
            formNovoChamado.addEventListener('submit', (e) => this.criarChamado(e));
        }

        // Botão de logout
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
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

        // Modal de perfil
        const modalPerfil = document.getElementById('modalPerfil');
        if (modalPerfil) {
            modalPerfil.addEventListener('click', (e) => {
                if (e.target === modalPerfil) {
                    this.fecharModalPerfil();
                }
            });
        }

        // Formulário de perfil
        const formPerfil = document.getElementById('formPerfil');
        if (formPerfil) {
            formPerfil.addEventListener('submit', (e) => this.atualizarPerfil(e));
        }

        // Botões de abrir modais
        const btnAbrirPerfil = document.getElementById('btnAbrirPerfil');
        if (btnAbrirPerfil) {
            btnAbrirPerfil.addEventListener('click', () => this.abrirModalPerfil());
        }

        const btnFecharPerfil = document.getElementById('btnFecharPerfil');
        if (btnFecharPerfil) {
            btnFecharPerfil.addEventListener('click', () => this.fecharModalPerfil());
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
                this.chamados = data.chamados;
                this.renderizarChamados();
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
                    <p>Você ainda não criou nenhum chamado. Clique em "Novo Chamado" para começar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.chamados.map(chamado => `
            <div class="chamado-card" data-id="${chamado.id}">
                <div class="chamado-header">
                    <h3>${this.escapeHtml(chamado.titulo)}</h3>
                    <span class="prioridade ${chamado.prioridade.toLowerCase()}">${chamado.prioridade}</span>
                </div>
                <div class="chamado-body">
                    <p class="descricao">${this.escapeHtml(chamado.descricao)}</p>
                    <div class="chamado-meta">
                        <span class="status ${chamado.status.toLowerCase().replace(' ', '-')}">${chamado.status}</span>
                        <span class="data">Criado em: ${this.formatarData(chamado.criado_em)}</span>
                        <span class="sla ${chamado.horas_restantes_sla < 0 ? 'atrasado' : 'no-prazo'}">
                            SLA: ${this.formatarSLA(chamado.prazo_sla, chamado.horas_restantes_sla)}
                        </span>
                    </div>
                </div>
                <div class="chamado-actions">
                    <button class="btn-secondary" onclick="homeManager.abrirComentarios(${chamado.id})">
                        💬 Comentários (${chamado.total_comentarios})
                    </button>
                </div>
            </div>
        `).join('');
    }

    async criarChamado(event) {
        event.preventDefault();

        const titulo = document.getElementById('tituloChamado').value.trim();
        const descricao = document.getElementById('descricaoChamado').value.trim();
        const prioridade = document.getElementById('prioridadeChamado').value;

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
                document.getElementById('formNovoChamado').reset();
                this.carregarChamados();
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
                        ${comentario.usuario_tipo === 'admin' ? '<span class="badge-admin">Admin</span>' : ''}
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

    abrirModalPerfil() {
        const modal = document.getElementById('modalPerfil');
        const nomeInput = document.getElementById('perfilNome');
        const emailInput = document.getElementById('perfilEmail');

        if (nomeInput) nomeInput.value = this.usuario.nome;
        if (emailInput) emailInput.value = this.usuario.email;

        if (modal) modal.style.display = 'block';
    }

    fecharModalPerfil() {
        const modal = document.getElementById('modalPerfil');
        if (modal) modal.style.display = 'none';
    }

    async atualizarPerfil(event) {
        event.preventDefault();

        const nome = document.getElementById('perfilNome').value.trim();
        const email = document.getElementById('perfilEmail').value.trim();
        const senhaAtual = document.getElementById('perfilSenhaAtual').value;
        const novaSenha = document.getElementById('perfilNovaSenha').value;

        if (!nome || !email) {
            window.authManager.showError('Nome e email são obrigatórios');
            return;
        }

        const dados = { nome, email };

        if (senhaAtual && novaSenha) {
            if (novaSenha.length < 6) {
                window.authManager.showError('Nova senha deve ter pelo menos 6 caracteres');
                return;
            }
            dados.senha_atual = senhaAtual;
            dados.nova_senha = novaSenha;
        }

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
                this.usuario.email = email;
                window.authManager.setUser(this.usuario);
                this.atualizarInfoUsuario();

                // Limpar campos de senha
                document.getElementById('perfilSenhaAtual').value = '';
                document.getElementById('perfilNovaSenha').value = '';

                this.fecharModalPerfil();
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
    window.homeManager = new HomeManager();
});document.addEventListener('DOMContentLoaded', function() {
    const auth = firebase.auth();
    const database = firebase.database();
    
    // UI Elements
    const userGreeting = document.getElementById('user-greeting');
    const pageTitle = document.getElementById('page-title');
    const logoutButton = document.getElementById('logout-button');
    const newTicketForm = document.getElementById('new-ticket-form');
    const ticketsList = document.getElementById('tickets-list');
    const profileForm = document.getElementById('profile-form');

    // Navegação (SPA)
    const navItems = document.querySelectorAll('.nav-item');
    const appSections = document.querySelectorAll('.app-section');

    // Dashboard Metrics
    const metricAtivos = document.getElementById('user-metric-ativos');
    const metricConcluidos = document.getElementById('user-metric-concluidos');

    // Elementos do Modal de Comentários
    const commentsModal = document.getElementById('comments-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const commentsList = document.getElementById('comments-list');
    const newCommentForm = document.getElementById('new-comment-form');
    const commentTextInput = document.getElementById('comment-text');

    let currentUser = null;
    let currentTicketId = null;

    // --- Navigation Logic ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active from all
            navItems.forEach(n => n.classList.remove('active'));
            // Add active to clicked
            item.classList.add('active');
            
            // Update Title
            pageTitle.textContent = item.textContent;

            // Hide all sections
            appSections.forEach(sec => sec.classList.add('hidden'));

            // Show targeted section
            const targetId = `section-${item.getAttribute('data-target')}`;
            const targetEl = document.getElementById(targetId);
            if(targetEl) {
                targetEl.classList.remove('hidden');
                // Adicionando uma pequena classe de animação se existir
                targetEl.classList.add('fade-in');
            }
        });
    });

    // --- Auth Logic ---
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            const userName = currentUser.displayName || currentUser.email.split('@')[0];
            if(userGreeting) userGreeting.textContent = `Olá, ${userName}!`;
            
            // Popula form de perfil
            if(document.getElementById('profile-email')) document.getElementById('profile-email').value = currentUser.email;
            if(document.getElementById('profile-name')) document.getElementById('profile-name').value = currentUser.displayName || '';

            loadUserTickets();
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

    // --- Profile Logic ---
    if(profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = document.getElementById('profile-name').value;
            if(currentUser && newName) {
                currentUser.updateProfile({
                    displayName: newName
                }).then(() => {
                    alert('Perfil atualizado com sucesso!');
                    userGreeting.textContent = `Olá, ${newName}!`;
                }).catch((error) => console.error(error));
            }
        });
    }

    // Upload Feedback Visual - REMOVIDO DA V3 (Custo Alto)

    // SLA Mapper Backend
    const SLAMapper = {
        'Urgente': 4 * 60 * 60 * 1000,
        'Alta': 12 * 60 * 60 * 1000,
        'Média': 24 * 60 * 60 * 1000,
        'Baixa': 72 * 60 * 60 * 1000
    };

    // --- Ticket Logic ---
    if(newTicketForm) {
        newTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('ticket-title').value;
            const description = document.getElementById('ticket-description').value;
            const priority = document.getElementById('ticket-priority').value;

            if (title && description && priority && currentUser) {
                const btnSubmit = newTicketForm.querySelector('button[type="submit"]');
                const btnOriginalText = btnSubmit.textContent;
                btnSubmit.textContent = "Enviando...";
                btnSubmit.disabled = true;

                try {
                    const now = Date.now();
                    const newTicketRef = database.ref('chamados').push();
                    await newTicketRef.set({
                        userId: currentUser.uid,
                        userEmail: currentUser.email,
                        titulo: title,
                        descricao: description,
                        prioridade: priority,
                        status: 'Aberto',
                        criadoEm: now,
                        prazoSLA: now + (SLAMapper[priority] || SLAMapper['Baixa'])
                    });

                    alert('Chamado aberto com sucesso!');
                    newTicketForm.reset();
                    document.querySelector('[data-target="meus-chamados"]').click();
                } catch (error) {
                    console.error(error);
                    alert("Erro ao criar chamado: " + error.message);
                } finally {
                    btnSubmit.textContent = btnOriginalText;
                    btnSubmit.disabled = false;
                }
            }
        });
    }

    function loadUserTickets() {
        if (!ticketsList || !currentUser) return;

        const ticketsRef = database.ref('chamados');
        ticketsRef.orderByChild('userId').equalTo(currentUser.uid).on('value', (snapshot) => {
            ticketsList.innerHTML = '';
            let abertosQtd = 0;
            let concluidosQtd = 0;
            
            // Usar um array temporário para ordernar os mais recentes primeiro
            const tmpTickets = [];

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const ticket = childSnapshot.val();
                    ticket.id = childSnapshot.key;
                    tmpTickets.push(ticket);

                    // Contadores de Dashboard
                    if(ticket.status === 'Concluído' || ticket.status === 'Cancelado') {
                        concluidosQtd++;
                    } else {
                        abertosQtd++;
                    }
                });

                // Ordenar decrescente por criadoEm
                tmpTickets.sort((a,b) => (b.criadoEm || 0) - (a.criadoEm || 0));

                tmpTickets.forEach(ticket => {
                    const ticketElement = document.createElement('div');
                    ticketElement.classList.add('ticket-item', 'border-left-' + (ticket.prioridade || 'baixa').toLowerCase());
                    ticketElement.innerHTML = `
                        <div class="ticket-header">
                            <h4>${ticket.titulo}</h4>
                            <span class="badge badge-${ticket.status.replace(/\s+/g, '-').toLowerCase()}">${ticket.status}</span>
                        </div>
                        <p class="mt-2 text-sm text-gray-300">${ticket.descricao}</p>
                        <div class="ticket-footer mt-4">
                            <span><strong>Prioridade:</strong> ${ticket.prioridade || 'N/A'}</span>
                            <button class="btn btn-secondary btn-sm open-comments-btn" data-id="${ticket.id}">Comentários</button>
                        </div>
                    `;
                    ticketsList.appendChild(ticketElement);
                });

                document.querySelectorAll('.open-comments-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const tId = e.currentTarget.getAttribute('data-id');
                        openCommentsModal(tId);
                    });
                });
            } else {
                ticketsList.innerHTML = '<p class="text-gray-400 text-sm">Você ainda não abriu nenhum chamado.</p>';
            }

            // Atualiza Dashboard
            if(metricAtivos) metricAtivos.textContent = abertosQtd;
            if(metricConcluidos) metricConcluidos.textContent = concluidosQtd;
        });
    }

    // --- Modal e Comentários Logic ---
    function openCommentsModal(ticketId) {
        currentTicketId = ticketId;
        commentsModal.classList.remove('hidden');
        loadComments(ticketId);
    }

    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            commentsModal.classList.add('hidden');
            currentTicketId = null;
        });
    }

    function loadComments(ticketId) {
        const commentsRef = database.ref('comentarios/' + ticketId);
        commentsRef.on('value', (snapshot) => {
            if (currentTicketId !== ticketId) return;
            
            commentsList.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const c = child.val();
                    const div = document.createElement('div');
                    div.classList.add('comment-item');
                    div.innerHTML = `
                        <div class="comment-header"><strong>${c.autorEmail}</strong> <span>${new Date(c.timestamp).toLocaleString('pt-BR')}</span></div>
                        <div class="comment-body mt-2">${c.texto}</div>
                    `;
                    commentsList.appendChild(div);
                });
                commentsList.scrollTop = commentsList.scrollHeight; // Auto-scroll
            } else {
                commentsList.innerHTML = '<p class="text-sm text-gray-400">Nenhum comentário ainda.</p>';
            }
        });
    }

    if(newCommentForm) {
        newCommentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = commentTextInput.value.trim();
            
            if (!currentTicketId) {
                alert("Sessão do Modal Perdida: Recarregue a janela!");
                return;
            }

            if (text && currentUser) {
                const btnSubmit = newCommentForm.querySelector('button[type="submit"]');
                const btnOriginalText = btnSubmit.textContent;
                btnSubmit.textContent = "...";
                btnSubmit.disabled = true;

                database.ref('comentarios/' + currentTicketId).push().set({
                    texto: text,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    autorEmail: currentUser.email
                }).then(() => {
                    commentTextInput.value = '';
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
});
