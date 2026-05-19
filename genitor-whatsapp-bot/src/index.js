require('dotenv').config();

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const AUTHORIZED_NUMBER = process.env.AUTHORIZED_NUMBER;
const BOT_NAME = process.env.BOT_NAME || 'Genitor';
const ALLOWED_CONTACT = process.env.ALLOWED_CONTACT;

let aguardandoRespostaBernardo = false;
let ultimoContato = null;

client.on('qr', (qr) => {
    console.log('\nEscaneie este QR Code com o WhatsApp:');
    console.log('Android: WhatsApp > 3 pontinhos > Aparelhos conectados > Conectar aparelho');
    console.log('iPhone: WhatsApp > Configurações > Aparelhos conectados > Conectar aparelho\n');

    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`🤖 ${BOT_NAME} está online!`);
});

client.on('message', async (message) => {
    // Ignora mensagens de grupos
    if (message.from.endsWith('@g.us')) {
        return;
    }

    const sender = message.from.replace('@c.us', '');
    const text = message.body.trim().toLowerCase();

    // Se ALLOWED_CONTACT está configurado, ignora mensagens de outros contatos
    if (ALLOWED_CONTACT && sender !== ALLOWED_CONTACT && sender !== AUTHORIZED_NUMBER) {
        return;
    }

    // Se a usuária autorizada responder OK, o bot responde para quem perguntou.
    if (
        sender === AUTHORIZED_NUMBER &&
        aguardandoRespostaBernardo &&
        text === 'ok'
    ) {
        await client.sendMessage(ultimoContato, 'O Bernardo está bem 😊');

        aguardandoRespostaBernardo = false;
        ultimoContato = null;

        await message.reply('Resposta enviada para a pessoa que perguntou.');
        return;
    }

    // Pergunta principal
    if (text.includes('como vai o bernardo')) {
        ultimoContato = message.from;
        aguardandoRespostaBernardo = true;

        await message.reply('Estou verificando essa informação...');

        await client.sendMessage(
            `${AUTHORIZED_NUMBER}@c.us`,
            'Perguntaram: "Como vai o Bernardo?"\n\nResponda com OK para confirmar.'
        );

        return;
    }

    // Respostas básicas
    if (text === 'menu') {
        await message.reply(
            '📋 Menu Genitor\n\n' +
            '1 - Status\n' +
            '2 - Ajuda\n' +
            '3 - Sobre\n' +
            'Pergunte: Como vai o Bernardo?'
        );
        return;
    }

    if (text === '1') {
        await message.reply('✅ Sistema online.');
        return;
    }

    if (text === '2') {
        await message.reply('Envie "Como vai o Bernardo?" ou digite "menu".');
        return;
    }

    if (text === '3') {
        await message.reply('🤖 Genitor - chatbot privado para WhatsApp.');
        return;
    }

    await message.reply('Não entendi sua mensagem. Digite "menu".');

});

client.initialize();
