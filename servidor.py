from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.responses import Response
from pydantic import BaseModel

load_dotenv()

from agent_ai_builder.clientes import reiniciar_cliente, responder_a
from agent_ai_builder.whatsapp import (
    MAX_ENTRADA,
    MENSAJES_LIMITE,
    limite_diario,
    permitido,
    token_valido,
)

app = FastAPI(title="Agente de atencion al cliente")


class MensajeEntrada(BaseModel):
    cliente_id: str
    mensaje: str


@app.get("/salud")
def salud() -> dict[str, str]:
    return {"estado": "ok"}


@app.post("/chat")
def chat(entrada: MensajeEntrada) -> dict[str, str]:
    respuesta = responder_a(entrada.cliente_id, entrada.mensaje)
    return {"cliente_id": entrada.cliente_id, "respuesta": respuesta}


def responder_whatsapp(cliente_id: str, texto: str) -> str:
    print(f"[whatsapp] {cliente_id}: {texto}")
    return responder_a(cliente_id, texto)


@app.post("/whatsapp")
def whatsapp(
    entrada: MensajeEntrada,
    response: Response,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not token_valido(token):
        response.status_code = 401
        return {"respuesta": "No autorizado."}

    texto = entrada.mensaje.strip()
    if len(texto) > MAX_ENTRADA:
        response.status_code = 413
        return {"respuesta": f"El mensaje supera el límite de {MAX_ENTRADA} caracteres."}
    if not texto:
        response.status_code = 400
        return {"respuesta": "El mensaje no puede estar vacío."}

    if texto.casefold() == "/reiniciar":
        reiniciar_cliente(entrada.cliente_id)
        return {"cliente_id": entrada.cliente_id, "respuesta": BIENVENIDA}

    if not permitido(entrada.cliente_id):
        response.status_code = 429
        return {"respuesta": "Has enviado demasiados mensajes. Inténtalo de nuevo más tarde."}

    limite = limite_diario(entrada.cliente_id)
    if limite:
        response.status_code = 429
        return {"respuesta": MENSAJES_LIMITE[limite]}

    respuesta = responder_whatsapp(entrada.cliente_id, texto)
    return {"cliente_id": entrada.cliente_id, "respuesta": respuesta}


BIENVENIDA = "¡Hola! Soy el agente de prueba. Escribe /reiniciar para comenzar de nuevo."
