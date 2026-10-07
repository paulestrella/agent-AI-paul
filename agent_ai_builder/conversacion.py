def iniciar_conversacion(agente):
    agente.nombre_usuario = input("¿Cuál es tu nombre? ").strip() or "Usuario"
    agente.historial.append(
        {
            "role": "user",
            "content": f"Mi nombre es {agente.nombre_usuario}.",
        }
    )

    print(
        f"¡Bienvenido a {agente.nombre_negocio}, "
        f"{agente.nombre_usuario}! ¿En qué puedo ayudarte?"
    )
    print("Escribe 'salir' para terminar la conversación.")

    while True:
        mensaje = input(f"{agente.nombre_usuario}: ").strip()
        if mensaje.lower() == "salir":
            agente.mostrar_historial()
            break

        respuesta = agente.responder(mensaje)
        print(f"{agente.nombre_negocio}: {respuesta}")