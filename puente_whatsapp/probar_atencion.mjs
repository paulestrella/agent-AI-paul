import { AVISO_CAIDA, atender, crearEstado, leerConfig } from "./atencion.mjs";
import { MARCA_BOT } from "./logica.mjs";

const config = leerConfig();
const cerrado = { ...config, permitidos: new Set() };
const MI_JID = "18095551234@s.whatsapp.net";
let fallos = 0;

function crearTelefonoFalso() {
  return {
    user: { id: "18095551234:7@s.whatsapp.net", lid: "99887766554433:7@lid" },
    enviados: [],
    async sendMessage(jid, contenido, opciones) {
      this.enviados.push({ jid, texto: contenido.text, id: opciones?.messageId });
    },
    async sendPresenceUpdate() {},
  };
}

function mensaje(texto, { jid = MI_JID, id = "ENTRADA-1" } = {}) {
  return {
    key: { remoteJid: jid, fromMe: true, id },
    message: { conversation: texto },
    messageTimestamp: Math.floor(Date.now() / 1000),
  };
}

function comprobar(nombre, bien) {
  if (!bien) fallos++;
  console.log(`${bien ? "✓" : "✗"} ${nombre}`);
}

const telefono = crearTelefonoFalso();
const estado = crearEstado();

await atender(telefono, mensaje("¿Cuánto cuesta un cappuccino?"), "notify", estado, config);
comprobar("El puente contesta una vez, a mi propio chat", telefono.enviados.length === 1 && telefono.enviados[0].jid === MI_JID);
comprobar("La respuesta es un texto con contenido", Boolean(telefono.enviados[0]?.texto?.trim()));
comprobar(
  "En mi propio chat, la respuesta lleva la marca del agente",
  telefono.enviados[0]?.texto?.startsWith(`${MARCA_BOT} `),
);
comprobar("El puente anotó el id de lo que envió", estado.enviados.has(telefono.enviados[0]?.id));
console.log(`   Respuesta del agente: ${telefono.enviados[0]?.texto}`);

const eco = { ...mensaje("eco"), key: { remoteJid: MI_JID, fromMe: true, id: telefono.enviados[0]?.id } };
await atender(telefono, eco, "notify", estado, config);
comprobar("El eco de su propia respuesta no genera otra respuesta", telefono.enviados.length === 1);

await atender(telefono, mensaje("hola", { jid: "120363000000000000@g.us", id: "GRUPO-1" }), "notify", estado, config);
comprobar("Un mensaje de grupo no genera respuesta", telefono.enviados.length === 1);

function deDesconocido(id, jid = "18095550000@s.whatsapp.net") {
  return {
    key: { remoteJid: jid, fromMe: false, id },
    message: { conversation: "hola" },
    messageTimestamp: Math.floor(Date.now() / 1000),
  };
}

await atender(telefono, deDesconocido("DESC-1"), "notify", estado, cerrado);
comprobar("Sin modo abierto, un desconocido no recibe respuesta", telefono.enviados.length === 1);

const abierto = { ...config, permitidos: new Set(["*"]) };
await atender(telefono, deDesconocido("DESC-2"), "notify", estado, abierto);
const alDesconocido = telefono.enviados.at(-1);
comprobar(
  "Con el modo abierto, un desconocido recibe respuesta sin la marca de chat personal",
  telefono.enviados.length === 2 && alDesconocido.jid === "18095550000@s.whatsapp.net" && !alDesconocido.texto.startsWith(`${MARCA_BOT} `),
);

const clienteLid = {
  key: { remoteJid: "99887766554433@lid", fromMe: false, id: "LID-1" },
  message: { conversation: "hola desde un chat individual" },
  messageTimestamp: Math.floor(Date.now() / 1000),
};
await atender(telefono, clienteLid, "notify", estado, abierto);
comprobar(
  "Con el modo abierto, responde a chats individuales identificados con @lid",
  telefono.enviados.length === 3 &&
    telefono.enviados.at(-1)?.jid === "99887766554433@lid",
);

const solicitudes = [];
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, opciones) => {
  const cuerpo = JSON.parse(opciones.body);
  solicitudes.push({
    url: String(url),
    autorizacion: opciones.headers.authorization,
    clienteId: cuerpo.cliente_id,
    mensaje: cuerpo.mensaje,
  });
  return fetchOriginal(url, opciones);
};
try {
  await atender(
    telefono,
    deDesconocido("CLIENTE-1", "18095550001@s.whatsapp.net"),
    "notify",
    estado,
    abierto,
  );
  await atender(
    telefono,
    deDesconocido("CLIENTE-2", "18095550002@s.whatsapp.net"),
    "notify",
    estado,
    abierto,
  );
} finally {
  globalThis.fetch = fetchOriginal;
}
comprobar(
  "Cada persona llega al endpoint con su propia identidad de conversación",
  solicitudes.length === 2 &&
    solicitudes[0].clienteId === "18095550001" &&
    solicitudes[1].clienteId === "18095550002" &&
    solicitudes[0].clienteId !== solicitudes[1].clienteId &&
    solicitudes.every(
      (solicitud) =>
        solicitud.url.endsWith("/whatsapp") &&
        solicitud.autorizacion.startsWith("Bearer ") &&
        typeof solicitud.mensaje === "string",
    ),
);

const conFreno = { ...config, frenoPorMinuto: 1 };
const estadoFreno = crearEstado();
const antes = telefono.enviados.length;
await atender(telefono, mensaje("uno", { id: "FRENO-1" }), "notify", estadoFreno, conFreno);
await atender(telefono, mensaje("dos", { id: "FRENO-2" }), "notify", estadoFreno, conFreno);
comprobar("El freno de emergencia corta al pasar el límite por minuto", telefono.enviados.length === antes + 1);

const sinServidor = { ...config, urlAgente: "http://127.0.0.1:8999" };
await atender(telefono, mensaje("¿están ahí?", { id: "ENTRADA-2" }), "notify", estado, sinServidor);
comprobar("Con el servidor apagado, avisa con un mensaje amable", telefono.enviados.at(-1)?.texto === `${MARCA_BOT} ${AVISO_CAIDA}`);

const tokenMalo = { ...config, token: "token-equivocado" };
await atender(telefono, mensaje("¿y con el token malo?", { id: "ENTRADA-3" }), "notify", estado, tokenMalo);
comprobar("Con un token equivocado, también avisa y no revela el motivo", telefono.enviados.at(-1)?.texto === `${MARCA_BOT} ${AVISO_CAIDA}`);

if (fallos === 0) {
  console.log("\nTodo en orden.");
} else {
  console.log(`\n${fallos} prueba(s) fallaron.`);
  console.log("Pista: si falla la PRIMERA, las demás pueden fallar en cadena. Empiecen por esa.");
  console.log("1) Corran `npm run probar:logica`: deben salir todas con ✓.");
  console.log("2) Corran `DIAGNOSTICO=1 npm run probar:atencion` y busquen la línea [diagnostico] ... -> motivo.");
}
process.exit(fallos === 0 ? 0 : 1);