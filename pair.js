const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function EypzPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let EypzPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!EypzPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await EypzPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            EypzPairWeb.ev.on('creds.update', saveCreds);
            EypzPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionEypz = fs.readFileSync('./session/creds.json');

                        const auth_path = './session/';
                        const user_jid = jidNormalizedUser(EypzPairWeb.user.id);

                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${user_jid}.json`);

                        const string_session = mega_url.replace('https://mega.nz/file/', '');

                        const sid = `izumi~${string_session}`;

                        const dt = await EypzPairWeb.sendMessage(user_jid, {
                            text: sid
                        });

                    } catch (e) {
                        exec('pm2 restart eypz');
                    }

                    await delay(100);
                    return await removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    EypzPair();
                }
            });
        } catch (err) {
            exec('pm2 restart eypz-md');
            console.log("service restarted");
            EypzPair();
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }
    return await EypzPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart eypz');
});

module.exports = router;
