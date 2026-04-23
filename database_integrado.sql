-- Script SQL integrado para o sistema de helpdesk
-- Combinação do banco.sql legado e helpdesk.sql atualizado
-- Execute este script no phpMyAdmin ou MySQL Workbench

-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS HELPDESK_PRO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE HELPDESK_PRO;

-- Tabela de usuários (baseado no banco.sql, corrigido para consistência)
CREATE TABLE IF NOT EXISTS USUARIOS (
    ID_USUARIO INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    NOME VARCHAR(150) NOT NULL,
    EMAIL VARCHAR(150) UNIQUE NOT NULL,
    SENHA VARCHAR(255) NOT NULL,
    TIPO ENUM('user','admin') NOT NULL DEFAULT 'user',
    CRIADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de chamados (do banco.sql, com ajustes)
CREATE TABLE IF NOT EXISTS chamados (
    ID_CHAMADO INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    TITULO VARCHAR(200) NOT NULL,
    DESCRICAO TEXT NOT NULL,
    PRIORIDADE ENUM('baixa','media','alta','urgente') NOT NULL,
    STATUS_CHAMADO ENUM('aberto','andamento','fechado') NOT NULL DEFAULT 'aberto',
    USUARIO_ID INT NOT NULL,
    ADMIN_ID INT,
    CRIADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP,
    ATUALIZADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(USUARIO_ID) REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE,
    FOREIGN KEY(ADMIN_ID) REFERENCES USUARIOS(ID_USUARIO) ON DELETE SET NULL
);

-- Tabela de interações (comentários) (do banco.sql, com ajustes)
CREATE TABLE IF NOT EXISTS INTERACAO (
    ID_INTERACAO INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    USUARIO_ID INT NOT NULL,
    CHAMADO_ID INT NOT NULL,
    MENSAGEM TEXT NOT NULL,
    CRIADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP,
    ATUALIZADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(USUARIO_ID) REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE,
    FOREIGN KEY(CHAMADO_ID) REFERENCES chamados(ID_CHAMADO) ON DELETE CASCADE
);

-- Inserir usuário administrador padrão
INSERT IGNORE INTO USUARIOS (NOME, EMAIL, SENHA, TIPO) VALUES (
    'Administrador TI',
    'adm.ti@empresa.com',
    '$2y$10$3VM5oCN8tLZcKuHe5FXAR.4PirvDEFI1jEk1j3mMPIQDZ3LALnHIO', -- senha: admin123
    'admin'
);

-- Inserir alguns usuários de teste
INSERT IGNORE INTO USUARIOS (NOME, EMAIL, SENHA, TIPO) VALUES
('João Silva', 'joao.silva@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Maria Santos', 'maria.santos@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user');

-- Inserir chamados de exemplo
INSERT IGNORE INTO chamados (TITULO, DESCRICAO, PRIORIDADE, STATUS_CHAMADO, USUARIO_ID) VALUES
('Problema com impressora', 'A impressora da sala 101 não está funcionando. Aparece erro de toner.', 'media', 'aberto', 2),
('Sistema lento', 'O computador está muito lento, principalmente no Excel.', 'alta', 'andamento', 2),
('Email não funciona', 'Não consigo enviar emails, aparece erro de autenticação.', 'urgente', 'aberto', 3);

-- Inserir interações de exemplo
INSERT IGNORE INTO INTERACAO (USUARIO_ID, CHAMADO_ID, MENSAGEM) VALUES
(1, 1, 'Vou verificar o status do toner e fazer a reposição se necessário.'),
(1, 2, 'Verifiquei o computador. Há muitos programas desnecessários instalados. Vou otimizar o sistema.'),
(1, 3, 'Problema identificado: senha do email expirou. Já resolvi e configurei para não expirar novamente.');