from agent_ai_builder.tools import ejecutar_herramienta


print(
    ejecutar_herramienta(
        "registrar_pedido",
        {
            "items": [
                {
                    "producto": "espresso",
                    "cantidad": 1,
                }
            ]
        },
        "+18095550000",
    )
)
