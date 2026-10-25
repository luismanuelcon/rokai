# PRD — Plataforma ROKAI

## 1. Propósito del producto

ROKAI contará con una plataforma web responsive para presentar públicamente el servicio de alquiler de patinetas eléctricas y administrar internamente el registro de los alquileres.

La solución tendrá dos áreas claramente separadas:

1. **Portal público:** dirigido a clientes y visitantes.
2. **Portal de gestión:** dirigido exclusivamente a trabajadores, operadores turísticos y administradores autorizados.

## 2. Alcance inicial del producto (MVP)

### 2.1 Portal público

El usuario final podrá:

- Consultar las tarifas vigentes.
- Consultar preguntas frecuentes.
- Consultar los términos y condiciones del servicio.
- Consultar la política de privacidad y tratamiento de datos.
- Aceptar, rechazar o configurar las cookies no esenciales.
- Consultar información general del servicio, horarios, ubicación y medios de contacto.

El usuario final no podrá:

- Registrar directamente un alquiler.
- Iniciar o finalizar un alquiler.
- Modificar tarifas.
- Consultar información de otros clientes.
- Acceder al panel operativo o administrativo.

### 2.2 Portal privado de gestión

El registro de los alquileres será realizado por un trabajador u operador turístico autorizado.

El portal privado permitirá, como mínimo:

- Identificar al trabajador u operador que realiza la operación.
- Registrar los datos necesarios del cliente.
- Seleccionar la patineta asignada.
- Registrar la tarifa y duración contratadas.
- Registrar la hora de inicio del alquiler.
- Consultar los alquileres activos.
- Finalizar el alquiler.
- Registrar la hora de devolución y el valor final.
- Registrar novedades del servicio o del equipo.

Las funciones de configuración, tarifas, usuarios, reportes y administración estarán restringidas al rol Administrador.

## 3. Actores y roles

### 3.1 Visitante o cliente final

Usuario no autenticado que consulta la información pública de ROKAI.

Permisos:

- Consultar información pública.
- Consultar tarifas vigentes.
- Consultar preguntas frecuentes.
- Consultar documentos legales.
- Administrar sus preferencias de cookies.

Restricciones:

- No puede registrar alquileres.
- No puede acceder a información operativa.
- No puede acceder a datos personales de clientes.
- No puede modificar información del sistema.

### 3.2 Trabajador u operador turístico

Usuario autenticado autorizado para atender clientes y gestionar alquileres.

Permisos iniciales:

- Registrar clientes para un alquiler.
- Crear un alquiler.
- Consultar alquileres activos.
- Consultar disponibilidad de patinetas.
- Finalizar un alquiler.
- Registrar pagos y novedades, cuando estas funciones estén habilitadas.
- Consultar únicamente la información necesaria para realizar su trabajo.

Restricciones:

- No puede modificar las tarifas oficiales.
- No puede administrar usuarios ni roles.
- No puede cambiar la configuración general del negocio.
- No puede eliminar el historial de alquileres.

### 3.3 Administrador

Usuario autenticado responsable de administrar la plataforma.

Permisos iniciales:

- Acceder a todas las funciones del portal privado.
- Crear, activar, bloquear o desactivar trabajadores y operadores.
- Configurar tarifas.
- Administrar patinetas y cascos.
- Consultar alquileres, clientes, novedades y reportes.
- Configurar la información pública del servicio.
- Consultar la trazabilidad de las operaciones.

## 4. Reglas de negocio confirmadas

### RN-001 — Separación de áreas

El portal público y el portal de gestión deberán estar claramente separados. Las funciones operativas requerirán autenticación.

### RN-002 — Registro exclusivo por personal autorizado

Todo alquiler deberá ser registrado por un trabajador, operador turístico o administrador autenticado.

### RN-003 — Sin autoservicio del cliente en el MVP

El cliente final no podrá crear reservas ni registrar alquileres directamente desde el portal público durante la primera versión.

### RN-004 — Identificación del responsable

Cada alquiler deberá conservar el identificador del trabajador u operador que lo registró y del usuario que lo finalizó.

### RN-005 — Tarifas públicas vigentes

El portal público solo mostrará tarifas activas y vigentes. Las tarifas inactivas, vencidas o programadas para una fecha futura no deberán mostrarse como disponibles.

### RN-006 — Tarifas administrables

Solo un administrador podrá crear o modificar tarifas. Un trabajador u operador deberá aplicar las tarifas vigentes sin modificar su valor durante el registro, salvo que posteriormente se defina un permiso especial o esquema de descuentos.

### RN-007 — Preguntas frecuentes administrables

Las preguntas frecuentes serán públicas. Su creación, modificación, orden y publicación estarán reservados al administrador.

### RN-008 — Documentos legales públicos

Los términos y condiciones, la política de privacidad y la política de cookies deberán estar disponibles sin iniciar sesión.

### RN-009 — Consentimiento de cookies

En la primera visita, el portal deberá mostrar un aviso de cookies que permita:

- Aceptar todas las cookies.
- Rechazar las cookies no esenciales.
- Configurar preferencias.

Las cookies estrictamente necesarias para seguridad y funcionamiento podrán permanecer activas. Las cookies analíticas, publicitarias o de terceros no deberán activarse antes del consentimiento correspondiente.

### RN-010 — Persistencia de preferencias de cookies

La preferencia de cookies del visitante deberá conservarse y podrá modificarse posteriormente desde un enlace visible en el portal.

### RN-011 — Protección del portal privado

Ninguna función, pantalla o endpoint operativo deberá quedar disponible para usuarios no autenticados.

### RN-012 — Control de acceso por rol

El sistema deberá validar los permisos tanto en la interfaz como en el servidor. Ocultar una opción en pantalla no reemplaza la autorización del backend.

### RN-013 — Trazabilidad

Las operaciones relevantes deberán registrar como mínimo:

- Usuario responsable.
- Fecha y hora.
- Acción realizada.
- Alquiler o entidad afectada.

### RN-014 — Conservación del historial

Los alquileres finalizados formarán parte del historial operativo. No podrán eliminarse físicamente desde la operación normal; cualquier anulación futura deberá conservar la trazabilidad.

### RN-015 — Diseño multidispositivo

La plataforma deberá funcionar en:

- Móvil para consulta pública y operaciones rápidas.
- Tablet como dispositivo principal del trabajador u operador.
- Navegador web de escritorio para administración.

### RN-016 — Continuidad del registro

El formulario de alquiler deberá proteger la información ingresada frente a recargas accidentales, cambios de orientación o interrupciones breves de conexión, siempre que sea técnicamente posible y sin comprometer información sensible.

### RN-017 — Información pública sin autenticación

La consulta de tarifas, preguntas frecuentes, horarios, ubicación, contacto y documentos legales no requerirá creación de cuenta ni inicio de sesión.

## 5. Fuera del alcance inicial

Las siguientes funciones no forman parte del MVP, salvo decisión posterior:

- Registro autónomo de alquileres por parte del cliente.
- Reserva anticipada en línea.
- Pago en línea desde el portal público.
- Aplicación móvil nativa para clientes.
- Programa de puntos o fidelización.
- Marketplace de operadores turísticos.

## 6. Reglas pendientes por definir

Estas decisiones todavía no se consideran requisitos confirmados:

- Datos obligatorios del cliente.
- Edad mínima y autorización para menores.
- Esquema definitivo de tarifas y promociones.
- Métodos de pago aceptados.
- Manejo de depósitos o garantías.
- Cálculo de tiempo adicional y recargos.
- Flujo de entrega y devolución de patineta y casco.
- Reglas ante daños, accidentes, lluvia o pérdida del equipo.
- Alcance exacto del operador turístico frente al trabajador directo.
- Uso operativo de los tags y alcance de la ubicación disponible.
- Firma, evidencia o mecanismo de aceptación de términos durante el alquiler.
- Tiempo de conservación de datos personales y registros operativos.

## 7. Principio de producto

El portal público deberá ser simple, rápido y orientado a informar. El portal privado deberá reducir el tiempo operativo, evitar cálculos manuales y mantener trazabilidad sobre cada alquiler.
