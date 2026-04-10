<?php
// Arquivo de teste para verificar se o PHP e MySQL estão funcionando
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Incluir conexão
    require_once '../conexao.php';

    // Testar conexão com banco
    $stmt = $conn->prepare("SELECT 1 as test");
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    // Verificar se as tabelas existem
    $tables = ['usuarios', 'chamados', 'comentarios'];
    $tables_exist = [];

    foreach ($tables as $table) {
        $stmt = $conn->prepare("SHOW TABLES LIKE ?");
        $stmt->bind_param("s", $table);
        $stmt->execute();
        $result = $stmt->get_result();
        $tables_exist[$table] = $result->num_rows > 0;
    }

    // Contar registros em cada tabela
    $counts = [];
    foreach ($tables as $table) {
        if ($tables_exist[$table]) {
            $stmt = $conn->prepare("SELECT COUNT(*) as count FROM $table");
            $stmt->execute();
            $result = $stmt->get_result();
            $counts[$table] = $result->fetch_assoc()['count'];
        } else {
            $counts[$table] = 0;
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Sistema funcionando corretamente',
        'php_version' => phpversion(),
        'mysql_connected' => true,
        'database' => 'helpdesk',
        'tables_exist' => $tables_exist,
        'table_counts' => $counts,
        'session_enabled' => session_status() === PHP_SESSION_ACTIVE,
        'timestamp' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro no sistema: ' . $e->getMessage(),
        'php_version' => phpversion(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>