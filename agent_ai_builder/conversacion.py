def iniciar_conversacion(agente):
    print(f"¡Bienvenido a {agente.nombre_negocio}! ¿En qué puedo ayudarte?")
    print("Escribe 'salir' para terminar la conversación.")

    while True:
        mensaje = input("Tú: ").strip()
        if mensaje.lower() == "salir":
            agente.mostrar_historial()
            break

        respuesta = agente.responder(mensaje)
        print(f"{agente.nombre_negocio}: {respuesta}")