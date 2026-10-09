from pathlib import Path
from typing import TypedDict

from openpyxl import load_workbook


_ARCHIVO_DATOS = (
    Path(__file__).resolve().parent.parent
    / "datos"
    / "datos_negocio_cafe_santo_domingo.xlsx"
)
_NOMBRE_NEGOCIO = "Café Santo Domingo"


class Producto(TypedDict):
    name: str
    price: int | float


class Categoria(TypedDict):
    category: str
    items: list[Producto]


class Informacion(TypedDict):
    topic: str
    details: str


class DatosNegocio(TypedDict):
    business_name: str
    catalog: list[Categoria]
    information: list[Informacion]


def cargar_datos_negocio() -> DatosNegocio:
    """Carga el catálogo y la información del negocio desde la hoja de cálculo."""
    libro = load_workbook(_ARCHIVO_DATOS, read_only=True, data_only=True)
    try:
        productos_por_categoria: dict[str, list[Producto]] = {}
        for producto, precio, categoria in libro["productos"].iter_rows(
            min_row=2,
            values_only=True,
        ):
            productos_por_categoria.setdefault(categoria, []).append(
                {"name": producto, "price": precio}
            )

        informacion = [
            {"topic": tema, "details": detalle}
            for tema, detalle in libro["informacion"].iter_rows(
                min_row=2,
                values_only=True,
            )
        ]
    finally:
        libro.close()

    catalogo = [
        {"category": categoria, "items": productos}
        for categoria, productos in productos_por_categoria.items()
    ]
    return {
        "business_name": _NOMBRE_NEGOCIO,
        "catalog": catalogo,
        "information": informacion,
    }


DATOS_NEGOCIO = cargar_datos_negocio()
