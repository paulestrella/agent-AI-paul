## Estructura

La clase `Agente` vive en el paquete `agent_ai_builder`, separada del punto de
entrada `main.py`. Esta estructura permite reutilizarla desde otros módulos y
añadir pruebas sin ejecutar el programa principal.

## Configuracion

Define la variable de entorno `GROQ_API_KEY` antes de crear un agente:

```sh
export GROQ_API_KEY="tu-api-key"
```

Ejemplo de uso:

```python
from agent_ai_builder import Agente

agente = Agente("Responde de forma clara y concisa.")
```
