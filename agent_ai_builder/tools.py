from .datos import DATOS_NEGOCIO, registrar_pedido
from .limpieza import MAX_DETALLE, MAX_NOMBRE, limpiar_texto


_PRODUCTS = {
    item["name"].strip().lower(): item
    for category in DATOS_NEGOCIO["catalog"]
    for item in category["items"]
}

_ITEMS_SCHEMA = {
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
                    "items": _ITEMS_SCHEMA,
                },
                "required": ["items"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_pedido",
            "description": (
                "Guarda el pedido en pedidos.xlsx cuando el cliente solicite "
                "registrarlo y confirme explícitamente los productos y "
                "cantidades. No la uses para consultas de precios."
            ),
            "parameters": {
                "type": "object",
                "properties": {"items": _ITEMS_SCHEMA},
                "required": ["items"],
                "additionalProperties": False,
            },
        },
    },
]


def _limpiar_items(items: list[dict[str, str | int]]) -> list[dict[str, str | int]]:
    return [
        {
            "producto": limpiar_texto(item["producto"], MAX_NOMBRE),
            "cantidad": item["cantidad"],
        }
        for item in items
    ]


def calcular_pedido(items: list[dict[str, str | int]]) -> str:
    detalles = []
    total = 0

    for item in _limpiar_items(items):
        nombre_producto = item["producto"]
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
    return limpiar_texto(
        f"Detalle del pedido:\n{detalle_pedido}\n"
        f"Total: RD${total}\n"
        "Precios referenciales; confirma las tarifas vigentes con el negocio.",
        MAX_DETALLE,
    )


def ejecutar_herramienta(
    nombre: str,
    argumentos: dict[str, list[dict[str, str | int]]],
    cliente_id: str = "",
) -> str:
    if nombre == "calcular_pedido":
        return calcular_pedido(argumentos["items"])
    if nombre == "registrar_pedido":
        return limpiar_texto(
            registrar_pedido(
                _limpiar_items(argumentos["items"]),
                _PRODUCTS,
                contacto=cliente_id,
            ),
            MAX_DETALLE,
        )

    return f"La herramienta '{nombre}' no existe."
