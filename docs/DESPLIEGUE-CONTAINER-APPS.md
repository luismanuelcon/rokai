# Despliegue automático de ROKAI

Cada push a main construye la imagen en GHCR y después actualiza Azure Container Apps con la etiqueta exacta del commit. Publicar una imagen por sí solo no actualiza el sitio.

## Configuración inicial en GitHub

En Settings → Secrets and variables → Actions del repositorio:

| Tipo     | Nombre                   | Contenido                                           |
| -------- | ------------------------ | --------------------------------------------------- |
| Variable | AZURE_CONTAINER_APP_NAME | Nombre de la Container App que sirve soyrokai.com   |
| Variable | AZURE_RESOURCE_GROUP     | Grupo de recursos de esa aplicación                 |
| Secret   | AZURE_CLIENT_ID          | Identificador de la aplicación o identidad de Azure |
| Secret   | AZURE_TENANT_ID          | Tenant de Azure                                     |
| Secret   | AZURE_SUBSCRIPTION_ID    | Suscripción de Azure                                |

Configurar una credencial federada OIDC de esa identidad con issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange` y subject `repo:luismanuelcon/rokai:ref:refs/heads/main`. Otorgar a la identidad permisos de actualización de Container Apps sobre la aplicación (por ejemplo, Container Apps Contributor con alcance a ese recurso).

La Container App debe poder descargar imágenes de ghcr.io/luismanuelcon/rokai. Si el paquete es privado, conservar/configurar las credenciales de lectura del registro en Azure; el GITHUB_TOKEN del runner solo publica la imagen. No copiar credenciales a archivos del repositorio.

## Flujo

1. Construye y publica la imagen etiquetada con el SHA del commit.
2. Comprueba la configuración y se autentica mediante OIDC.
3. Usa revisiones múltiples para conservar la anterior durante el arranque.
4. Crea una revisión identificada por la ejecución de GitHub.
5. Espera a que Azure reporte Healthy y dirige el 100 % del tráfico a esa revisión.
6. Comprueba `/api/v1/ready` y registra commit y revisión en el resumen.

La aplicación necesita una réplica capaz de arrancar en la nueva revisión y sondas de salud correctamente configuradas. El contenedor ejecuta las migraciones existentes al arrancar; los cambios de esquema deben ser compatibles con la revisión anterior durante la transición.

Si falla antes de cambiar el tráfico, se mantiene la revisión anterior. Si falla la comprobación final, revisar Azure y revertir el tráfico a la revisión anterior si corresponde. No se eliminan revisiones automáticamente.

Tras configurar los cinco valores, reejecutar el job fallido o lanzar manualmente “Imagen y despliegue (Container Apps)” sobre main. Un resultado verde requiere completar también el job de despliegue. El workflow “Despliegue (App Service)” es una alternativa para otra plataforma y no debe usarse para esta Container App.
