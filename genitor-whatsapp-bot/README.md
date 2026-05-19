# Genitor WhatsApp Bot

Chatbot para WhatsApp usando Node.js e `whatsapp-web.js`.

## Como funciona

Quando alguém perguntar:

```text
Como vai o Bernardo?
```

O bot responde:

```text
Estou verificando essa informação...
```

Depois envia uma mensagem para a usuária autorizada:

```text
Perguntaram: "Como vai o Bernardo?"

Responda com OK para confirmar.
```

Quando a usuária responder:

```text
ok
```

O bot envia para quem perguntou:

```text
O Bernardo está bem 😊
```

## Instalação no Zorin OS / Linux

Instale Node.js, npm e Git:

```bash
sudo apt update
sudo apt install nodejs npm git -y
```

Entre na pasta do projeto:

```bash
cd genitor-whatsapp-bot
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
nano .env
```

Edite o número autorizado:

```env
AUTHORIZED_NUMBER=5511999999999
```

Use o formato:

```text
55 + DDD + número
```

Sem `+`, sem espaços e sem traços.

## Rodar o bot

```bash
npm start
```

## Conectar no WhatsApp do iPhone

No iPhone:

1. Abra o WhatsApp
2. Toque em **Configurações**
3. Toque em **Aparelhos conectados**
4. Toque em **Conectar aparelho**
5. Escaneie o QR Code que apareceu no terminal do Linux

Depois disso, o bot ficará conectado ao WhatsApp enquanto o computador estiver ligado e o processo estiver rodando.

## Observação importante

Esse projeto usa WhatsApp Web. Ele não roda dentro do iPhone.  
O iPhone serve para escanear o QR Code e autorizar a sessão.
