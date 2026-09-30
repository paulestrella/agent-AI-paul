import os

from groq import Groq


class Agente:
    def __init__(self, personalidad: str):
        self.nombre_negocio = "Café Santo Domingo"
        self.cliente = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.historial = [
            {"role": "system", "content": personalidad}
        ]

    def responder(self, mensaje: str):
        self.historial.append({"role": "user", "content": mensaje})
        respuesta = self.cliente.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=self.historial,
        )
        contenido = respuesta.choices[0].message.content
        self.historial.append({"role": "assistant", "content": contenido})
        return contenido

    def mostrar_historial(self):
        for mensaje in self.historial:
            if mensaje["role"] != "system":
                print(f"{mensaje['role']}: {mensaje['content']}")