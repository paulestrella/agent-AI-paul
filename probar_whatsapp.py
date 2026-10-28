import argparse
import os
import uuid
from urllib.parse import urlsplit, urlunsplit

import httpx
from dotenv import load_dotenv

load_dotenv()


def _url_whatsapp(url: str) -> str:
    partes = urlsplit(url)
    ruta = partes.path.rstrip("/")
    if ruta.endswith("/chat"):
        ruta = f"{ruta[:-5]}/whatsapp"
    elif not ruta.endswith("/whatsapp"):
        ruta = f"{ruta}/whatsapp"
    return urlunsplit((partes.scheme, partes.netloc, ruta, partes.query, partes.fragment))


def _analizar_argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prueba el contrato del endpoint WhatsApp del servidor."
    )
    parser.add_argument(
        "texto",
        nargs="?",
        default="¿Cuánto cuesta un cappuccino?",
        help="Texto para el escenario de respuesta normal.",
    )
    parser.add_argument(
        "--url",
        default=os.getenv("URL_AGENTE", "http://127.0.0.1:8000/whatsapp"),
        help="URL del servidor (si termina en /chat se convierte a /whatsapp).",
    )
    parser.add_argument("--id", default="whatsapp:18095550000", help="ID de cliente.")
    parser.add_argument(
        "--veces",
        type=int,
        help="Repeticiones (por defecto 7 para probar límites y 1 para los demás casos).",
    )
    parser.add_argument(
        "--escenario",
        choices=(
            "respuesta",
            "reiniciar",
            "sin-token",
            "token-malo",
            "vacio",
            "largo",
            "limite-minuto",
            "limite-diario",
        ),
        help="Escenario de contrato que se ejecutará.",
    )
    parser.add_argument("--sin-token", action="store_true", help="Prueba sin autenticación.")
    parser.add_argument("--token-malo", action="store_true", help="Prueba con token incorrecto.")
    parser.add_argument("--vacio", action="store_true", help="Prueba con mensaje vacío.")
    return parser.parse_args()


def _obtener_escenario(argumentos: argparse.Namespace) -> str:
    seleccionados = [
        nombre
        for activo, nombre in (
            (argumentos.sin_token, "sin-token"),
            (argumentos.token_malo, "token-malo"),
            (argumentos.vacio, "vacio"),
        )
        if activo
    ]
    if argumentos.escenario:
        seleccionados.append(argumentos.escenario)
    if len(seleccionados) > 1:
        raise SystemExit("Selecciona un solo escenario de prueba.")
    if seleccionados:
        return seleccionados[0]
    if argumentos.texto.strip().casefold() == "/reiniciar":
        return "reiniciar"
    return "respuesta"


def _validar_respuesta(
    respuesta: httpx.Response,
    escenario: str,
    cliente_id: str,
) -> None:
    esperado = {
        "sin-token": 401,
        "token-malo": 401,
        "vacio": 400,
        "largo": 413,
    }.get(escenario, 200)
    if respuesta.status_code != esperado:
        detalle = respuesta.text.strip() or "(el servidor no devolvió cuerpo)"
        partes_url = urlsplit(str(respuesta.request.url))
        raise SystemExit(
            f"Fallo del contrato: se esperaba HTTP {esperado} para "
            f"'{escenario}', pero {respuesta.request.method} "
            f"{partes_url.scheme}://{partes_url.netloc}{partes_url.path} "
            f"respondió HTTP {respuesta.status_code}: {detalle}"
            + (
                " El endpoint de esta aplicación no devuelve 403; verifica que "
                "URL_AGENTE apunte al servidor correcto y revisa sus logs."
                if respuesta.status_code == 403
                else ""
            )
        )

    cuerpo = respuesta.json()
    if escenario == "reiniciar":
        if "/reiniciar" not in cuerpo.get("respuesta", "").casefold():
            raise SystemExit("El servidor respondió 200, pero no devolvió la bienvenida de reinicio.")
    elif escenario == "respuesta":
        if cuerpo.get("cliente_id") != cliente_id:
            raise SystemExit("La respuesta no contiene el cliente_id solicitado.")
        if not isinstance(cuerpo.get("respuesta"), str) or not cuerpo["respuesta"].strip():
            raise SystemExit("La respuesta del servidor no contiene texto en 'respuesta'.")


def main() -> None:
    argumentos = _analizar_argumentos()
    escenario = _obtener_escenario(argumentos)
    veces = argumentos.veces
    if veces is None:
        veces = 7 if escenario in ("limite-minuto", "limite-diario") else 1
    if veces < 1:
        raise SystemExit("--veces debe ser al menos 1.")

    url = _url_whatsapp(argumentos.url)
    token = os.getenv("PUENTE_TOKEN", "").strip()
    if escenario not in ("sin-token", "token-malo") and not token:
        raise SystemExit("Configura PUENTE_TOKEN en el entorno o en .env.")

    headers = {}
    if escenario != "sin-token":
        token_enviado = "token-equivocado" if escenario == "token-malo" else token
        headers["Authorization"] = f"Bearer {token_enviado}"

    def enviar(cliente_id: str, mensaje: str, cabeceras: dict[str, str] = headers):
        try:
            return httpx.post(
                url,
                json={"cliente_id": cliente_id, "mensaje": mensaje},
                headers=cabeceras,
                timeout=60,
            )
        except httpx.RequestError as error:
            raise SystemExit(
                f"No se pudo conectar con {urlsplit(url).netloc}: {error}"
            ) from error

    if escenario == "limite-diario":
        for numero in range(veces):
            cliente_id = f"{argumentos.id}:{uuid.uuid4().hex}"
            respuesta = enviar(cliente_id, argumentos.texto)
            print(f"[{numero + 1}] {respuesta.status_code} {respuesta.text}")
            if respuesta.status_code == 429:
                cuerpo = respuesta.json()
                assert "cupo de hoy" in cuerpo.get("respuesta", "").lower()
                return
            assert respuesta.status_code == 200
        raise AssertionError(
            "No se alcanzó el límite diario; aumenta --veces o revisa el estado del servidor."
        )

    if escenario == "limite-minuto":
        for numero in range(veces):
            respuesta = enviar(argumentos.id, argumentos.texto)
            print(f"[{numero + 1}] {respuesta.status_code} {respuesta.text}")
            if respuesta.status_code == 429:
                assert "demasiados mensajes" in respuesta.json().get("respuesta", "").lower()
                return
            assert respuesta.status_code == 200
        raise AssertionError(
            "No se alcanzó el límite por minuto; usa --veces=7 y un cliente sin cuota diaria agotada."
        )

    texto = argumentos.texto
    if escenario == "reiniciar":
        texto = "/reiniciar"
    elif escenario == "vacio":
        texto = ""
    elif escenario == "largo":
        texto = "x" * 501

    for numero in range(veces):
        respuesta = enviar(argumentos.id, texto)
        print(f"[{numero + 1}] {respuesta.status_code} {respuesta.text}")

        _validar_respuesta(respuesta, escenario, argumentos.id)


if __name__ == "__main__":
    main()
