# Informe: estructura para desplegar el agente en un servidor

## Resumen ejecutivo

El agente puede reutilizarse desde otros módulos, pero la aplicación actual
está diseñada como una conversación interactiva en una sola terminal. Para
atender a varias personas desde un servidor, recomiendo conservar la lógica del
agente y añadir una API HTTP que gestione conversaciones identificadas por
sesión. La primera interfaz podría ser una aplicación web; más adelante, otros
canales podrían llamar a la misma API.

La API debe crear una instancia de agente por conversación o petición, recuperar
el historial de esa conversación desde almacenamiento persistente y guardar
cualquier cambio. Para producción, también conviene mover el registro de
pedidos de Excel a una base de datos.

## Estado actual observado

- [main.py](./main.py) carga variables de entorno, crea un agente e inicia la
  conversación de terminal.
- [conversacion.py](./agent_ai_builder/conversacion.py) usa `input()` y
  `print()` en un bucle; no ofrece una interfaz que pueda consumir un navegador
  o una aplicación móvil.
- [agent.py](./agent_ai_builder/agent.py) mantiene el historial en
  `self.historial`. Una instancia compartida entre clientes mezclaría sus
  conversaciones; una instancia en memoria tampoco conserva el estado tras un
  reinicio ni lo comparte entre procesos.
- [datos.py](./agent_ai_builder/datos.py) carga la información del negocio y
  registra pedidos en `datos/pedidos.xlsx`. Un candado serializa las escrituras
  de hilos dentro de un mismo proceso; el XLSX no coordina varias réplicas o
  procesos y puede perderse si la plataforma usa un sistema de archivos
  efímero.
- [pyproject.toml](./pyproject.toml) declara Groq, OpenPyXL y python-dotenv, pero
  todavía no declara un servidor HTTP ni una base de datos.

## Arquitectura recomendada

```text
Navegador / aplicación
        |
        | HTTPS
        v
Proxy o plataforma administrada
        |
        v
API HTTP (FastAPI)
        |                    \
        |                     \--> Groq API
        v
PostgreSQL
  - conversaciones
  - mensajes
  - pedidos
```

### Componentes

1. **API HTTP con FastAPI.** Expone operaciones para crear una conversación y
   enviar mensajes. FastAPI encaja con el proyecto Python y permite validar los
   datos de entrada y documentar el contrato de la API.
2. **Servicio de conversación.** Reutiliza `Agente` y el prompt actual, pero
   recibe el historial de una conversación específica y devuelve la respuesta
   sin interactuar con la terminal. La terminal puede conservarse como una
   interfaz de desarrollo independiente.
3. **Persistencia relacional.** PostgreSQL almacena conversaciones, mensajes,
   pedidos y su relación con el usuario o cliente. El identificador de
   conversación no debe permitir consultar datos de otra persona.
4. **Interfaz de usuario.** Una web sencilla puede consumir la API. Si el
   objetivo principal es WhatsApp u otro canal, ese canal debe integrarse como
   un adaptador que invoque el mismo servicio, en vez de duplicar la lógica del
   agente.
5. **Despliegue administrado.** Empaquetar la aplicación en un contenedor y
   ejecutarla en una plataforma que admita HTTPS, variables secretas, reinicios
   y registros. No es necesario comenzar con Kubernetes.

## Contrato inicial sugerido para la API

- `POST /api/v1/conversations`: crea una conversación y devuelve su
  identificador.
- `POST /api/v1/conversations/{id}/messages`: recibe el mensaje del cliente,
  carga el historial asociado, consulta el agente, persiste ambos mensajes y
  devuelve la respuesta.
- `GET /health`: indica que el proceso está activo.
- `GET /ready`: indica que el servicio puede atender tráfico, verificando sus
  dependencias esenciales según la plataforma.

El servidor debe identificar y autorizar al usuario antes de leer o modificar
una conversación. Para un prototipo controlado puede usarse un token de acceso;
para una aplicación pública se necesita autenticación adecuada al canal.

## Cambios de diseño necesarios antes de atender varios clientes

### Aislamiento de conversaciones

No se debe guardar el historial de todos los usuarios en una instancia global
de `Agente`. Cada solicitud debe recuperar solo el historial de la conversación
autorizada y ejecutar la respuesta con ese contexto. Debe definirse además cómo
se limitan y archivan los historiales para controlar crecimiento, privacidad y
costo de tokens.

### Pedidos y concurrencia

Reemplazar `pedidos.xlsx` como registro operativo por una tabla de pedidos en
PostgreSQL, con identificador, conversación, detalle, importe referencial,
estado y marcas de tiempo. La escritura en base de datos debe ser transaccional
y validar cantidades y productos en el servidor. Excel podría seguir sirviendo
para exportaciones o informes, no como fuente compartida de escritura.

### Datos del negocio

Para la primera versión, el catálogo puede continuar empaquetado como dato de
solo lectura si se garantiza que el archivo XLSX se incluye en la imagen de
despliegue. A medio plazo, conviene cargarlo a una base de datos o a una fuente
administrable, para actualizar precios y productos sin reconstruir el servicio.

### Dependencias externas y fallos

Las solicitudes a Groq pueden tardar o fallar. La API debe aplicar tiempos de
espera, manejar de forma explícita los errores del proveedor y devolver códigos
HTTP apropiados, sin reportar éxito si no se obtuvo una respuesta. Conviene
establecer límites de frecuencia y longitud de mensajes para proteger costos y
disponibilidad. Si el volumen o el tiempo de respuesta lo exige, se puede
incorporar una cola de trabajos más adelante; no es necesaria para el primer
despliegue síncrono.

## Seguridad, privacidad y operación

- Guardar `GROQ_API_KEY` y credenciales de base de datos como secretos de la
  plataforma; nunca exponerlos al navegador ni incluirlos en el repositorio.
- Usar HTTPS, validar entrada, limitar tamaño y frecuencia de solicitudes y
  configurar CORS únicamente para los orígenes web necesarios.
- Comprobar que el usuario autenticado es dueño de cada conversación antes de
  cargar su historial. No confiar en un identificador de sesión enviado por el
  cliente como autorización.
- Evitar registrar conversaciones, nombres, datos sensibles o claves en logs.
  Revisar el registro actual de uso de tokens en consola antes de reutilizarlo
  en producción.
- Definir políticas de conservación y eliminación del historial, y documentar
  qué datos de clientes se guardan.
- Añadir registros de errores y métricas operativas sin contenido personal,
  además de endpoints de salud y alertas para fallos reiterados.
- Configurar copias de seguridad y una estrategia de migraciones para la base
  de datos.

## Plan por etapas

1. **Separar interfaz y lógica.** Asegurar que el servicio de conversación
   pueda recibir un historial y retornar una respuesta, sin `input()` ni
   `print()` en el flujo utilizado por la API.
2. **Construir el MVP HTTP.** Implementar FastAPI, validación de solicitudes,
   creación de sesiones, autenticación acorde al público y respuestas de error
   claras.
3. **Persistir el estado.** Guardar conversaciones y mensajes en PostgreSQL;
   migrar el registro de pedidos de Excel a tablas transaccionales.
4. **Desplegar una instancia inicial.** Contenedor en una plataforma
   administrada, HTTPS, secretos, health checks y una instancia inicialmente.
   Mantener la aplicación sin estado local para permitir reinicios y futuras
   réplicas.
5. **Verificar antes de abrir al público.** Probar sesiones simultáneas sin
   cruces de historial, pedidos concurrentes, reinicios, errores de Groq,
   autorización, límites y restauración de copias de seguridad.
6. **Escalar por demanda.** Aumentar réplicas cuando haya métricas que lo
   justifiquen. Al estar el historial y los pedidos en almacenamiento
   compartido, las solicitudes podrán llegar a distintos procesos sin depender
   de afinidad de sesión.

## Recomendación

Para este proyecto, empezaría con **FastAPI + PostgreSQL + un contenedor en una
plataforma administrada**, y una interfaz web mínima si el canal todavía está
por decidir. Mantendría la clase `Agente` como núcleo reutilizable, pero
separaría el transporte HTTP, la gestión de sesión y el almacenamiento. Esta
opción resuelve primero el acceso multiusuario y deja abierta la incorporación
de WhatsApp u otros canales sin rehacer el agente.

No recomiendo exponer directamente el programa de terminal, compartir una única
instancia global del agente entre clientes ni depender del XLSX local para
historiales o pedidos en producción.

## Decisiones pendientes para la implementación

- Canal inicial: web propia, integración de mensajería o ambos.
- Tipo de autenticación y si el servicio será público o solo para clientes
  autenticados.
- Requisitos de conservación, eliminación y acceso al historial.
- Plataforma concreta de despliegue, región y presupuesto.
- Si los precios y datos del negocio deben actualizarse sin publicar una nueva
  versión.
