from openpyxl import Workbook

from agent_ai_builder.limpieza import MAX_DETALLE, MAX_NOMBRE, limpiar_texto

fallos = 0


def comprobar(nombre, bien):
    global fallos
    if not bien:
        fallos += 1
    print(f"{'✓' if bien else '✗'} {nombre}")


comprobar("Un texto normal no cambia", limpiar_texto("2 cappuccinos y un croissant", MAX_DETALLE) == "2 cappuccinos y un croissant")
comprobar("Quita el = del principio (fórmulas)", limpiar_texto('=HYPERLINK("http://x.com")', MAX_NOMBRE) == 'HYPERLINK("http://x.com")')
comprobar("Quita + - @ del principio", limpiar_texto("+52 -1 @ana", MAX_NOMBRE) == "52 -1 @ana")
comprobar("Une los saltos de línea y espacios repetidos", limpiar_texto("pedido\n\n  de   café ", MAX_DETALLE) == "pedido de café")
comprobar("Quita caracteres de control invisibles", limpiar_texto("hola\x00\x07mundo", MAX_NOMBRE) == "holamundo")
comprobar("Corta lo que pasa del largo máximo", len(limpiar_texto("a" * 1000, MAX_DETALLE)) == MAX_DETALLE)

libro = Workbook()
hoja = libro.active
hoja.append(['=HYPERLINK("http://x.com")', limpiar_texto('=HYPERLINK("http://x.com")', MAX_NOMBRE)])
sin_limpiar, limpio = hoja["A1"].data_type, hoja["B1"].data_type
print(f"   Sin limpiar, Excel lo guardaría como tipo '{sin_limpiar}' (f = fórmula); ya limpio: '{limpio}' (s = texto).")
comprobar("Un texto limpio se guarda como texto, no como fórmula", sin_limpiar == "f" and limpio == "s")

print("\nTodo en orden." if fallos == 0 else f"\n{fallos} prueba(s) fallaron.")
raise SystemExit(0 if fallos == 0 else 1)