const { default: makeWASocket } = require("@whiskeysockets/baileys");
const http = require("http");

const PORT = process.env.PORT || 3000;

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Bússola para Afiliados está online");
});

// Iniciar servidor HTTP
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// Função para iniciar o bot do WhatsApp
async function startBot() {
  try {
    const sock = makeWASocket({
      printQRInTerminal: true,
    });

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        console.log("✅ WhatsApp conectado!");
      } else if (connection === "close") {
        console.log("❌ Desconectado do WhatsApp. Tentando reconectar...");
        startBot();
      }
    });

    sock.ev.on("creds.update", () => {
      console.log("📱 Credenciais atualizadas");
    });

    sock.ev.on("messages.upsert", async (m) => {
      console.log("📨 Nova mensagem recebida");
    });
  } catch (error) {
    console.error("Erro ao iniciar bot:", error);
    setTimeout(() => startBot(), 5000);
  }
}

// Iniciar o bot
startBot();

// Manter o processo ativo
process.on("SIGINT", () => {
  console.log("\n👋 Encerrando aplicação...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n👋 Encerrando aplicação...");
  server.close(() => {
    process.exit(0);
  });
});

