<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

//conexão com o banco de dados
require_once('conexao.php');

//alerta
$mensagem = "";

//verifica se o formulário foi enviado
if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $email = $_POST['email'];
    $senha = $_POST['senha'];

    $stmt = $conexao->prepare("SELECT ID_USUARIO, NOME, EMAIL, SENHA, TIPO FROM USUARIOS WHERE EMAIL = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();

    $resultado = $stmt->get_result();

    //verifica se o email existe
    if ($resultado->num_rows > 0) {

        $usuario = $resultado->fetch_assoc();

        //verifica a senha
        if (password_verify($senha, $usuario['SENHA'])) {

            $_SESSION['usuario_id'] = $usuario['ID_USUARIO'];
            $_SESSION['usuario_nome'] = $usuario['NOME'];
            $_SESSION['usuario_tipo'] = $usuario['TIPO'];
            $_SESSION['usuario_email'] = $usuario['EMAIL'];

            $tipo_lower = strtolower($usuario['TIPO'] ?? '');
            $destino = ($tipo_lower === 'admin' || $tipo_lower === 'adm') ? '../admin.html' : '../index.html';
            
            $usr_json = json_encode([
                'id' => $usuario['ID_USUARIO'],
                'nome' => $usuario['NOME'],
                'email' => $usuario['EMAIL'],
                'tipo' => $usuario['TIPO']
            ]);

            echo "<script>
                    localStorage.setItem('usuario', JSON.stringify($usr_json));
                    window.location.href = '$destino';
                  </script>";
            exit();

        } else {
            $mensagem = "Senha incorreta !";
        }

    } else {
        $mensagem = "E-mail não cadastrado !";
    }
}
?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
    <link rel="stylesheet" href="css/login.css">
    <title>HelpDesk Pro</title>
</head>
<body>
    <div class="login">
        <div class="login_box">

            <header class="cabecalho_login">
                <div>
                    <h2>HelpDesk Pro</h2>
                    <p>Sistema de Gerenciamento de Chamados</p>
                </div>
            </header>
            
            <main class="corpo_login">
                <div class="titulo_login">
                    <h2>Acesse sua conta</h2>
                </div>

                <?php if (!empty($mensagem)): ?>
                    <div class="alerta">
                        <?= $mensagem ?>
                    </div>
                <?php endif; ?>
            
                <form class="form_login" action="login.php" method="POST">
                    <div class="campo">
                        <label for="email">E-mail</label>
                        <input type="email" id="email" name="email" placeholder="seu@email.com" required>
                    </div>
                    <div class="campo">
                        <label for="password">Senha</label>
                        <input type="password" id="senha" name="senha" placeholder="**********" required>
                    </div>
                    <div class="recuperar_senha">
                        <a href="">Recuperar Senha</a>
                    </div>
                    <button type="submit">Entrar</button>
                </form>
                <div class="novo_cadastro">
                    <p>Não tem uma conta ? <a href="cadastro.php">Cadastre-se</a></p>
                </div>
            </main>

        </div>
    </div>

    <footer class="rodape_login">
        <p>© 2026 HelpDesk Pro. Suporte técnico disponível 24/7</p>
    </footer>
</body>
</html>