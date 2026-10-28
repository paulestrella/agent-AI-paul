import { generateMessageIDV2 } from "@whiskeysockets/baileys";

import { MARCA_BOT, crearContexto, decidir, resumir } from "./logica.mjs";

export const AVISO_CAIDA = "En este momento no puedo atenderte. Intenta de nuevo en unos minutos.";

const FRENO_POR_DEFECTO = 15;
const MAX_ENVIADOS = 500;

export function leerConfig(env = process.env) {
  const url = new URL(env.URL_AGENTE ?? "http://127.0.0.1:8000");
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL_AGENTE debe usar http o https.");
  }

  const ruta = url.pathname.replace(/\/+$/, "");
  if (ruta.endsWith("/chat")) {
    url.pathname = `${ruta.slice(0, -"/chat".length)}/whatsapp`;
  } else if (!ruta.endsWith("/whatsapp")) {
    url.pathname = `${ruta}/whatsapp`;
  }

  return {
    urlAgente: url.toString().replace(/\/$/, ""),
    token: env.PUENTE_TOKEN ?? "",
    permitidos: new Set(
      (env.PERMITIDOS ?? "").split(/[,\s]+/)
        .map((numero) => (numero.trim() === "*" ? "*" : numero.replace(/\D/g, "")))
        .filter(Boolean),
    ),
    diagnostico: env.DIAGNOSTICO === "1",
    frenoPorMinuto: Number(env.FRENO_POR_MINUTO) || FRENO_POR_DEFECTO,
  };
}

export function crearEstado() {
  return { enviados: new Set(), respuestas: [] };
}

function enmascarar(clienteId) {
  return clienteId.slice(0, 9) + "***" + clienteId.slice(-4);
}

async function preguntarAlAgente(config, clienteId, texto) {
  const respuesta = await fetch(config.urlAgente, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ cliente_id: clienteId, mensaje: texto }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!respuesta.ok) throw new Error(`el agente respondió ${respuesta.status}`);
  const datos = await respuesta.json();
  if (typeof datos.respuesta !== "string" || !datos.respuesta.trim()) {
    throw new Error("el agente devolvió una respuesta inválida");
  }
  return datos.respuesta.trim();
}

function hayCupo(estado, ahoraMs, maximo) {
  estado.respuestas = estado.respuestas.filter((marca) => ahoraMs - marca < 60_000);
  return estado.respuestas.length < maximo;
}

async function enviar(sock, jid, texto, estado) {
  const id = generateMessageIDV2(sock.user?.id);
  estado.enviados.add(id);
  if (estado.enviados.size > MAX_ENVIADOS) {
    estado.enviados.delete(estado.enviados.values().next().value);
  }
  estado.respuestas.push(Date.now());
  await sock.sendMessage(jid, { text: texto }, { messageId: id });
}

export async function atender(sock, msg, tipo, estado, config, ahoraMs = () => Date.now()) {
  const contexto = crearContexto(sock, config.permitidos, estado.enviados, ahoraMs() / 1000);
  const decision = decidir(msg, tipo, contexto);

  if (config.diagnostico) {
    const motivo = decision.motivo ? ` (${decision.motivo})` : "";
    console.log(`[diagnostico] ${resumir(msg, tipo)} -> ${decision.accion}${motivo}`);
  }
  if (decision.accion === "ignorar") return;
  if (!hayCupo(estado, ahoraMs(), config.frenoPorMinuto)) {
    console.log("[puente] Freno de emergencia: demasiadas respuestas en un minuto. No respondo.");
    return;
  }

  console.log(`[puente] ← ${enmascarar(decision.clienteId)}: ${decision.texto}`);
  await sock.sendPresenceUpdate("composing", decision.jid).catch(() => {});

  let respuesta;
  try {
    respuesta = await preguntarAlAgente(config, decision.clienteId, decision.texto);
  } catch (error) {
    console.log(`[puente] No pude hablar con el agente: ${error.cause?.code ?? error.cause?.message ?? error.message}`);
    respuesta = AVISO_CAIDA;
  }

  const textoFinal = decision.esMiChat ? `${MARCA_BOT} ${respuesta}` : respuesta;
  try {
    await enviar(sock, decision.jid, textoFinal, estado);
    console.log(`[puente] → ${textoFinal}`);
  } catch (error) {
    console.log(`[puente] No pude enviar la respuesta: ${error.message}`);
  }
  await sock.sendPresenceUpdate("paused", decision.jid).catch(() => {});
}