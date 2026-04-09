document.addEventListener('DOMContentLoaded', function() {
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