@echo off
echo ========================================
echo  Stumble Born - Bot Discord Setup
echo ========================================
echo.

echo [1/3] Instalando dependencias do npm...
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias
    pause
    exit /b 1
)
echo.

echo [2/3] Verificando arquivo .env...
if not exist ".env" (
    echo ERRO: Arquivo .env nao encontrado!
    echo Por favor, configure o arquivo .env com:
    echo   - DISCORD_TOKEN
    echo   - DISCORD_CLIENT_ID
    pause
    exit /b 1
)

findstr /C:"DISCORD_TOKEN=SEU_TOKEN_AQUI" .env >nul
if %errorlevel% equ 0 (
    echo AVISO: Token do Discord ainda nao foi configurado!
    echo Edite o arquivo .env e adicione seu token.
    pause
    exit /b 1
)

echo Token do Discord configurado!
echo.

echo [3/3] Iniciando servidor com bot...
echo.
echo ========================================
echo  Servidor iniciando...
echo ========================================
echo.

node index.js

pause
