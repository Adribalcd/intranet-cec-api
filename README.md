
# Intranet CEC API - Documentación

API Backend para la Intranet del **CEC Camargo**. Sistema de gestión académica con matrícula por ciclo, control de asistencia, calificaciones y más. El backend está preparado para conectarse con **TiDB Cloud** y desplegarse en **Render**.

## Tecnologías

- **Node.js** + **Express 5**
- **Sequelize 6** (ORM) + **MySQL** / TiDB Cloud
- **JWT** para autenticación
- **Multer** para subida de archivos (fotos, Excel)
- **QRCode** para generación de códigos QR
- **ExcelJS** para generación y lectura de archivos Excel

## Instalación

```bash
npm install
```

## Variables de entorno

Crear un archivo `.env` basado en `.env.example`:

```
HOST=localhost
DB_PORT=3306
DB_USERNAME=root
PASSWORD=tu_password
DATABASE=cec_camargo
JWT_SECRET=tu_secret
PORT=3000
```

## Ejecución

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start

# Ejecutar seed de datos de prueba
npm run seed
```

## Estructura del proyecto

```
src/
├── app.js                    # Configuración Express
├── config/database.js        # Configuración Sequelize/MySQL
├── controllers/
│   ├── adminController.js    # Lógica de endpoints admin
│   └── alumnoController.js   # Lógica de endpoints alumno
├── middlewares/
│   └── authMiddleware.js     # Autenticación JWT y RBAC
├── models/
│   ├── index.js              # Asociaciones entre modelos
│   ├── admin.js
│   ├── alumno.js
│   ├── asistencia.js
│   ├── ciclo.js
│   ├── curso.js
│   ├── examen.js
│   ├── horarioCurso.js
│   ├── material.js
│   ├── matricula.js
│   └── nota.js
├── routes/
│   ├── adminRoutes.js
│   └── alumnoRoutes.js
├── seed/index.js             # Script de datos de prueba
├── uploads/
│   └── fotos/                # Fotos de alumnos
└── utils/
    └── tokenUtils.js         # Generación/validación JWT
```

## Autenticación

La API utiliza **JSON Web Tokens (JWT)**.

* Los endpoints marcados con Auth requieren el header:
  `Authorization: Bearer <tu_token>`

---

## Módulo: Alumno (`/api/alumno`)

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/login` | No | Login con `{ usuario, contrasena }`. Devuelve el JWT. |
| **GET** | `/perfil` | Si | Datos del alumno (nombres, apellidos, ciclo, fotoUrl). |
| **GET** | `/horario` | Si | Lista de cursos: `[{ curso, dia, hora }]`. |
| **GET** | `/asistencia` | Si | Historial: `[{ fecha, estado, hora, observaciones }]`. |
| **GET** | `/calificaciones` | Si | Notas con mérito: `[{ fecha, nota, puesto, tipo }]`. |
| **GET** | `/cursos` | Si | Cursos matriculados: `[{ idCurso, nombreCurso, ciclo }]`. |
| **GET** | `/cursos/:id/materiales` | Si | Materiales por curso y semana (`?semana=X`). |
| **POST** | `/logout` | Si | Cierra la sesión (invalida el token actual). |
| **POST** | `/recuperar-password` | No | Solicita reset enviando `{ email }`. |
| **POST** | `/reset-password` | No | Cambia clave con `{ token, nuevaContrasena, confirmar }`. |

---

## Módulo: Admin (`/api/admin`)

### Gestión de Ciclos y Cursos

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/login` | No | Login administrativo con `{ usuario, contrasena }`. |
| **GET** | `/ciclos` | Si | Lista todos los ciclos académicos (incluye `duracion_meses` calculada). |
| **POST** | `/ciclos` | Si | Crear ciclo `{ nombre, fechaInicio, duracion, fechaFin? }`. |
| **PUT** | `/ciclos/:id` | Si | Actualizar datos de un ciclo existente. |
| **DELETE** | `/ciclos/:id` | Si | Eliminar un ciclo. |
| **GET** | `/cursos` | Si | Listar todos los cursos disponibles (incluye datos del ciclo). |
| **POST** | `/cursos` | Si | Crear curso `{ nombre, profesor, cicloId }`. |
| **PUT** | `/cursos/:id` | Si | Actualizar información del curso. |
| **DELETE** | `/cursos/:id` | Si | Eliminar un curso. |

### Matrícula (por ciclo)

La matrícula es por **ciclo**, no por curso. Se usa el **código del alumno** en lugar del ID.

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/matricula/manual` | Si | Matrícula individual `{ codigoAlumno, cicloId }`. |
| **POST** | `/matricula/masiva` | Si | Matrícula masiva `{ registros: [{ codigoAlumno, cicloId }] }`. |

### Alumnos

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **GET** | `/alumno/:codigo` | Si | Obtener datos del alumno por código (incluye matrículas y ciclos). |
| **POST** | `/alumno/:codigo/foto` | Si | Subir foto del alumno (form-data, campo `foto`, max 5MB, jpg/png/webp). |
| **GET** | `/alumno/:codigo/qr` | Si | Descargar QR del alumno como imagen PNG. |
| **GET** | `/ciclo-vigente/alumnos` | Si | Listar alumnos matriculados en el ciclo vigente. |

### Asistencia

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/asistencia` | Si | Registrar asistencia rápida mediante `{ dni }`. |
| **POST** | `/asistencia/inhabilitar-dia` | Si | Inhabilitar día por feriado o evento `{ cicloId, fecha }`. |
| **GET** | `/asistencia/listado` | Si | Listado de asistencia por día y ciclo (`?cicloId=X&fecha=YYYY-MM-DD`). |

### Exámenes y Calificaciones

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/examen` | Si | Crear examen `{ cicloId, semana, tipoExamen, fecha }`. |
| **POST** | `/examen/:examenId/calificaciones` | Si | Registrar notas `[{ codigoAlumno, nota }]` + cálculo automático de mérito. |
| **GET** | `/examen/:examenId/plantilla-notas` | Si | Descargar plantilla Excel con alumnos matriculados (CODIGO, NOMBRE_COMPLETO, NOTA). |
| **POST** | `/examen/:examenId/notas-excel` | Si | Subir Excel con notas (form-data, campo `archivo`, .xlsx) + cálculo automático de mérito. |

#### Flujo de registro masivo de notas con Excel

1. **Descargar plantilla**: `GET /api/admin/examen/:examenId/plantilla-notas` → archivo `.xlsx`
2. **Llenar notas**: El admin completa la columna NOTA en el Excel descargado
3. **Subir Excel**: `POST /api/admin/examen/:examenId/notas-excel` con el archivo rellenado

---

## Resumen de Implementación

* **Total de Endpoints:** 32
* **Endpoints Alumno:** 10
* **Endpoints Admin:** 22
* **Base de Datos:** TiDB Cloud (MySQL compatible)
* **Hosting:** Render

---

## Modelos y relaciones

```
Ciclo (1) ──→ (N) Curso
Ciclo (1) ──→ (N) Examen
Ciclo (1) ──→ (N) Asistencia
Ciclo (1) ──→ (N) Matricula

Curso (1) ──→ (N) HorarioCurso
Curso (1) ──→ (N) Material

Alumno (1) ──→ (N) Nota
Alumno (1) ──→ (N) Asistencia
Alumno (1) ──→ (N) Matricula

Examen (1) ──→ (N) Nota
```

---

## Carga de Datos de Prueba (Seeding)

Para poblar la base de datos en **TiDB Cloud** con datos consistentes, utiliza el script de semilla. Este proceso asegura que todos los desarrolladores utilicen el mismo set de datos para pruebas de frontend y backend.

### Ejecución

En la terminal del proyecto, ejecuta:

```bash
npm run seed
```

### Datos Generados automáticamente

| Categoría | Detalle de los Datos | Credenciales |
| --- | --- | --- |
| **Admin** | 1 Usuario maestro | `admin` / `123456` |
| **Alumnos** | 5 Alumnos (70001234 al 70007890) | Código / `123456` |
| **Académico** | 2 Ciclos (2026-I, 2025-II) y 5 Cursos | Matemáticas, Física, etc. |
| **Contenido** | 9 Horarios, 7 PDFs de materiales | --- |
| **Evaluación** | 3 Exámenes y 13 Notas con **Orden de Mérito** | --- |
| **Asistencia** | 30 Registros (Incluye 1 día inhabilitado) | --- |

> [!CAUTION]
> **ADVERTENCIA:** El script utiliza `sync({ force: true })`. Esto **BORRARÁ TODA LA INFORMACIÓN ACTUAL** de las tablas antes de crearlas. **No lo uses en producción** (Render) una vez que el cliente empiece a cargar datos reales.

---

## Notas importantes

- Todos los endpoints admin requieren token JWT con rol `admin` (header `Authorization: Bearer <token>`)
- Todos los endpoints alumno requieren token JWT con rol `alumno`
- Las fotos se sirven estáticamente desde `/uploads/fotos/`
- El QR se genera únicamente con el código del alumno
- Las calificaciones calculan el puesto (ranking) automáticamente al registrarse
- La plantilla Excel se genera con los alumnos matriculados en el ciclo del examen
