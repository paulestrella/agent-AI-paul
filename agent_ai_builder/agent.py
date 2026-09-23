import os

from groq import Groq


class Agente:
    def __init__(self, personalidad: str):
        self.cliente = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.historial = [
            {"role": "system", "content": personalidad}
        ]