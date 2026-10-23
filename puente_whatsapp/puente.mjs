import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  describirMultimedia,
  esMensajeAntiguo,
  identificarCliente,
  resumirMensaje,
} from "./logica.mjs";

const DIRECTORIO = path.dirname(fileURLToPath(import.meta.url));
const DIRECTORIO_SESION = path.join(DIRECTORIO, "sesion");
const RUTA_QR = path.join(DIRECTORIO, "qr.png");
const URL_AGENTE = new URL(
  process.env.URL_AGENTE || "http://127.0.0.1:8000/chat",
);
const PUENTE_TOKEN = process.env.PUENTE_TOKEN?.trim();
const enviados = new Set();
const permitidos = new Set();
(process.env.PERMITIDOS || "")
  .split(/[,\s]+/)
  .map((numero) => numero.replace(/\D/g, ""))
  .filter(Boolean)
  .forEach((numero) => permitidos.add(numero));
const DIAGNOSTICO = process.env.DIAGNOSTICO?.toLowerCase() === "true";
const MOTIVOS = {
  408: "sin internet o se agotó el tiempo",
  428: "la conexión se cerró",
  515: "reinicio normal después de vincular",
};
const logger = pino({ level: DIAGNOSTICO ? "debug" : "silent" });
let reconexionProgramada = false;

if (!["http:", "https:"].includes(URL_AGENTE.protocol)) {
  throw new Error("URL_AGENTE debe usar http o https.");
}

if (!URL_AGENTE.pathname.replace(/\/+$/, "").endsWith("/chat")) {
  URL_AGENTE.pathname = `${URL_AGENTE.pathname.replace(/\/+$/, "")}/chat`;
}

if (permitidos.size === 0) {
  console.warn(
    "PERMITIDOS está vacío: el puente se conectará, pero no responderá mensajes.",
  );
}

function crearContexto(mensaje) {
  const cliente = identificarCliente(mensaje);
  return {
    cliente,
    jid: mensaje.key?.remoteJid,
    idMensaje: mensaje.key?.id,
    timestamp: mensaje.messageTimestamp,
    resumen: resumirMensaje(mensaje),
    esMultimedia: describirMultimedia(mensaje) !== null,
  };
}

function decidirSiProcesar(contexto, mensaje) {
  const esMensajeDirecto =
    typeof contexto.jid === "string" &&
    contexto.jid.endsWith("@s.whatsapp.net");
  const resumenVacio =
    contexto.resumen === "El cliente envió un mensaje sin texto reconocible.";

  if (
    mensaje.key?.fromMe ||
    !esMensajeDirecto ||
    !contexto.idMensaje ||
    !contexto.cliente.telefono ||
    !permitidos.has(contexto.cliente.telefono) ||
    esMensajeAntiguo(contexto.timestamp) ||
    (!contexto.esMultimedia && resumenVacio) ||
    enviados.has(contexto.idMensaje)
  ) {
    return false;
  }

  enviados.add(contexto.idMensaje);
  if (enviados.size > 1_000) {
    enviados.delete(enviados.values().next().value);
  }
  return true;
}

async function solicitarRespuesta(clienteId, mensaje) {
  const headers = { "Content-Type": "application/json" };
  if (PUENTE_TOKEN) {
    headers.Authorization = `Bearer ${PUENTE_TOKEN}`;
  }

  const respuesta = await fetch(URL_AGENTE, {
    method: "POST",
    headers,
    body: JSON.stringify({ cliente_id: clienteId, mensaje }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!respuesta.ok) {
    throw new Error(`El servicio del agente respondió con HTTP ${respuesta.status}.`);
  }

  const datos = await respuesta.json();
  if (typeof datos.respuesta !== "string" || !datos.respuesta.trim()) {
    throw new Error("El servicio del agente devolvió una respuesta inválida.");
  }

  return datos.respuesta;
}

async function procesarMensaje(socket, mensaje) {
  const contexto = crearContexto(mensaje);
  if (!decidirSiProcesar(contexto, mensaje)) {
    return;
  }

  try {
    const respuesta = await solicitarRespuesta(
      contexto.cliente.id,
      contexto.resumen,
    );
    await socket.sendMessage(contexto.jid, { text: respuesta });
  } catch (error) {
    console.error("No se pudo procesar o responder el mensaje:", error);
    try {
      await socket.sendMessage(contexto.jid, {
        text: "No pude procesar tu mensaje en este momento. Inténtalo de nuevo más tarde.",
      });
    } catch (errorEnvio) {
      console.error("No se pudo enviar el aviso de error por WhatsApp:", errorEnvio);
    }
  }
}

async function conectar() {
  try {
    const { state, saveCreds } =
      await useMultiFileAuthState(DIRECTORIO_SESION);
    const socket = makeWASocket({
      auth: state,
      browser: Browsers.macOS("Chrome"),
      logger,
      markOnlineOnConnect: false,
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          console.log(await QRCode.toString(qr, { small: true, type: "terminal" }));
          await QRCode.toFile(RUTA_QR, qr);
          console.log(`Escanea el QR de WhatsApp; también se guardó en ${RUTA_QR}`);
        } catch (error) {
          console.error("No se pudo mostrar o guardar el QR:", error);
        }
      }

      if (connection === "open") {
        reconexionProgramada = false;
        console.log("Puente de WhatsApp conectado.");
      }

      if (connection === "close") {
        const codigo = lastDisconnect?.error?.output?.statusCode;
        if (codigo === DisconnectReason.loggedOut) {
          console.error(
            "La sesión de WhatsApp cerró sesión. Elimina la sesión guardada y vuelve a escanear el QR para vincularla otra vez.",
          );
          process.exitCode = 1;
          return;
        }

        if (!reconexionProgramada) {
          reconexionProgramada = true;
          const motivo =
            MOTIVOS[codigo] || `cierre de conexión (código ${codigo ?? "desconocido"})`;
          console.warn(
            `Conexión cerrada: ${motivo}. Se intentará reconectar en 3 segundos.`,
          );
          setTimeout(() => {
            reconexionProgramada = false;
            void conectar();
          }, 3_000);
        }
      }
    });

    socket.ev.on("messages.upsert", ({ type, messages }) => {
      if (type !== "notify") {
        return;
      }

      for (const mensaje of messages) {
        void procesarMensaje(socket, mensaje);
      }
    });
  } catch (error) {
    console.error("No se pudo iniciar el puente de WhatsApp:", error);
    if (!reconexionProgramada) {
      reconexionProgramada = true;
      setTimeout(() => {
        reconexionProgramada = false;
        void conectar();
      }, 3_000);
    }
  }
}

void conectar();
