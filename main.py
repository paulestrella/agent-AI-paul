from dotenv import load_dotenv

from agent_ai_builder import Agente
from agent_ai_builder.conversacion import iniciar_conversacion
from agent_ai_builder.system_prompts import SYSTEM_PROMPTS


def main():
    load_dotenv()
    agente = Agente(SYSTEM_PROMPTS)
    iniciar_conversacion(agente)


if __name__ == "__main__":
    main()
