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
        SELECT c.ID_CHAMADO FROM chamados c
        WHERE c.ID_CHAMADO = ? AND (c.USUARIO_ID = ? OR ? = 'admin')
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
            i.ID_INTERACAO as id,
            i.MENSAGEM as texto,
            i.CRIADO_EM as criado_em,
            u.NOME as usuario_nome,
            u.TIPO as usuario_tipo,
            u.EMAIL as usuario_email
        FROM INTERACAO i
        JOIN USUARIOS u ON i.USUARIO_ID = u.ID_USUARIO
        WHERE i.CHAMADO_ID = ?
        ORDER BY i.CRIADO_EM ASC
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
        SELECT c.ID_CHAMADO FROM chamados c
        WHERE c.ID_CHAMADO = ? AND (c.USUARIO_ID = ? OR ? = 'admin')
    ");
    $stmt_check->bind_param("iis", $chamado_id, $usuario['id'], $usuario['tipo']);
    $stmt_check->execute();

    if ($stmt_check->get_result()->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Acesso negado a este chamado']);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO INTERACAO (USUARIO_ID, CHAMADO_ID, MENSAGEM) VALUES (?, ?, ?)");
    $stmt->bind_param("iis", $usuario['id'], $chamado_id, $texto);

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