<?php
require_once '../conexao.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['action']) && $_GET['action'] === 'admin') {
            listarChamadosAdmin();
        } else {
            listarChamadosUsuario();
        }
        break;

    case 'POST':
        criarChamado();
        break;

    case 'PUT':
        atualizarStatusChamado();
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
}

function listarChamadosUsuario() {
    if (!verificarLogin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Não autorizado']);
        return;
    }

    $usuario = obterUsuarioLogado();
    $usuario_id = $usuario['id'];

    global $conn;

    $stmt = $conn->prepare("
        SELECT
            c.id,
            c.titulo,
            c.descricao,
            c.prioridade,
            c.status,
            c.criado_em,
            c.prazo_sla,
            u.nome as usuario_nome,
            (SELECT COUNT(*) FROM comentarios WHERE chamado_id = c.id) as total_comentarios,
            TIMESTAMPDIFF(HOUR, NOW(), c.prazo_sla) as horas_restantes_sla
        FROM chamados c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.usuario_id = ?
        ORDER BY c.criado_em DESC
    ");
    $stmt->bind_param("i", $usuario_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $chamados = [];
    while ($row = $result->fetch_assoc()) {
        $chamados[] = $row;
    }

    echo json_encode([
        'success' => true,
        'chamados' => $chamados
    ]);
}

function listarChamadosAdmin() {
    if (!verificarAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Acesso negado']);
        return;
    }

    global $conn;

    // Filtros opcionais
    $status = $_GET['status'] ?? null;
    $prioridade = $_GET['prioridade'] ?? null;
    $busca = $_GET['busca'] ?? null;

    $sql = "
        SELECT
            c.id,
            c.titulo,
            c.descricao,
            c.prioridade,
            c.status,
            c.criado_em,
            c.prazo_sla,
            u.nome as usuario_nome,
            u.email as usuario_email,
            (SELECT COUNT(*) FROM comentarios WHERE chamado_id = c.id) as total_comentarios,
            TIMESTAMPDIFF(HOUR, NOW(), c.prazo_sla) as horas_restantes_sla
        FROM chamados c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
    ";

    $params = [];
    $types = "";

    if ($status) {
        $sql .= " AND c.status = ?";
        $params[] = $status;
        $types .= "s";
    }

    if ($prioridade) {
        $sql .= " AND c.prioridade = ?";
        $params[] = $prioridade;
        $types .= "s";
    }

    if ($busca) {
        $sql .= " AND (c.titulo LIKE ? OR c.descricao LIKE ? OR u.nome LIKE ? OR u.email LIKE ?)";
        $busca_param = "%$busca%";
        $params[] = $busca_param;
        $params[] = $busca_param;
        $params[] = $busca_param;
        $params[] = $busca_param;
        $types .= "ssss";
    }

    $sql .= " ORDER BY c.criado_em DESC";

    $stmt = $conn->prepare($sql);

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    $chamados = [];
    while ($row = $result->fetch_assoc()) {
        $chamados[] = $row;
    }

    // Estatísticas
    $stmt_stats = $conn->prepare("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Aberto' THEN 1 ELSE 0 END) as abertos,
            SUM(CASE WHEN status = 'Em Andamento' THEN 1 ELSE 0 END) as em_andamento,
            SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as concluidos,
            SUM(CASE WHEN status = 'Cancelado' THEN 1 ELSE 0 END) as cancelados
        FROM chamados
    ");
    $stmt_stats->execute();
    $stats = $stmt_stats->get_result()->fetch_assoc();

    echo json_encode([
        'success' => true,
        'chamados' => $chamados,
        'estatisticas' => $stats
    ]);
}

function criarChamado() {
    if (!verificarLogin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Não autorizado']);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['titulo']) || !isset($data['descricao'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Título e descrição são obrigatórios']);
        return;
    }

    $titulo = sanitizar($data['titulo']);
    $descricao = sanitizar($data['descricao']);
    $prioridade = sanitizar($data['prioridade'] ?? 'Média');

    if (strlen($titulo) < 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Título deve ter pelo menos 5 caracteres']);
        return;
    }

    if (strlen($descricao) < 10) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Descrição deve ter pelo menos 10 caracteres']);
        return;
    }

    $prioridades_validas = ['Baixa', 'Média', 'Alta', 'Urgente'];
    if (!in_array($prioridade, $prioridades_validas)) {
        $prioridade = 'Média';
    }

    $usuario = obterUsuarioLogado();
    $usuario_id = $usuario['id'];
    $prazo_sla = calcularSLAPrazo($prioridade);

    global $conn;

    $stmt = $conn->prepare("INSERT INTO chamados (usuario_id, titulo, descricao, prioridade, prazo_sla) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("issss", $usuario_id, $titulo, $descricao, $prioridade, $prazo_sla);

    if ($stmt->execute()) {
        $chamado_id = $conn->insert_id;

        echo json_encode([
            'success' => true,
            'message' => 'Chamado criado com sucesso',
            'chamado' => [
                'id' => $chamado_id,
                'titulo' => $titulo,
                'prioridade' => $prioridade,
                'prazo_sla' => $prazo_sla
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao criar chamado']);
    }
}

function atualizarStatusChamado() {
    if (!verificarAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Acesso negado']);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['id']) || !isset($data['status'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID e status são obrigatórios']);
        return;
    }

    $chamado_id = (int) $data['id'];
    $status = sanitizar($data['status']);

    $status_validos = ['Aberto', 'Em Andamento', 'Aguardando Resposta do Cliente', 'Concluído', 'Cancelado'];
    if (!in_array($status, $status_validos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Status inválido']);
        return;
    }

    global $conn;

    $stmt = $conn->prepare("UPDATE chamados SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $status, $chamado_id);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Status atualizado com sucesso'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar status']);
    }
}
?>