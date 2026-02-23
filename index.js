// ---------------------- IMPORTS ----------------------
const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys");
const fs = require("fs");
const QRCode = require("qrcode");
const axios = require("axios");
const ytdl = require("ytdl-core");

// ---------------------- ENV VARIABLES ----------------------
const OWNER = process.env.OWNER;               // Your WhatsApp number
const API_KEY = process.env.FOOTBALL_API_KEY; // For EPL

// ---------------------- SESSIONS STORAGE ----------------------
// sessions.json will store all user session info
const SESSIONS_FILE = "sessions.json";
let sessions = {};

// Load sessions if exists
if (fs.existsSync(SESSIONS_FILE)) {
  sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
}

// Save sessions to file
function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// ---------------------- START BOT ----------------------
async function startBot() {
  for (const username in sessions) {
    // Load existing session
    const { state, saveCreds } = await useSingleFileAuthState(`auth-${username}.json`);
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      if (update.qr) {
        const dataUrl = await QRCode.toDataURL(update.qr);
        console.log(`QR for ${username}: ${dataUrl}`);
      }
      if (update.connection === "open") console.log(`✅ ${username} connected`);
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      if (!text.startsWith("!")) return;
      const args = text.split(" ");
      const cmd = args[0].toLowerCase();

      // ---------------------- ADD NEW USER ----------------------
      if (cmd === "!addme") {
        const newUser = args[1];
        if (!newUser) return sock.sendMessage(from, { text: "Use: !addme <username>" });
        if (sessions[newUser]) return sock.sendMessage(from, { text: "⚠️ Session already exists." });

        sessions[newUser] = {}; // placeholder for session
        saveSessions();

        const { state: userState, saveCreds: saveUserCreds } = await useSingleFileAuthState(`auth-${newUser}.json`);
        const userSock = makeWASocket({ auth: userState });

        userSock.ev.on("creds.update", saveUserCreds);

        userSock.ev.on("connection.update", async (update2) => {
          if (update2.qr) {
            const dataUrl = await QRCode.toDataURL(update2.qr);
            await sock.sendMessage(from, {
              text: `📌 Scan this QR on your WhatsApp app to connect`,
              footer: "Open on your phone",
              templateButtons: [
                { urlButton: { displayText: "Open QR on Phone", url: dataUrl } }
              ]
            });
          }
          if (update2.connection === "open") {
            await sock.sendMessage(from, { text: `✅ ${newUser} session connected!` });
            sessions[newUser] = { connected: true };
            saveSessions();
          }
        });
      }

      // ---------------------- MENU ----------------------
      if (cmd === "!menu") {
        const menu = `
🤖 WHATSAPP BOT ULTRA
!menu
!song <youtube link>
!video <youtube link>
!tiktok <link>
!epl
!joke
!quote
!sticker
!kick @user
!promote @user
!demote @user
!broadcast <text>
!addme <username>
        `;
        await sock.sendMessage(from, { text: menu });
      }

      // ---------------------- SONG ----------------------
      if (cmd === "!song") {
        const url = args[1];
        if (!url) return sock.sendMessage(from, { text: "Send YouTube link" });
        try {
          const file = "song.mp3";
          ytdl(url, { filter: "audioonly" }).pipe(fs.createWriteStream(file)).on("finish", async () => {
            await sock.sendMessage(from, { audio: fs.readFileSync(file), mimetype: "audio/mp4" });
            fs.unlinkSync(file);
          });
        } catch {
          await sock.sendMessage(from, { text: "Error downloading song" });
        }
      }

      // ---------------------- VIDEO ----------------------
      if (cmd === "!video") {
        const url = args[1];
        if (!url) return sock.sendMessage(from, { text: "Send YouTube link" });
        try {
          const file = "video.mp4";
          ytdl(url, { quality: "18" }).pipe(fs.createWriteStream(file)).on("finish", async () => {
            await sock.sendMessage(from, { video: fs.readFileSync(file) });
            fs.unlinkSync(file);
          });
        } catch {
          await sock.sendMessage(from, { text: "Error downloading video" });
        }
      }

      // ---------------------- Other commands like !tiktok, !epl, !joke, !quote, !sticker, group mods can be added here ----------------------
    });
  }
}

// ---------------------- RUN BOT ----------------------
startBot();