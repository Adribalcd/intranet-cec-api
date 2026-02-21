# intranet-cec-api

API Backend para la Intranet del CEC Camargo. Sistema de gestión académica con matrícula por ciclo, control de asistencia, calificaciones y más.

## Tecnologías

- **Node.js** + **Express 5**
- **Sequelize 6** (ORM) + **MySQL**
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

## Endpoints

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/login` | Login admin (`{ usuario, contrasena }`) |
| POST | `/api/alumno/login` | Login alumno (`{ usuario, contrasena }`) |

---

### Admin — Ciclos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/ciclos` | Listar ciclos (incluye `duracion_meses` calculada) |
| POST | `/api/admin/ciclos` | Crear ciclo (`{ nombre, fechaInicio, fechaFin }` o `{ nombre, fechaInicio, duracion }`) |
| PUT | `/api/admin/ciclos/:id` | Actualizar ciclo |
| DELETE | `/api/admin/ciclos/:id` | Eliminar ciclo |

---

### Admin — Cursos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/cursos` | Listar cursos (incluye datos del ciclo) |
| POST | `/api/admin/cursos` | Crear curso (`{ nombre, profesor, cicloId }`) |
| PUT | `/api/admin/cursos/:id` | Actualizar curso |
| DELETE | `/api/admin/cursos/:id` | Eliminar curso |

---

### Admin — Matrícula (por ciclo)

La matrícula es por **ciclo**, no por curso. Se usa el **código del alumno** en lugar del ID.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/matricula/manual` | Matricular un alumno (`{ codigoAlumno, cicloId }`) |
| POST | `/api/admin/matricula/masiva` | Matrícula masiva (`{ registros: [{ codigoAlumno, cicloId }] }`) |

---

### Admin — Alumnos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/alumno/:codigo` | Obtener datos del alumno por código (incluye matrículas y ciclos) |
| POST | `/api/admin/alumno/:codigo/foto` | Subir foto del alumno (form-data, campo `foto`, max 5MB, jpg/png/webp) |
| GET | `/api/admin/alumno/:codigo/qr` | Descargar QR del alumno como imagen PNG |
| GET | `/api/admin/ciclo-vigente/alumnos` | Listar alumnos matriculados en el ciclo vigente |

---

### Admin — Asistencia

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/asistencia` | Registrar asistencia por código (`{ dni }`) |
| POST | `/api/admin/asistencia/inhabilitar-dia` | Inhabilitar día completo (`{ cicloId, fecha }`) |
| GET | `/api/admin/asistencia/listado` | Listado de asistencia por día y ciclo (`?cicloId=X&fecha=YYYY-MM-DD`) |

---

### Admin — Exámenes y Calificaciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/examen` | Crear examen (`{ cicloId, semana, tipoExamen, fecha }`) |
| POST | `/api/admin/examen/:examenId/calificaciones` | Registrar notas (`[{ codigoAlumno, nota }]`) — calcula puestos automáticamente |
| GET | `/api/admin/examen/:examenId/plantilla-notas` | Descargar plantilla Excel con alumnos matriculados (CODIGO, NOMBRE_COMPLETO, NOTA) |
| POST | `/api/admin/examen/:examenId/notas-excel` | Subir Excel con notas (form-data, campo `archivo`, .xlsx) — calcula puestos automáticamente |

#### Flujo de registro masivo de notas con Excel

1. **Descargar plantilla**: `GET /api/admin/examen/:examenId/plantilla-notas` → archivo `.xlsx`
2. **Llenar notas**: El admin completa la columna NOTA en el Excel descargado
3. **Subir Excel**: `POST /api/admin/examen/:examenId/notas-excel` con el archivo rellenado

---

### Alumno (requiere token de alumno)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/alumno/perfil` | Perfil del alumno (nombre, foto, ciclo) |
| GET | `/api/alumno/horario` | Horario de clases |
| GET | `/api/alumno/asistencia` | Historial de asistencia |
| GET | `/api/alumno/calificaciones` | Calificaciones con datos del examen |
| GET | `/api/alumno/cursos` | Cursos matriculados |
| GET | `/api/alumno/cursos/:idCurso/materiales` | Materiales del curso (filtro opcional `?semana=X`) |
| POST | `/api/alumno/logout` | Cerrar sesión |
| POST | `/api/alumno/recuperar-password` | Recuperar contraseña |
| POST | `/api/alumno/reset-password` | Restablecer contraseña |

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

## Notas importantes

- Todos los endpoints admin requieren token JWT con rol `admin` (header `Authorization: Bearer <token>`)
- Todos los endpoints alumno requieren token JWT con rol `alumno`
- Las fotos se sirven estáticamente desde `/uploads/fotos/`
- El QR se genera únicamente con el código del alumno
- Las calificaciones calculan el puesto (ranking) automáticamente al registrarse
- La plantilla Excel se genera con los alumnos matriculados en el ciclo del examen
