import hmac
import os
import threading
import time
from collections import defaultdict, deque
from datetime import date
from typing import Literal

MAX_ENTRADA = 500
MAX_MENSAJES = 6
VENTANA = 60
LIMITE_DIARIO_NUMERO = int(os.getenv("LIMITE_DIARIO_NUMERO", "30"))
LIMITE_DIARIO_TOTAL = int(os.getenv("LIMITE_DIARIO_TOTAL", "70"))

MENSAJES_LIMITES = {
    "numero": "llegaste al limite de mensajes de hoy para esta prueba. mañana puedes seguir.",
    "total": "el agente de prueba ya uso todo su cupo de hoy. mañana vuelva a estar disponible.",
}
MENSAJES_LIMITE = MENSAJES_LIMITES

_recientes = defaultdict(deque)
_candado_minuto = threading.Lock()
_candado_dia = threading.Lock()

diccionario_conteo = {
    "dia": date.today(),
    "por_numero": {},
    "total": 0,
}

PUENTE_TOKEN = os.getenv("PUENTE_TOKEN", "").strip()
TOKENS_VALIDOS = frozenset({PUENTE_TOKEN}) if PUENTE_TOKEN else frozenset()


def token_es_valido(token: str) -> bool:
    if not isinstance(token, str):
        return False

    tokens_validos = TOKENS_VALIDOS
    if not tokens_validos:
        token_configurado = os.getenv("PUENTE_TOKEN", "").strip()
        if token_configurado:
            tokens_validos = frozenset({token_configurado})

    return any(
        hmac.compare_digest(token.encode("utf-8"), token_valido.encode("utf-8"))
        for token_valido in tokens_validos
    )


def token_valido(token: str) -> bool:
    return token_es_valido(token)


def permitido(numero: str) -> bool:
    ahora = time.monotonic()
    with _candado_minuto:
        recientes = _recientes[numero]
        while recientes and ahora - recientes[0] >= VENTANA:
            recientes.popleft()
        if len(recientes) >= MAX_MENSAJES:
            return False
        recientes.append(ahora)
        return True


def limite_diario(numero: str) -> Literal["numero", "total"] | None:
    if not numero:
        raise ValueError("El número del cliente no puede estar vacío.")

    with _candado_dia:
        hoy = date.today()
        if diccionario_conteo["dia"] != hoy:
            diccionario_conteo["dia"] = hoy
            diccionario_conteo["por_numero"].clear()
            diccionario_conteo["total"] = 0

        por_numero = diccionario_conteo["por_numero"]
        if por_numero.get(numero, 0) >= LIMITE_DIARIO_NUMERO:
            return "numero"
        if diccionario_conteo["total"] >= LIMITE_DIARIO_TOTAL:
            return "total"

        por_numero[numero] = por_numero.get(numero, 0) + 1
        diccionario_conteo["total"] += 1
        return None
