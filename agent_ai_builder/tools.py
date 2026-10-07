import json
from pathlib import Path


_BUSINESS_DATA_PATH = Path(__file__).with_name("business_data.json")
_BUSINESS_DATA = json.loads(_BUSINESS_DATA_PATH.read_text(encoding="utf-8"))
_PRODUCTS = {
    item["name"].strip().lower(): item
    for category in _BUSINESS_DATA["catalog"]
    for item in category["items"]
}

HERRAMIENTAS = [
    {
        "type": "function",
        "function": {
            "name": "calcular_pedido",
            "description": (
                "Úsala siempre que el cliente pregunte cuánto cuesta o cuánto "
                "sería el precio de uno o varios productos. Recibe los productos "
                "y sus cantidades para calcular subtotales y el total referencial."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "description": "Productos y cantidades del pedido.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "producto": {
                                    "type": "string",
                                    "description": "Nombre del producto del menú.",
                                },
                                "cantidad": {
                                    "type": "integer",
                                    "description": "Cantidad solicitada.",
                                },
                            },
                            "required": ["producto", "cantidad"],
                            "additionalProperties": False,
                        },
                    }
                },
                "required": ["items"],
                "additionalProperties": False,
            },
        },
    }
]


def calcular_pedido(items: list[dict[str, str | int]]) -> str:
    detalles = []
    total = 0

    for item in items:
        nombre_producto = item["producto"].strip()
        producto = _PRODUCTS.get(nombre_producto.lower())
        if producto is None:
            return f"El producto '{nombre_producto}' no está en el menú."

        cantidad = item["cantidad"]
        subtotal = producto["price"] * cantidad
        total += subtotal
        detalles.append(
            f"{cantidad} x {producto['name']} = RD${subtotal}"
        )

    detalle_pedido = "\n".join(detalles)
    return (
        f"Detalle del pedido:\n{detalle_pedido}\n"
        f"Total: RD${total}\n"
        "Precios referenciales; confirma las tarifas vigentes con el negocio."
    )


def ejecutar_herramienta(
    nombre: str,
    argumentos: dict[str, list[dict[str, str | int]]],
) -> str:
    if nombre == "calcular_pedido":
        return calcular_pedido(argumentos["items"])

    return f"La herramienta '{nombre}' no existe."
