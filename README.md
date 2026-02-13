Aquí tienes la documentación de tu API organizada en un formato **Markdown** limpio, profesional y fácil de leer. Este formato es ideal para el archivo `README.md` de tu repositorio en GitHub, para que tus otros 2 devs tengan la referencia a la mano.

---

# 🎓 Intranet CEC API - Documentación

Documentación de los endpoints para el sistema de intranet de la academia **CEC Camargo**. El backend está preparado para conectarse con **TiDB Cloud** y desplegarse en **Render**.

## 🛡️ Autenticación

La API utiliza **JSON Web Tokens (JWT)**.

* Los endpoints marcados con `Auth: Bearer` requieren el header:
`Authorization: Bearer <tu_token>`

---

## 👨‍🎓 Módulo: Alumno (`/api/alumno`)

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/login` | No | Login con `{ usuario, contrasena }`. Devuelve el JWT. |
| **GET** | `/perfil` | **Sí** | Datos del alumno (nombres, apellidos, ciclo, fotoUrl). |
| **GET** | `/horario` | **Sí** | Lista de cursos: `[{ curso, dia, hora }]`. |
| **GET** | `/asistencia` | **Sí** | Historial: `[{ fecha, estado, hora, observaciones }]`. |
| **GET** | `/calificaciones` | **Sí** | Notas con mérito: `[{ fecha, nota, puesto, tipo }]`. |
| **GET** | `/cursos` | **Sí** | Cursos matriculados: `[{ idCurso, nombreCurso, ciclo }]`. |
| **GET** | `/cursos/:id/materiales` | **Sí** | Materiales por curso y semana (`?semana=X`). |
| **POST** | `/logout` | **Sí** | Cierra la sesión (invalida el token actual). |
| **POST** | `/recuperar-password` | No | Solicita reset enviando `{ email }`. |
| **POST** | `/reset-password` | No | Cambia clave con `{ token, nuevaContrasena, confirmar }`. |

---

## 🔑 Módulo: Admin (`/api/admin`)

### 📦 Gestión de Ciclos y Cursos

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/login` | No | Login administrativo con `{ usuario, contrasena }`. |
| **GET** | `/ciclos` | **Sí** | Lista todos los ciclos académicos. |
| **POST** | `/ciclos` | **Sí** | Crear ciclo `{ nombre, fechaInicio, duracion, fechaFin? }`. |
| **PUT** | `/ciclos/:id` | **Sí** | Actualizar datos de un ciclo existente. |
| **DELETE** | `/ciclos/:id` | **Sí** | Eliminar un ciclo. |
| **GET** | `/cursos` | **Sí** | Listar todos los cursos disponibles. |
| **POST** | `/cursos` | **Sí** | Crear curso `{ nombre, profesor, cicloId }`. |
| **PUT** | `/cursos/:id` | **Sí** | Actualizar información del curso. |
| **DELETE** | `/cursos/:id` | **Sí** | Eliminar un curso. |

### 📝 Matrícula y Asistencia

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/matricula/manual` | **Sí** | Matrícula individual `{ alumnoId, cursoId, cicloId }`. |
| **POST** | `/matricula/masiva` | **Sí** | Matrícula masiva mediante un array de registros. |
| **POST** | `/asistencia` | **Sí** | Registrar asistencia rápida mediante `{ dni }`. |
| **POST** | `/asistencia/inhabilitar` | **Sí** | Inhabilitar día por feriado o evento `{ cicloId, fecha }`. |

### 📊 Exámenes y Notas

| Método | Endpoint | Auth | Descripción |
| --- | --- | --- | --- |
| **POST** | `/examen` | **Sí** | Crear examen `{ cicloId, semana, tipoExamen, fecha }`. |
| **POST** | `/examen/:id/calificaciones` | **Sí** | Registrar notas `[{ alumnoId, nota }]` + cálculo automático de mérito. |

---

## 🚀 Resumen de Implementación

* **Total de Endpoints:** 25
* **Endpoints Alumno:** 10
* **Endpoints Admin:** 15
* **Base de Datos:** TiDB Cloud (MySQL compatible)
* **Hosting:** Render

---

