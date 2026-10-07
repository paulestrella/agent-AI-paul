import json
from pathlib import Path


_BUSINESS_DATA_PATH = Path(__file__).with_name("business_data.json")
_BUSINESS_DATA = json.loads(_BUSINESS_DATA_PATH.read_text(encoding="utf-8"))
_PRODUCTS = {
    item["name"].strip().lower(): item
    for category in _BUSINESS_DATA["catalog"]
    for item in category["items"]
}


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

