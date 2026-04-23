<?php

session_start(); //incia sessão

// Verificar se o usuário está logado
if (!isset($_SESSION["id_usuario"])) {
    header("Location: login.php");
    exit;
}

