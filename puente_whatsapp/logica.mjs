export const EDAD_MAXIMA_SEG = 120;
export const MARCA_BOT = "[Agente]";

export const TIPOS_MULTIMEDIA = Object.freeze({
  imageMessage: "El cliente envió una imagen.",
  audioMessage: "El cliente envió un audio.",
  videoMessage: "El cliente envió un video.",
  stickerMessage: "El cliente envió un sticker.",
  documentMessage: "El cliente envió un documento.",
  contactMessage: "El cliente envió un contacto.",
  contactsArrayMessage: "El cliente envió contactos.",
  locationMessage: "El cliente compartió una ubicación.",
  liveLocationMessage: "El cliente compartió una ubicación en tiempo real.",
});

export function extraerDigitosJid(jid) {
  if (typeof jid !== "string") {
    return "";
  }

  return jid.split("@", 1)[0].split(".", 1)[0].replace(/\D/g, "");
}

export function identificarCliente(mensaje) {
  const clave = mensaje?.key ?? {};
  const jid =
    clave.participantAlt ||
    clave.remoteJidAlt ||
    clave.participant ||
    clave.remoteJid ||
    "";
  const numero = extraerDigitosJid(jid);

  return {
    id: numero || jid || "desconocido",
    nombre: mensaje?.pushName?.trim() || "Cliente",
    telefono: numero || null,
  };
}

export function describirMultimedia(mensaje) {
  let contenido = mensaje?.message ?? mensaje;

  while (
    contenido?.ephemeralMessage?.message ||
    contenido?.viewOnceMessage?.message ||
    contenido?.viewOnceMessageV2?.message
  ) {
    contenido =
      contenido.ephemeralMessage?.message ||
      contenido.viewOnceMessage?.message ||
      contenido.viewOnceMessageV2?.message;
  }

  for (const [tipo, descripcion] of Object.entries(TIPOS_MULTIMEDIA)) {
    if (contenido?.[tipo]) {
      return descripcion;
    }
  }

  return null;
}

export function resumirMensaje(mensaje, maxCaracteres = 500) {
  let contenido = mensaje?.message ?? mensaje;

  while (
    contenido?.ephemeralMessage?.message ||
    contenido?.viewOnceMessage?.message ||
    contenido?.viewOnceMessageV2?.message
  ) {
    contenido =
      contenido.ephemeralMessage?.message ||
      contenido.viewOnceMessage?.message ||
      contenido.viewOnceMessageV2?.message;
  }

  const texto = (
    contenido?.conversation ||
    contenido?.extendedTextMessage?.text ||
    contenido?.imageMessage?.caption ||
    contenido?.videoMessage?.caption ||
    contenido?.documentMessage?.caption ||
    contenido?.buttonsResponseMessage?.selectedDisplayText ||
    contenido?.listResponseMessage?.title ||
    contenido?.templateButtonReplyMessage?.selectedDisplayText ||
    ""
  ).trim();
  const multimedia = describirMultimedia(contenido);
  const resumen = [
    texto,
    multimedia ? (texto ? `Adjunto: ${multimedia}` : multimedia) : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!resumen) {
    return "El cliente envió un mensaje sin texto reconocible.";
  }

  const limite = Number.isInteger(maxCaracteres) && maxCaracteres > 0
    ? maxCaracteres
    : 500;
  if (resumen.length <= limite) {
    return resumen;
  }

  return `${resumen.slice(0, Math.max(0, limite - 1)).trimEnd()}…`;
}

export function esMensajeAntiguo(
  timestamp,
  ahoraSegundos = Math.floor(Date.now() / 1000),
) {
  const segundos =
    typeof timestamp === "object" && timestamp !== null
      ? Number(timestamp.toNumber?.())
      : Number(timestamp);

  if (!Number.isFinite(segundos) || !Number.isFinite(ahoraSegundos)) {
    return false;
  }

  return ahoraSegundos - segundos > EDAD_MAXIMA_SEG;
}

export function marcarMensajeBot(texto) {
  return `${MARCA_BOT} ${String(texto)}`;
}
