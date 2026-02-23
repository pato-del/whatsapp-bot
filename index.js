// ---------------------- IMPORTS ----------------------
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const ytdl = require("ytdl-core");
const fs = require("fs");

// ---------------------- SETTINGS ----------------------
const OWNER = "254XXXXXXXXX@s.whatsapp.net"; // your WhatsApp number
let sessions = ["owner"]; // initial sessions

// ---------------------- BOT FUNCTION ----------------------
async function startBot() {
  for (const name of sessions) {
    const { state, saveCreds } = await useMultiFileAuthState(`auth-${name}`);
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      if (update.connection === "open") console.log(`✅ ${name} connected`);
      if (update.connection === "close") console.log(`❌ ${name} disconnected`);
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      const isGroup = from.endsWith("@g.us");

      if (!text.startsWith("!")) return;

      const args = text.split(" ");
      const cmd = args[0].toLowerCase();

      // ---------------------- OWNER ----------------------
      if (cmd === "!broadcast" && msg.key.participant === OWNER) {
        const textMsg = args.slice(1).join(" ");
        await sock.sendMessage(from, { text: textMsg });
      }

      // ---------------------- ADD USER SESSION ----------------------
      if (cmd === "!addme") {
        const newUser = args[1];
        if (!newUser) return sock.sendMessage(from, { text: "Send username: !addme <username>" });
        if (!sessions.includes(newUser)) {
          sessions.push(newUser);
          startBot(); // starts session for new user
          await sock.sendMessage(from, { text: `✅ Session created for ${newUser}. Scan QR in logs.` });
        } else {
          await sock.sendMessage(from, { text: "⚠️ Session already exists." });
        }
      }

      // ---------------------- MENU ----------------------
      if (cmd === "!menu") {
        const menu = `
🤖 WHATSAPP BOT ULTRA

📌 GENERAL
!menu
!ping
!alive

🎵 DOWNLOAD
!song <youtube link>
!video <youtube link>
!tiktok <link>

⚽ SPORTS
!epl

😂 FUN
!joke
!quote

🖼️ MEDIA
!sticker (reply image)

👥 GROUP
!kick @user
!promote @user
!demote @user

👑 OWNER
!broadcast <text>
!addme <username>
        `;
        await sock.sendMessage(from, { text: menu });
      }

      // ---------------------- PING / ALIVE ----------------------
      if (cmd === "!ping") await sock.sendMessage(from, { text: "🏓 Pong!" });
      if (cmd === "!alive") await sock.sendMessage(from, { text: "✅ Bot is running" });

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

      // ---------------------- TIKTOK ----------------------
      if (cmd === "!tiktok") {
        const url = args[1];
        if (!url) return sock.sendMessage(from, { text: "Send TikTok link" });
        try {
          const api = await axios.get(`https://tikwm.com/api/?url=${url}`);
          const video = api.data.data.play;
          await sock.sendMessage(from, { video: { url: video } });
        } catch {
          await sock.sendMessage(from, { text: "Error downloading TikTok" });
        }
      }

      // ---------------------- EPL ----------------------
      if (cmd === "!epl") {
        try {
          const res = await axios.get("https://api.football-data.org/v4/competitions/PL/standings", {
            headers: { "X-Auth-Token": "YOUR_API_KEY" },
          });
          const table = res.data.standings[0].table;
          let txt = "🏆 EPL Table\n\n";
          table.slice(0, 10).forEach((t) => (txt += `${t.position}. ${t.team.name} - ${t.points} pts\n`));
          await sock.sendMessage(from, { text: txt });
        } catch {
          await sock.sendMessage(from, { text: "Error fetching EPL" });
        }
      }

      // ---------------------- FUN ----------------------
      if (cmd === "!joke") {
        const joke = await axios.get("https://official-joke-api.appspot.com/random_joke");
        await sock.sendMessage(from, { text: `${joke.data.setup}\n${joke.data.punchline}` });
      }

      if (cmd === "!quote") {
        const quote = await axios.get("https://api.quotable.io/random");
        await sock.sendMessage(from, { text: `${quote.data.content}\n— ${quote.data.author}` });
      }

      // ---------------------- STICKER ----------------------
      if (cmd === "!sticker") {
        await sock.sendMessage(from, { sticker: { url: "https://i.imgur.com/6vY9Z5B.jpeg" } });
      }

      // ---------------------- GROUP COMMANDS ----------------------
      if (cmd === "!kick" && isGroup) {
        const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        await sock.groupParticipantsUpdate(from, mentioned, "remove");
      }

      if (cmd === "!promote" && isGroup) {
        const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        await sock.groupParticipantsUpdate(from, mentioned, "promote");
      }

      if (cmd === "!demote" && isGroup) {
        const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        await sock.groupParticipantsUpdate(from, mentioned, "demote");
      }
    });
  }
}

// ---------------------- RUN BOT ----------------------
startBot();