<?php

//conexão com o banco de dados
require_once('conexao.php');

//alerta
$mensagem = "";

//verifica se o formulário foi enviado
if ($_SERVER["REQUEST_METHOD"] == "POST"){

    $nome      = $_POST['nome'];
    $email     = $_POST['email'];
    $senha     = $_POST['senha'];

    //verifica se o email existe
    $verifica = mysqli_query($conexao, "SELECT * FROM USUARIOS WHERE EMAIL = '$email'");

    if (mysqli_num_rows($verifica) > 0){
        $mensagem = "E-mail já cadastrado!";
    } else {

        //criptografa a senha
        $senhaHash = password_hash($senha, PASSWORD_DEFAULT);
        
        //insere no banco
        $sql = "INSERT INTO USUARIOS (NOME, EMAIL, SENHA) VALUES ('$nome', '$email', '$senhaHash')";

        //verifica se usuario foi cadastrado
        if (mysqli_query($conexao, $sql)){

            header("Location: login.php");
            exit();

        } else {
            $mensagem = "Erro ao cadastrar!";
        }    
        
    }
}

?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="css/cadastro.css">
    <title>HelpDesk Pro</title>
</head>
<body>
    <div class="cadastro">
        <header class="cabecalho_cadastro">
            <div>
                <h2>HelpDesk Pro</h2>
                <p>Sistema de Gerenciamento de Chamados</p>
            </div>
        </header>

        <main class="corpo_cadastro">
            <div class="titulo_cadastro">
                <h2>Crie sua conta</h2>
            </div>

            <?php if (!empty($mensagem)): ?>
                <div class="alerta">
                    <?= $mensagem ?>
                </div>
            <?php endif; ?>

            <form class="form_cadastro" action="cadastro.php" method="POST">
                 <div class="campo">
                    <label for="nome">Nome Completo</label>
                    <input type="text" id="nome" name="nome" placeholder="Seu nome completo" required>
                </div>

                <div class="campo">
                    <label for="email">E-mail</label>
                    <input type="email" id="email" name="email" placeholder="seu@email.com" required>
                </div>

                <div class="campo">
                    <label for="password">Senha</label>
                    <input type="password" id="senha" name="senha" placeholder="**********" required>
                </div>

                <button type="submit">Cadastrar</button>

            </form>

            <div class="login">
                <p>Já tem uma conta ? <a href="login.php">Faça login</a></p>
            </div>
        </main>
    </div>

    <footer class="rodape_cadastro">
        <p>© 2026 Sistema de Help Desk. Todos os direitos reservados.</p>
    </footer>
</body>
</html>