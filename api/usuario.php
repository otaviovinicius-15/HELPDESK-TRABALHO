<?php
require_once '../conexao.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'PUT':
        atualizarPerfil();
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
}

function atualizarPerfil() {
    if (!verificarLogin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Não autorizado']);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados inválidos']);
        return;
    }

    $usuario = obterUsuarioLogado();
    $usuario_id = $usuario['id'];

    $updates = [];
    $params = [];
    $types = "";

    // Atualizar nome
    if (isset($data['nome'])) {
        $nome = sanitizar($data['nome']);
        if (strlen($nome) < 2) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Nome deve ter pelo menos 2 caracteres']);
            return;
        }
        $updates[] = "nome = ?";
        $params[] = $nome;
        $types .= "s";
    }

    // Atualizar email
    if (isset($data['email'])) {
        $email = sanitizar($data['email']);
        if (!validarEmail($email)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email inválido']);
            return;
        }

        // Verificar se email já existe (exceto o próprio)
        global $conn;
        $stmt_check = $conn->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
        $stmt_check->bind_param("si", $email, $usuario_id);
        $stmt_check->execute();

        if ($stmt_check->get_result()->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Email já está em uso']);
            return;
        }

        $updates[] = "email = ?";
        $params[] = $email;
        $types .= "s";
    }

    // Atualizar senha
    if (isset($data['senha_atual']) && isset($data['nova_senha'])) {
        $senha_atual = $data['senha_atual'];
        $nova_senha = $data['nova_senha'];

        if (strlen($nova_senha) < 6) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Nova senha deve ter pelo menos 6 caracteres']);
            return;
        }

        // Verificar senha atual
        $stmt_senha = $conn->prepare("SELECT senha FROM usuarios WHERE id = ?");
        $stmt_senha->bind_param("i", $usuario_id);
        $stmt_senha->execute();
        $result_senha = $stmt_senha->get_result();
        $usuario_db = $result_senha->fetch_assoc();

        if (!password_verify($senha_atual, $usuario_db['senha'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Senha atual incorreta']);
            return;
        }

        $senha_hash = password_hash($nova_senha, PASSWORD_DEFAULT);
        $updates[] = "senha = ?";
        $params[] = $senha_hash;
        $types .= "s";
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nenhum campo para atualizar']);
        return;
    }

    // Executar update
    $sql = "UPDATE usuarios SET " . implode(", ", $updates) . " WHERE id = ?";
    $params[] = $usuario_id;
    $types .= "i";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        // Atualizar sessão se necessário
        if (isset($nome)) {
            $_SESSION['usuario_nome'] = $nome;
        }
        if (isset($email)) {
            $_SESSION['usuario_email'] = $email;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Perfil atualizado com sucesso'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar perfil']);
    }
}
?>