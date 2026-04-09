document.addEventListener('DOMContentLoaded', function() {
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
