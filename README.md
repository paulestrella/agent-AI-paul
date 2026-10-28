## Estructura

La clase `Agente` vive en el paquete `agent_ai_builder`, separada del punto de
entrada `main.py`. Esta estructura permite reutilizarla desde otros módulos y
añadir pruebas sin ejecutar el programa principal.

La hoja de cálculo con los datos del negocio se guarda en `datos/`.
`agent_ai_builder/datos.py` es el único módulo responsable de cargarla; los
prompts y las herramientas consumen los datos desde ese módulo.
Los pedidos confirmados por el cliente se registran en `datos/pedidos.xlsx`;
ese archivo local está excluido del control de versiones.

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
## Puente de WhatsApp

El agente también atiende por WhatsApp (uso educativo, no oficial) mediante un puente en Node.js con Baileys.

1. Servidor, desde la raíz: `uv run uvicorn servidor:app --reload`
2. Puente: `cd puente_whatsapp` y `npm start` (la primera vez hay que escanear el QR)
3. Pruebas que no necesitan WhatsApp: `npm run probar:logica` y `npm run probar:atencion`

Nunca se suben a GitHub: `puente_whatsapp/sesion/`, `puente_whatsapp/qr.png` ni los archivos `.env`.