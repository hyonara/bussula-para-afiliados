const { default: makeWASocket } = require("@whiskeysockets/baileys");

async function startBot() {
  const sock = makeWASocket({
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp conectado!");
    }
  });
}

startBot();
