// auth.js - Lógica de autenticação para o sistema de helpdesk

class AuthManager {
    constructor() {
        const path = window.location.pathname.replace(/\/[^\/]*$/, '');
        this.baseURL = path === '' ? '' : path;
        this.checkSession();

        // Event listeners para forms
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-password').value;
            this.login(email, senha);
        });

        document.getElementById('signup-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const nome = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const senha = document.getElementById('password').value;
            this.register(nome, email, senha);
        });

        // Event listeners para tabs
        document.getElementById('login-tab')?.addEventListener('click', () => this.showLoginForm());
        document.getElementById('register-tab')?.addEventListener('click', () => this.showRegisterForm());
    }

    // Verificar se usuário está logado ao carregar a página
    async checkSession() {
        try {
            const response = await fetch(`${this.baseURL}/api/auth.php?action=session`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success && data.logged_in) {
                this.setUser(data.usuario);
                
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const tSession = data.usuario.tipo ? data.usuario.tipo.toLowerCase() : '';
                const targetPage = (tSession === 'admin' || tSession === 'adm') ? 'admin.html' : 'index.html';
                
                if (currentPage !== targetPage && currentPage !== '') {
                    this.redirectBasedOnRole(data.usuario.tipo);
                }
            } else {
                this.clearUser();
                window.location.href = 'Back end help desk/login.php';
            }
        } catch (error) {
            console.error('Erro ao verificar sessão:', error);
            this.clearUser();
            window.location.href = 'Back end help desk/login.php';
        }
    }

    // Fazer login
    async login(email, senha) {
        try {
            this.showLoading('Fazendo login...');

            const response = await fetch(`${this.baseURL}/api/auth.php?action=login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (data.success) {
                this.setUser(data.usuario);
                this.showSuccess('Login realizado com sucesso!');
                setTimeout(() => {
                    this.redirectBasedOnRole(data.usuario.tipo);
                }, 1000);
            } else {
                this.showError(data.message || 'Erro ao fazer login');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showError('Erro de conexão. Tente novamente.');
        } finally {
            this.hideLoading();
        }
    }

    // Registrar novo usuário
    async register(nome, email, senha) {
        try {
            this.showLoading('Criando conta...');

            const response = await fetch(`${this.baseURL}/api/auth.php?action=register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ nome, email, senha })
            });

            const data = await response.json();

            if (data.success) {
                this.setUser(data.usuario);
                this.showSuccess('Conta criada com sucesso!');
                setTimeout(() => {
                    this.redirectBasedOnRole(data.usuario.tipo);
                }, 1000);
            } else {
                this.showError(data.message || 'Erro ao criar conta');
            }
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showError('Erro de conexão. Tente novamente.');
        } finally {
            this.hideLoading();
        }
    }

    // Fazer logout
    async logout() {
        try {
            await fetch(`${this.baseURL}/api/auth.php?action=logout`, {
                method: 'POST',
                credentials: 'include'
            });

            this.clearUser();
            this.showSuccess('Logout realizado com sucesso!');
            setTimeout(() => {
                window.location.href = 'Back end help desk/login.php';
            }, 1000);
        } catch (error) {
            console.error('Erro no logout:', error);
            // Mesmo com erro, limpar dados locais
            this.clearUser();
            window.location.href = 'Back end help desk/login.php';
        }
    }

    // Redirecionar baseado no tipo de usuário
    redirectBasedOnRole(tipo) {
        const t = tipo ? tipo.toLowerCase() : '';
        if (t === 'admin' || t === 'adm') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    }

    // Salvar dados do usuário no localStorage
    setUser(usuario) {
        localStorage.setItem('usuario', JSON.stringify(usuario));
    }

    // Obter dados do usuário do localStorage
    getUser() {
        const usuario = localStorage.getItem('usuario');
        return usuario ? JSON.parse(usuario) : null;
    }

    // Limpar dados do usuário
    clearUser() {
        localStorage.removeItem('usuario');
    }

    // Verificar se usuário está logado
    isLoggedIn() {
        return this.getUser() !== null;
    }

    // Verificar se é admin
    isAdmin() {
        const usuario = this.getUser();
        if (!usuario || !usuario.tipo) return false;
        const t = usuario.tipo.toLowerCase();
        return (t === 'admin' || t === 'adm');
    }

    // Mostrar formulário de login
    showLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');

        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');

        // Esconder conteúdo protegido
        const protectedContent = document.getElementById('protectedContent');
        if (protectedContent) protectedContent.style.display = 'none';
    }

    // Mostrar formulário de registro
    showRegisterForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');

        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.add('active');
    }

    // Mostrar loading
    showLoading(message = 'Carregando...') {
        let loading = document.getElementById('loading');
        if (!loading) {
            loading = document.createElement('div');
            loading.id = 'loading';
            loading.innerHTML = `
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                    <p>${message}</p>
                </div>
            `;
            document.body.appendChild(loading);
        }
        loading.style.display = 'block';
    }

    // Esconder loading
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    // Mostrar mensagem de sucesso
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    // Mostrar mensagem de erro
    showError(message) {
        this.showMessage(message, 'error');
    }

    // Mostrar mensagem
    showMessage(message, type) {
        let messageDiv = document.getElementById('message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'message';
            document.body.appendChild(messageDiv);
        }

        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Inicializar gerenciador de autenticação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Funções globais para os formulários
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;

    if (!email || !senha) {
        window.authManager.showError('Preencha todos os campos');
        return;
    }

    window.authManager.login(email, senha);
}

function handleRegister(event) {
    event.preventDefault();
    const nome = document.getElementById('registerNome').value;
    const email = document.getElementById('registerEmail').value;
    const senha = document.getElementById('registerSenha').value;
    const confirmarSenha = document.getElementById('registerConfirmarSenha').value;

    if (!nome || !email || !senha || !confirmarSenha) {
        window.authManager.showError('Preencha todos os campos');
        return;
    }

    if (senha !== confirmarSenha) {
        window.authManager.showError('As senhas não coincidem');
        return;
    }

    if (senha.length < 6) {
        window.authManager.showError('A senha deve ter pelo menos 6 caracteres');
        return;
    }

    window.authManager.register(nome, email, senha);
}

function toggleForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm.style.display !== 'none') {
        window.authManager.showRegisterForm();
    } else {
        window.authManager.showLoginForm();
    }
}

function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        window.authManager.logout();
    }
}

