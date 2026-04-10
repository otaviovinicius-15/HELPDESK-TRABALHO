-- Script SQL para o sistema de helpdesk
-- Execute este script no phpMyAdmin ou MySQL Workbench

-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS helpdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE helpdesk;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo ENUM('usuario', 'admin') DEFAULT 'usuario',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_tipo (tipo)
);

-- Tabela de chamados
CREATE TABLE IF NOT EXISTS chamados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT NOT NULL,
    prioridade ENUM('Baixa', 'Média', 'Alta', 'Urgente') DEFAULT 'Média',
    status ENUM('Aberto', 'Em Andamento', 'Aguardando Resposta do Cliente', 'Concluído', 'Cancelado') DEFAULT 'Aberto',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prazo_sla DATETIME NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_status (status),
    INDEX idx_prioridade (prioridade),
    INDEX idx_criado_em (criado_em)
);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chamado_id INT NOT NULL,
    usuario_email VARCHAR(150) NOT NULL,
    texto TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE,
    INDEX idx_chamado (chamado_id),
    INDEX idx_criado_em (criado_em)
);

-- Inserir usuário administrador padrão
INSERT IGNORE INTO usuarios (nome, email, senha, tipo) VALUES (
    'Administrador TI',
    'adm.ti@empresa.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- senha: admin123
    'admin'
);

-- Inserir alguns usuários de teste
INSERT IGNORE INTO usuarios (nome, email, senha, tipo) VALUES
('João Silva', 'joao.silva@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'usuario'),
('Maria Santos', 'maria.santos@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'usuario');

-- Inserir chamados de exemplo
INSERT IGNORE INTO chamados (usuario_id, titulo, descricao, prioridade, status, prazo_sla) VALUES
(2, 'Problema com impressora', 'A impressora da sala 101 não está funcionando. Aparece erro de toner.', 'Média', 'Aberto', DATE_ADD(NOW(), INTERVAL 24 HOUR)),
(2, 'Sistema lento', 'O computador está muito lento, principalmente no Excel.', 'Alta', 'Em Andamento', DATE_ADD(NOW(), INTERVAL 12 HOUR)),
(3, 'Email não funciona', 'Não consigo enviar emails, aparece erro de autenticação.', 'Urgente', 'Aberto', DATE_ADD(NOW(), INTERVAL 4 HOUR));

-- Inserir comentários de exemplo
INSERT IGNORE INTO comentarios (chamado_id, usuario_email, texto) VALUES
(1, 'adm.ti@empresa.com', 'Vou verificar o status do toner e fazer a reposição se necessário.'),
(2, 'adm.ti@empresa.com', 'Verifiquei o computador. Há muitos programas desnecessários instalados. Vou otimizar o sistema.'),
(3, 'adm.ti@empresa.com', 'Problema identificado: senha do email expirou. Já resolvi e configurei para não expirar novamente.');

-- Stored procedure para calcular estatísticas (opcional)
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS sp_estatisticas_chamados()
BEGIN
    SELECT
        COUNT(*) as total_chamados,
        SUM(CASE WHEN status = 'Aberto' THEN 1 ELSE 0 END) as abertos,
        SUM(CASE WHEN status = 'Em Andamento' THEN 1 ELSE 0 END) as em_andamento,
        SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as concluidos,
        SUM(CASE WHEN status = 'Cancelado' THEN 1 ELSE 0 END) as cancelados,
        AVG(CASE WHEN status = 'Concluído' THEN TIMESTAMPDIFF(HOUR, criado_em, NOW()) ELSE NULL END) as tempo_medio_horas
    FROM chamados;
END //

DELIMITER ;

-- Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_chamados_status_prioridade ON chamados (status, prioridade);
CREATE INDEX IF NOT EXISTS idx_comentarios_chamado_data ON comentarios (chamado_id, criado_em);