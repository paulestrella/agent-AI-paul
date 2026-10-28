import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

import { atender, crearEstado, leerConfig } from "./atencion.mjs";

const MOTIVOS = {
  408: "sin internet o se agotó el tiempo",
  428: "la conexión se cerró",
  515: "reinicio normal después de vincular",
};

const config = leerConfig();
const estado = crearEstado();

if (config.permitidos.has("*")) {
  console.log("[puente] ⚠️ MODO ABIERTO: cualquier persona puede escribirle al agente. Úsalo solo durante la clase.");
}
let fallos = 0;

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState("sesion");
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: process.env.LOG_BAILEYS ?? "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n[puente] Escanea este código: WhatsApp > Dispositivos vinculados > Vincular un dispositivo");
      console.log(await QRCode.toString(qr, { type: "terminal", small: true }));
      await QRCode.toFile("qr.png", qr, { width: 400 });
      console.log("[puente] Si el código se ve deformado, abre el archivo qr.png y escanéalo desde ahí.");
    }

    if (connection === "open") {
      fallos = 0;
      console.log(`[puente] Conectado como ${sock.user?.id}`);
    }

    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;

      if (codigo === DisconnectReason.loggedOut) {
        console.log("[puente] Cerraron la sesión desde el teléfono. Borra la carpeta 'sesion' y vuelve a iniciar.");
        process.exit(1);
      }
      if (codigo === DisconnectReason.connectionReplaced) {
        console.log("[puente] Hay otra copia del puente conectada con esta cuenta. Cierra una de las dos.");
        process.exit(1);
      }
      if (codigo === DisconnectReason.forbidden) {
        console.log("[puente] WhatsApp rechazó la conexión (403). Deja de usar este número y espera unas horas.");
        process.exit(1);
      }

      const espera = codigo === DisconnectReason.restartRequired ? 0 : Math.min(30_000, 2_000 * 2 ** fallos++);
      console.log(`[puente] Conexión cerrada (código ${codigo}: ${MOTIVOS[codigo] ?? "otro motivo"}). Reintento en ${espera / 1000} s.`);
      setTimeout(conectar, espera);
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    for (const msg of messages) {
      atender(sock, msg, type, estado, config).catch((error) => {
        console.log("[puente] Error inesperado:", error.message);
      });
    }
  });
}

conectar().catch((error) => {
  console.log("[puente] No pude iniciar:", error.message);
  process.exit(1);
});