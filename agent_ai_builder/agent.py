import json
import os

from groq import Groq

from agent_ai_builder.tools import HERRAMIENTAS, ejecutar_herramienta

MODELO = "openai/gpt-oss-120b"


class Agente:
    def __init__(self, personalidad: str):
        self.nombre_negocio = "Café Santo Domingo"
        self.nombre_usuario = "Usuario"
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError(
                "No se encontro GROQ_API_KEY. Configurala en el entorno o en el archivo .env."
            )

        self.cliente = Groq(api_key=api_key)
        self.historial = [
            {"role": "system", "content": personalidad}
        ]

    def responder(self, mensaje: str):
        self.historial.append({"role": "user", "content": mensaje})

        respuesta = self.cliente.chat.completions.create(
            model=MODELO,
            messages=self.historial,
            tools=HERRAMIENTAS,
            tool_choice="auto",
        )
        mensaje_asistente = respuesta.choices[0].message
        llamadas = mensaje_asistente.tool_calls

        if not llamadas:
            contenido = mensaje_asistente.content or ""
            self.historial.append(
                {"role": "assistant", "content": contenido}
            )
            return contenido

        self.historial.append(
            {
                "role": "assistant",
                "content": mensaje_asistente.content,
                "tool_calls": [
                    llamada.model_dump(exclude_none=True)
                    for llamada in llamadas
                ],
            }
        )

        for llamada in llamadas:
            argumentos = json.loads(llamada.function.arguments)
            resultado = ejecutar_herramienta(
                llamada.function.name,
                argumentos,
            )
            self.historial.append(
                {
                    "role": "tool",
                    "tool_call_id": llamada.id,
                    "content": resultado,
                }
            )

        respuesta = self.cliente.chat.completions.create(
            model=MODELO,
            messages=self.historial,
        )
        mensaje_final = respuesta.choices[0].message
        contenido = mensaje_final.content or ""
        self.historial.append(
            {"role": "assistant", "content": contenido}
        )
        return contenido

    def mostrar_historial(self):
        print("\n=== Historial de conversación ===")
        print("---------------------------------")
        for mensaje in self.historial:
            rol = mensaje.get("role")
            if rol in ("user", "assistant"):
                contenido = mensaje.get("content") or ""
                nombre = self.nombre_usuario if rol == "user" else "Agente"
                print(f"{nombre}: {contenido}")
        print("---------------------------------")