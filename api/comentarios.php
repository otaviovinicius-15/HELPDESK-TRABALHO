<?php
require_once '../conexao.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        listarComentarios();
        break;

    case 'POST':
        adicionarComentario();
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
}

function listarComentarios() {
    if (!verificarLogin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Não autorizado']);
        return;
    }

    $chamado_id = (int) ($_GET['chamado_id'] ?? 0);

    if ($chamado_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID do chamado é obrigatório']);
        return;
    }

    $usuario = obterUsuarioLogado();

    // Verificar se o usuário pode ver este chamado
    global $conn;

    $stmt_check = $conn->prepare("
        SELECT c.id FROM chamados c
        WHERE c.id = ? AND (c.usuario_id = ? OR ? = 'admin')
    ");
    $stmt_check->bind_param("iis", $chamado_id, $usuario['id'], $usuario['tipo']);
    $stmt_check->execute();

    if ($stmt_check->get_result()->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Acesso negado a este chamado']);
        return;
    }

    $stmt = $conn->prepare("
        SELECT
            com.id,
            com.texto,
            com.criado_em,
            com.usuario_email,
            u.nome as usuario_nome,
            u.tipo as usuario_tipo
        FROM comentarios com
        JOIN usuarios u ON com.usuario_email = u.email
        WHERE com.chamado_id = ?
        ORDER BY com.criado_em ASC
    ");
    $stmt->bind_param("i", $chamado_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $comentarios = [];
    while ($row = $result->fetch_assoc()) {
        $comentarios[] = $row;
    }

    echo json_encode([
        'success' => true,
        'comentarios' => $comentarios
    ]);
}

function adicionarComentario() {
    if (!verificarLogin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Não autorizado']);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['chamado_id']) || !isset($data['texto'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID do chamado e texto são obrigatórios']);
        return;
    }

    $chamado_id = (int) $data['chamado_id'];
    $texto = sanitizar($data['texto']);

    if ($chamado_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID do chamado inválido']);
        return;
    }

    if (strlen($texto) < 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Comentário deve ter pelo menos 5 caracteres']);
        return;
    }

    $usuario = obterUsuarioLogado();

    // Verificar se o usuário pode comentar neste chamado
    global $conn;

    $stmt_check = $conn->prepare("
        SELECT c.id FROM chamados c
        WHERE c.id = ? AND (c.usuario_id = ? OR ? = 'admin')
    ");
    $stmt_check->bind_param("iis", $chamado_id, $usuario['id'], $usuario['tipo']);
    $stmt_check->execute();

    if ($stmt_check->get_result()->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Acesso negado a este chamado']);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO comentarios (chamado_id, usuario_email, texto) VALUES (?, ?, ?)");
    $stmt->bind_param("iss", $chamado_id, $usuario['email'], $texto);

    if ($stmt->execute()) {
        $comentario_id = $conn->insert_id;

        echo json_encode([
            'success' => true,
            'message' => 'Comentário adicionado com sucesso',
            'comentario' => [
                'id' => $comentario_id,
                'texto' => $texto,
                'usuario_email' => $usuario['email'],
                'usuario_nome' => $usuario['nome'],
                'usuario_tipo' => $usuario['tipo'],
                'criado_em' => date('Y-m-d H:i:s')
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao adicionar comentário']);
    }
}
?>