import threading

from .agent import Agente
from .system_prompts import SYSTEM_PROMPTS


_agente: dict[str, Agente] = {}
_candados: dict[str, threading.Lock] = {}
_candado_general = threading.Lock()


def _obtener_agente_y_candado(cliente_id: str) -> tuple[Agente, threading.Lock]:
    with _candado_general:
        if cliente_id not in _agente:
            _agente[cliente_id] = Agente(SYSTEM_PROMPTS, cliente_id)
            _candados[cliente_id] = threading.Lock()
        return _agente[cliente_id], _candados[cliente_id]


def responder_a(cliente_id: str, mensaje: str) -> str:
    agente, candado = _obtener_agente_y_candado(cliente_id)
    with candado:
        return agente.responder(mensaje)
