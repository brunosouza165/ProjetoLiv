require('dotenv').config();

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Genitor WhatsApp Bot online');
});

app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

const PHONE_NUMBER_PATTERN = /^\d{10,15}$/;

const AUTHORIZED_NUMBER = normalizePhoneNumber(process.env.AUTHORIZED_NUMBER);
const BOT_NAME = process.env.BOT_NAME || 'Genitor';
const ALLOWED_CONTACT = normalizePhoneNumber(process.env.ALLOWED_CONTACT);
const perguntasPendentesBernardo = [];
const mensagensProcessadas = new Set();
const BOT_STARTED_AT = Math.floor(Date.now() / 1000);
const RESPONSE_PONG = 'pong';
const RESPONSE_NO_PENDING = 'Nao ha pergunta pendente para responder.';
const RESPONSE_BERNARDO_OK = 'O Bernardo está bem 😊';
const RESPONSE_SENT = 'Resposta enviada para a pessoa que perguntou.';
const RESPONSE_CHECKING = 'Estou verificando essa informação...';
const RESPONSE_MENU = (
    '📋 Menu Genitor\n\n' +
    '1 - Status\n' +
    '2 - Ajuda\n' +
    '3 - Sobre\n' +
    'Pergunte: Como vai o Bernardo?'
);
const RESPONSE_STATUS = '✅ Sistema online.';
const RESPONSE_HELP = 'Envie "Como vai o Bernardo?" ou digite "menu".';
const RESPONSE_ABOUT = '🤖 Genitor - chatbot privado para WhatsApp.';
const RESPONSE_UNKNOWN = 'Não entendi sua mensagem. Digite "menu".';
const BOT_RESPONSE_TEXTS = new Set([
    RESPONSE_PONG,
    RESPONSE_NO_PENDING,
    RESPONSE_BERNARDO_OK,
    RESPONSE_SENT,
    RESPONSE_CHECKING,
    RESPONSE_MENU,
    RESPONSE_STATUS,
    RESPONSE_HELP,
    RESPONSE_ABOUT,
    RESPONSE_UNKNOWN
].map((text) => text.trim().toLowerCase()));

validateConfig();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

function normalizePhoneNumber(value) {
    return value ? value.replace(/\D/g, '') : '';
}

function getSenderNumber(messageFrom) {
    return normalizePhoneNumber(messageFrom.split('@')[0]);
}

function isValidPhoneNumber(value) {
    return PHONE_NUMBER_PATTERN.test(value);
}

function maskPhoneNumber(value) {
    if (!value) {
        return 'nao configurado';
    }

    if (value.length <= 4) {
        return '*'.repeat(value.length);
    }

    return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

function getMessageId(message) {
    return message.id && message.id._serialized
        ? message.id._serialized
        : `${message.from}:${message.timestamp}:${message.body}`;
}

function getMessageAgeInSeconds(message) {
    return message.timestamp ? Math.floor(Date.now() / 1000) - message.timestamp : 0;
}

function getChatNumber(messageId) {
    return normalizePhoneNumber((messageId || '').split('@')[0]);
}

async function resolvePhoneNumberFromWhatsAppId(messageId) {
    try {
        return await client.pupPage.evaluate(async (id) => {
            const wid = window.require('WAWebWidFactory').createWid(id);

            if (wid.server !== 'lid') {
                return wid.user || '';
            }

            const phoneWid = await window.require('WAWebApiContact').getPhoneNumber(wid);
            return phoneWid ? phoneWid.user || phoneWid._serialized || '' : '';
        }, messageId);
    } catch (error) {
        console.error('Nao foi possivel converter o ID interno em telefone:', error.message);
        return '';
    }
}

async function getSenderIdentifiers(message) {
    const identifiers = new Set([
        getSenderNumber(message.from),
        getChatNumber(message.author)
    ]);

    try {
        const contact = await message.getContact();

        identifiers.add(normalizePhoneNumber(contact.number));
        identifiers.add(normalizePhoneNumber(contact.id && contact.id.user));
        identifiers.add(getChatNumber(contact.id && contact.id._serialized));
    } catch (error) {
        console.error('Nao foi possivel ler os dados do contato:', error.message);
    }

    const resolvedPhone = normalizePhoneNumber(await resolvePhoneNumberFromWhatsAppId(message.author || message.from));
    identifiers.add(resolvedPhone);

    return [...identifiers].filter(Boolean);
}

function validateConfig() {
    if (!isValidPhoneNumber(AUTHORIZED_NUMBER)) {
        console.error('Erro: configure AUTHORIZED_NUMBER no .env usando apenas numeros. Exemplo: 5511999999999');
        process.exit(1);
    }

    if (ALLOWED_CONTACT && !isValidPhoneNumber(ALLOWED_CONTACT)) {
        console.error('Erro: configure ALLOWED_CONTACT no .env usando apenas numeros, ou deixe vazio.');
        process.exit(1);
    }
}

function isBotResponseText(text) {
    return BOT_RESPONSE_TEXTS.has(text);
}

client.on('qr', (qr) => {
    console.log('\nEscaneie este QR Code com o WhatsApp:');
    console.log('Android: WhatsApp > 3 pontinhos > Aparelhos conectados > Conectar aparelho');
    console.log('iPhone: WhatsApp > Configurações > Aparelhos conectados > Conectar aparelho\n');

    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`🤖 ${BOT_NAME} está online!`);
    console.log(`Numero autorizado: ${maskPhoneNumber(AUTHORIZED_NUMBER)} (${AUTHORIZED_NUMBER.length} digitos)`);
    console.log(`Contato permitido: ${maskPhoneNumber(ALLOWED_CONTACT)} (${ALLOWED_CONTACT.length || 0} digitos)`);
});

client.on('authenticated', () => {
    console.log('WhatsApp autenticado com sucesso.');
});

client.on('auth_failure', (message) => {
    console.error('Falha de autenticacao no WhatsApp:', message);
});

client.on('disconnected', (reason) => {
    console.error('Cliente desconectado do WhatsApp:', reason);
});

client.on('loading_screen', (percent, message) => {
    console.log(`Carregando WhatsApp: ${percent}% - ${message}`);
});

client.on('change_state', (state) => {
    console.log(`Estado do WhatsApp: ${state}`);
});

async function processMessage(message, eventName) {
    const messageId = getMessageId(message);
    const rawFrom = getChatNumber(message.from);
    const to = getChatNumber(message.to);
    const author = getChatNumber(message.author);
    const age = getMessageAgeInSeconds(message);

    if (mensagensProcessadas.has(messageId)) {
        return;
    }

    mensagensProcessadas.add(messageId);

    if (message.timestamp && message.timestamp < BOT_STARTED_AT) {
        console.log(
            `Mensagem antiga ignorada em ${eventName}: ` +
            `from=${maskPhoneNumber(rawFrom)}, to=${maskPhoneNumber(to)}, author=${maskPhoneNumber(author)}, idade=${age}s.`
        );
        return;
    }

    // Ignora mensagens de grupos
    if (message.from.endsWith('@g.us')) {
        console.log(
            `Mensagem detectada em ${eventName}, mas ignorada porque veio de grupo. ` +
            `grupo=${message.from}, author=${maskPhoneNumber(author)}.`
        );
        return;
    }

    const senderIdentifiers = await getSenderIdentifiers(message);
    const sender = senderIdentifiers[0] || rawFrom;
    const text = (message.body || '').trim().toLowerCase();

    if (message.fromMe && isBotResponseText(text)) {
        console.log(`Resposta automatica descartada em ${eventName} para evitar loop.`);
        return;
    }

    if (senderIdentifiers.some((identifier) => identifier !== rawFrom)) {
        console.log(
            `Identificadores do remetente: ` +
            senderIdentifiers.map((identifier) => maskPhoneNumber(identifier)).join(', ')
        );
    }

    // Se ALLOWED_CONTACT está configurado, ignora mensagens de outros contatos
    const isAllowedSender = senderIdentifiers.includes(ALLOWED_CONTACT) || senderIdentifiers.includes(AUTHORIZED_NUMBER);

    if (ALLOWED_CONTACT && !isAllowedSender) {
        console.log(
            `Mensagem ignorada: contato nao permitido. ` +
            `Recebido=${senderIdentifiers.map((identifier) => maskPhoneNumber(identifier)).join(', ') || 'sem identificador'}. ` +
            `Esperado ALLOWED_CONTACT=${maskPhoneNumber(ALLOWED_CONTACT)} ou AUTHORIZED_NUMBER=${maskPhoneNumber(AUTHORIZED_NUMBER)}.`
        );
        return;
    }

    console.log(`Mensagem recebida de ${maskPhoneNumber(sender)}: ${text || '[sem texto]'}`);

    if (text === 'ping') {
        await message.reply(RESPONSE_PONG);
        return;
    }

    // Se a usuária autorizada responder OK, o bot responde para quem perguntou.
    if (
        senderIdentifiers.includes(AUTHORIZED_NUMBER) &&
        text === 'ok'
    ) {
        const contatoPendente = perguntasPendentesBernardo.shift();

        if (!contatoPendente) {
            await message.reply(RESPONSE_NO_PENDING);
            return;
        }

        await client.sendMessage(contatoPendente, RESPONSE_BERNARDO_OK);

        await message.reply(RESPONSE_SENT);
        return;
    }

    // Pergunta principal
    if (text.includes('como vai o bernardo')) {
        perguntasPendentesBernardo.push(message.from);

        await message.reply(RESPONSE_CHECKING);

        await client.sendMessage(
            `${AUTHORIZED_NUMBER}@c.us`,
            `Perguntaram: "Como vai o Bernardo?"\nContato: ${sender}\n\nResponda com OK para confirmar.`
        );

        return;
    }

    // Respostas básicas
    if (text === 'menu') {
        await message.reply(RESPONSE_MENU);
        return;
    }

    if (text === '1') {
        await message.reply(RESPONSE_STATUS);
        return;
    }

    if (text === '2') {
        await message.reply(RESPONSE_HELP);
        return;
    }

    if (text === '3') {
        await message.reply(RESPONSE_ABOUT);
        return;
    }

    await message.reply(RESPONSE_UNKNOWN);
}

client.on('message', async (message) => {
    await processMessage(message, 'message');
});

client.on('message_create', async (message) => {
    await processMessage(message, 'message_create');
});

async function startClient() {
    try {
        await client.initialize();
    } catch (error) {
        console.error('Erro ao iniciar o bot:', error.message);
        process.exit(1);
    }
}

startClient();
