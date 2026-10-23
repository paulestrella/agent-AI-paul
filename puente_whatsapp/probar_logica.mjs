import assert from "node:assert/strict";
import {
  EDAD_MAXIMA_SEG,
  MARCA_BOT,
  TIPOS_MULTIMEDIA,
  describirMultimedia,
  esMensajeAntiguo,
  extraerDigitosJid,
  identificarCliente,
  marcarMensajeBot,
  resumirMensaje,
} from "./logica.mjs";

const CONTEXTO = Object.freeze({
  ahoraSegundos: 1_800_000_000,
  jidCliente: "18005551234.0:8@s.whatsapp.net",
  nombreCliente: "Ana",
});

function mensaje({
  id = "mensaje-prueba",
  jid = CONTEXTO.jidCliente,
  nombre = CONTEXTO.nombreCliente,
  contenido = { conversation: "Hola" },
  timestamp = CONTEXTO.ahoraSegundos,
  participante,
} = {}) {
  return {
    key: {
      id,
      remoteJid: jid,
      fromMe: false,
      ...(participante ? { participant: participante } : {}),
    },
    pushName: nombre,
    message: contenido,
    messageTimestamp: timestamp,
  };
}

const CASOS = [
  {
    nombre: "extrae los dígitos antes del punto y la arroba",
    ejecutar: () =>
      assert.equal(
        extraerDigitosJid(CONTEXTO.jidCliente),
        "18005551234",
      ),
  },
  {
    nombre: "maneja un JID inválido",
    ejecutar: () => assert.equal(extraerDigitosJid(null), ""),
  },
  {
    nombre: "identifica al cliente por número y nombre",
    ejecutar: () =>
      assert.deepEqual(identificarCliente(mensaje()), {
        id: "18005551234",
        nombre: "Ana",
        telefono: "18005551234",
      }),
  },
  {
    nombre: "prioriza al participante en un chat grupal",
    ejecutar: () =>
      assert.deepEqual(
        identificarCliente(
          mensaje({
            jid: "120363000000000000@g.us",
            participante: "18005559876@s.whatsapp.net",
          }),
        ),
        {
          id: "18005559876",
          nombre: "Ana",
          telefono: "18005559876",
        },
      ),
  },
  ...Object.entries(TIPOS_MULTIMEDIA).map(([tipo, descripcion]) => ({
    nombre: `identifica multimedia: ${tipo}`,
    ejecutar: () =>
      assert.equal(
        describirMultimedia(mensaje({ contenido: { [tipo]: {} } })),
        descripcion,
      ),
  })),
  {
    nombre: "resume texto con adjunto multimedia",
    ejecutar: () =>
      assert.equal(
        resumirMensaje(
          mensaje({ contenido: { imageMessage: { caption: "Mira esto" } } }),
        ),
        "Mira esto Adjunto: El cliente envió una imagen.",
      ),
  },
  {
    nombre: "resume un mensaje multimedia sin texto",
    ejecutar: () =>
      assert.equal(
        resumirMensaje(mensaje({ contenido: { audioMessage: {} } })),
        "El cliente envió un audio.",
      ),
  },
  {
    nombre: "lee mensajes envueltos como efímeros",
    ejecutar: () =>
      assert.equal(
        resumirMensaje(
          mensaje({
            contenido: {
              ephemeralMessage: {
                message: { extendedTextMessage: { text: "Mensaje temporal" } },
              },
            },
          }),
        ),
        "Mensaje temporal",
      ),
  },
  {
    nombre: "usa una descripción para mensajes sin texto reconocible",
    ejecutar: () =>
      assert.equal(
        resumirMensaje(mensaje({ contenido: { reactionMessage: {} } })),
        "El cliente envió un mensaje sin texto reconocible.",
      ),
  },
  {
    nombre: "limita la longitud del resumen",
    ejecutar: () =>
      assert.equal(
        resumirMensaje(
          mensaje({ contenido: { conversation: "Mensaje largo" } }),
          8,
        ),
        "Mensaje…",
      ),
  },
  {
    nombre: "detecta mensajes más antiguos que el límite",
    ejecutar: () =>
      assert.equal(
        esMensajeAntiguo(
          CONTEXTO.ahoraSegundos - EDAD_MAXIMA_SEG - 1,
          CONTEXTO.ahoraSegundos,
        ),
        true,
      ),
  },
  {
    nombre: "no considera antiguo un mensaje dentro del límite",
    ejecutar: () =>
      assert.equal(
        esMensajeAntiguo(
          CONTEXTO.ahoraSegundos - EDAD_MAXIMA_SEG,
          CONTEXTO.ahoraSegundos,
        ),
        false,
      ),
  },
  {
    nombre: "antepone la marca del bot",
    ejecutar: () =>
      assert.equal(marcarMensajeBot("Hola"), `${MARCA_BOT} Hola`),
  },
];

for (const caso of CASOS) {
  caso.ejecutar();
  console.log(`OK: ${caso.nombre}`);
}

console.log(`\nTodas las pruebas pasaron (${CASOS.length}).`);
