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

function calcularSLAInfo($prioridade, $criado_em) {
    $criado = new DateTime($criado_em);
    switch (strtolower($prioridade)) {
        case 'urgente':
            $interval = 'PT4H';
            break;
        case 'alta':
            $interval = 'PT12H';
            break;
        case 'media':
            $interval = 'PT24H';
            break;
        default:
            $interval = 'PT72H';
            break;
    }

    $prazo = clone $criado;
    $prazo->add(new DateInterval($interval));
    $agora = new DateTime();
    $horas_restantes = ($prazo->getTimestamp() - $agora->getTimestamp()) / 3600;

    return [
        'prazo_sla' => $prazo->format('Y-m-d H:i:s'),
        'horas_restantes_sla' => round($horas_restantes, 2)
    ];
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
            c.ID_CHAMADO as id,
            c.TITULO as titulo,
            c.DESCRICAO as descricao,
            c.PRIORIDADE as prioridade,
            c.STATUS_CHAMADO as status,
            c.CRIADO_EM as criado_em,
            u.NOME as usuario_nome,
            (SELECT COUNT(*) FROM INTERACAO WHERE CHAMADO_ID = c.ID_CHAMADO) as total_comentarios
        FROM chamados c
        JOIN USUARIOS u ON c.USUARIO_ID = u.ID_USUARIO
        WHERE c.USUARIO_ID = ?
        ORDER BY c.CRIADO_EM DESC
    ");
    $stmt->bind_param("i", $usuario_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $chamados = [];
    while ($row = $result->fetch_assoc()) {
        $sla = calcularSLAInfo($row['prioridade'], $row['criado_em']);
        $chamados[] = array_merge($row, $sla);
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
            c.ID_CHAMADO as id,
            c.TITULO as titulo,
            c.DESCRICAO as descricao,
            c.PRIORIDADE as prioridade,
            c.STATUS_CHAMADO as status,
            c.CRIADO_EM as criado_em,
            u.NOME as usuario_nome,
            u.EMAIL as usuario_email,
            (SELECT COUNT(*) FROM INTERACAO WHERE CHAMADO_ID = c.ID_CHAMADO) as total_comentarios
        FROM chamados c
        JOIN USUARIOS u ON c.USUARIO_ID = u.ID_USUARIO
        WHERE 1=1
    ";

    $params = [];
    $types = "";

    if ($status) {
        $sql .= " AND c.STATUS_CHAMADO = ?";
        $params[] = $status;
        $types .= "s";
    }

    if ($prioridade) {
        $sql .= " AND c.PRIORIDADE = ?";
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
        $sla = calcularSLAInfo($row['prioridade'], $row['criado_em']);
        $chamados[] = array_merge($row, $sla);
    }

    // Estatísticas
    $stmt_stats = $conn->prepare("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN STATUS_CHAMADO = 'aberto' THEN 1 ELSE 0 END) as abertos,
            SUM(CASE WHEN STATUS_CHAMADO = 'andamento' THEN 1 ELSE 0 END) as em_andamento,
            SUM(CASE WHEN STATUS_CHAMADO = 'fechado' THEN 1 ELSE 0 END) as concluidos
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

    $prioridades_validas = ['baixa', 'media', 'alta', 'urgente'];
    if (!in_array($prioridade, $prioridades_validas)) {
        $prioridade = 'media';
    }

    $usuario = obterUsuarioLogado();
    $usuario_id = $usuario['id'];

    global $conn;

    $stmt = $conn->prepare("INSERT INTO chamados (TITULO, DESCRICAO, PRIORIDADE, STATUS_CHAMADO, USUARIO_ID) VALUES (?, ?, ?, 'aberto', ?)");
    $stmt->bind_param("sssi", $titulo, $descricao, $prioridade, $usuario_id);

    if ($stmt->execute()) {
        $chamado_id = $conn->insert_id;

        echo json_encode([
            'success' => true,
            'message' => 'Chamado criado com sucesso',
            'chamado' => [
                'id' => $chamado_id,
                'titulo' => $titulo,
                'prioridade' => $prioridade
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

    $status_validos = ['aberto', 'andamento', 'fechado'];
    if (!in_array($status, $status_validos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Status inválido']);
        return;
    }

    global $conn;

    $stmt = $conn->prepare("UPDATE chamados SET STATUS_CHAMADO = ?, ATUALIZADO_EM = NOW() WHERE ID_CHAMADO = ?");
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