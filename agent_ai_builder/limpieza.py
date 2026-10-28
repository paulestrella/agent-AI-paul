import re

MAX_NOMBRE = 80
MAX_DETALLE = 300

_CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def limpiar_texto(texto: object, maximo: int) -> str:
    texto_limpio = _CONTROL.sub(
        lambda caracter: " " if caracter.group() in "\t\n\r" else "",
        str(texto),
    )
    texto_limpio = " ".join(texto_limpio.split())
    return texto_limpio.lstrip("=+-@ ")[:maximo]
