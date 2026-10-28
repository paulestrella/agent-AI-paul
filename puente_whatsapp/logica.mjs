export const EDAD_MAXIMA_SEG = 120;
export const MARCA_BOT = "[Agente]";
export const MAX_ENTRADA = 500;

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

function jidCanonico(jid) {
  if (typeof jid !== "string") {
    return "";
  }

  const [usuario, dominio] = jid.split("@", 2);
  return dominio ? `${usuario.split(":", 1)[0]}@${dominio}` : "";
}

export function resumir(mensaje, _tipo) {
  return resumirMensaje(mensaje, MAX_ENTRADA);
}

export function crearContexto(sock, permitidos, enviados, ahoraSegundos) {
  const usuario = sock?.user ?? {};
  const jidsPropios = new Set(
    [usuario.id, usuario.lid].map(jidCanonico).filter(Boolean),
  );
  const permitidosNormalizados = new Set(permitidos);

  return {
    ahoraSegundos,
    enviados,
    jidsPropios,
    permitidos: permitidosNormalizados,
  };
}

export function decidir(mensaje, tipo, contexto) {
  const clave = mensaje?.key ?? {};
  const jid = clave.remoteJid ?? "";
  const id = clave.id;
  const esMiChat = Boolean(clave.fromMe && contexto.jidsPropios.has(jidCanonico(jid)));
  const ignorar = (motivo) => ({ accion: "ignorar", motivo });

  if (tipo !== "notify") {
    return ignorar("tipo de evento no notificable");
  }
  if (!id) {
    return ignorar("mensaje sin identificador");
  }
  if (contexto.enviados.has(id)) {
    return ignorar("eco de un mensaje enviado por el puente");
  }
  if (clave.fromMe && !esMiChat) {
    return ignorar("mensaje propio fuera del chat personal");
  }
  if (!esMiChat && !jid.endsWith("@s.whatsapp.net")) {
    return ignorar("chat grupal o JID no directo");
  }
  if (esMensajeAntiguo(mensaje.messageTimestamp, contexto.ahoraSegundos)) {
    return ignorar("mensaje antiguo");
  }

  const cliente = identificarCliente(mensaje);
  if (!cliente.telefono) {
    return ignorar("no se pudo identificar el número del cliente");
  }
  if (
    !esMiChat &&
    !contexto.permitidos.has("*") &&
    !contexto.permitidos.has(cliente.telefono)
  ) {
    return ignorar("cliente fuera de la lista permitida");
  }

  const texto = resumir(mensaje, tipo);
  if (texto === "El cliente envió un mensaje sin texto reconocible.") {
    return ignorar("mensaje sin texto o multimedia reconocible");
  }

  return {
    accion: "responder",
    clienteId: cliente.id,
    esMiChat,
    jid,
    texto,
  };
}
