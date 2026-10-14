from dotenv import load_dotenv

from agent_ai_builder.clientes import _obtener_agente_y_candado

load_dotenv()

maria, _ = _obtener_agente_y_candado("Maria")
maria_otra_vez, _ = _obtener_agente_y_candado("Maria")

pedro, _ = _obtener_agente_y_candado("pedro")

print(maria is maria_otra_vez)
print(maria is pedro)
