<?php
// Conexão com MySQL para o sistema de helpdesk
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configurações de sessão para segurança
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.gc_maxlifetime', 3600); // 1 hora

// Iniciar sessão se não estiver ativa
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Configurações do banco de dados
$host = 'localhost';
$user = 'root';
$password = '';
$database = 'helpdesk_pro';

// Conectar ao MySQL
$conn = new mysqli($host, $user, $password, $database);

// Verificar conexão
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro de conexão com o banco de dados: ' . $conn->connect_error
    ]);
    exit();
}

// Configurar charset
$conn->set_charset('utf8');

// Função para verificar se usuário está logado
function verificarLogin() {
    return isset($_SESSION['usuario_id']) && isset($_SESSION['usuario_tipo']);
}

// Função para verificar se é admin
function verificarAdmin() {
    return verificarLogin() && $_SESSION['usuario_tipo'] === 'admin';
}

// Função para obter dados do usuário logado
function obterUsuarioLogado() {
    if (!verificarLogin()) {
        return null;
    }

    return [
        'id' => $_SESSION['usuario_id'],
        'nome' => $_SESSION['usuario_nome'],
        'email' => $_SESSION['usuario_email'],
        'tipo' => $_SESSION['usuario_tipo']
    ];
}

// Função para sanitizar entrada contra SQL injection
function sanitizar($data) {
    global $conn;
    return $conn->real_escape_string(trim($data));
}

// Função para validar formato de email
function validarEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL);
}

// Função para calcular prazo SLA baseado na prioridade do chamado
function calcularSLAPrazo($prioridade) {
    $agora = new DateTime();

    switch ($prioridade) {
        case 'Urgente':
            $agora->add(new DateInterval('PT4H')); // +4 horas
            break;
        case 'Alta':
            $agora->add(new DateInterval('PT12H')); // +12 horas
            break;
        case 'Média':
            $agora->add(new DateInterval('PT24H')); // +24 horas
            break;
        case 'Baixa':
        default:
            $agora->add(new DateInterval('PT72H')); // +72 horas
            break;
    }

    return $agora->format('Y-m-d H:i:s');
}
?>