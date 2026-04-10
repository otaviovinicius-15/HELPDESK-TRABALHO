<?php
require_once '../conexao.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'POST':
        switch ($action) {
            case 'login':
                fazerLogin();
                break;
            case 'register':
                registrarUsuario();
                break;
            case 'logout':
                fazerLogout();
                break;
            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Ação inválida']);
        }
        break;

    case 'GET':
        switch ($action) {
            case 'session':
                verificarSessao();
                break;
            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Ação inválida']);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
}

function fazerLogin() {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['email']) || !isset($data['senha'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email e senha são obrigatórios']);
        return;
    }

    $email = sanitizar($data['email']);
    $senha = $data['senha'];

    if (!validarEmail($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email inválido']);
        return;
    }

    global $conn;

    $stmt = $conn->prepare("SELECT id, nome, email, senha, tipo FROM usuarios WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email ou senha incorretos']);
        return;
    }

    $usuario = $result->fetch_assoc();

    if (!password_verify($senha, $usuario['senha'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email ou senha incorretos']);
        return;
    }

    // Criar sessão
    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['usuario_nome'] = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_tipo'] = $usuario['tipo'];

    echo json_encode([
        'success' => true,
        'message' => 'Login realizado com sucesso',
        'usuario' => [
            'id' => $usuario['id'],
            'nome' => $usuario['nome'],
            'email' => $usuario['email'],
            'tipo' => $usuario['tipo']
        ]
    ]);
}

function registrarUsuario() {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['nome']) || !isset($data['email']) || !isset($data['senha'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nome, email e senha são obrigatórios']);
        return;
    }

    $nome = sanitizar($data['nome']);
    $email = sanitizar($data['email']);
    $senha = $data['senha'];

    if (strlen($nome) < 2) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nome deve ter pelo menos 2 caracteres']);
        return;
    }

    if (!validarEmail($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email inválido']);
        return;
    }

    if (strlen($senha) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Senha deve ter pelo menos 6 caracteres']);
        return;
    }

    global $conn;

    // Verificar se email já existe
    $stmt = $conn->prepare("SELECT id FROM usuarios WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Email já cadastrado']);
        return;
    }

    // Hash da senha
    $senha_hash = password_hash($senha, PASSWORD_DEFAULT);

    // Inserir usuário
    $stmt = $conn->prepare("INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $nome, $email, $senha_hash);

    if ($stmt->execute()) {
        $usuario_id = $conn->insert_id;

        // Criar sessão automaticamente
        $_SESSION['usuario_id'] = $usuario_id;
        $_SESSION['usuario_nome'] = $nome;
        $_SESSION['usuario_email'] = $email;
        $_SESSION['usuario_tipo'] = 'usuario';

        echo json_encode([
            'success' => true,
            'message' => 'Usuário cadastrado com sucesso',
            'usuario' => [
                'id' => $usuario_id,
                'nome' => $nome,
                'email' => $email,
                'tipo' => 'usuario'
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao cadastrar usuário']);
    }
}

function fazerLogout() {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Logout realizado com sucesso']);
}

function verificarSessao() {
    if (verificarLogin()) {
        $usuario = obterUsuarioLogado();
        echo json_encode([
            'success' => true,
            'logged_in' => true,
            'usuario' => $usuario
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'logged_in' => false
        ]);
    }
}
?>