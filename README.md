# intranet-cec-api

  METODOS IMPLEMENTADOS:

  Alumno (/api/alumno)

  Método: POST
  Endpoint: /api/alumno/login
  Auth: No
  Descripción: Login con { usuario, contrasena }
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/alumno/perfil
  Auth: Bearer
  Descripción: Datos del alumno (nombres, apellidos, ciclo, fotoUrl)
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/alumno/horario
  Auth: Bearer
  Descripción: Horario de cursos [{ curso, dia, hora }]
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/alumno/asistencia
  Auth: Bearer
  Descripción: Registros de asistencia [{ fecha, estado, hora, observaciones }]
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/alumno/calificaciones
  Auth: Bearer
  Descripción: Notas con mérito [{ fecha, nota, puesto, tipo }]
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/alumno/cursos
  Auth: Bearer
  Descripción: Cursos matriculados [{ idCurso, nombreCurso, ciclo }]
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/alumno/cursos/:idCurso/materiales?semana=X
  Auth: Bearer
  Descripción: Materiales por curso y semana
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/alumno/logout
  Auth: Bearer
  Descripción: Cierra sesión (invalida token)
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/alumno/recuperar-password
  Auth: No
  Descripción: Solicita reset con { email }
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/alumno/reset-password
  Auth: No
  Descripción: Cambia contraseña con { token, nuevaContrasena, confirmarContrasena }

  Admin (/api/admin)

  Método: POST
  Endpoint: /api/admin/login
  Auth: No
  Descripción: Login admin con { usuario, contrasena }
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/admin/ciclos
  Auth: Bearer
  Descripción: Listar ciclos
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/ciclos
  Auth: Bearer
  Descripción: Crear ciclo { nombre, fechaInicio, duracion, fechaFin? }
  ────────────────────────────────────────
  Método: PUT
  Endpoint: /api/admin/ciclos/:id
  Auth: Bearer
  Descripción: Actualizar ciclo
  ────────────────────────────────────────
  Método: DELETE
  Endpoint: /api/admin/ciclos/:id
  Auth: Bearer
  Descripción: Eliminar ciclo
  ────────────────────────────────────────
  Método: GET
  Endpoint: /api/admin/cursos
  Auth: Bearer
  Descripción: Listar cursos
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/cursos
  Auth: Bearer
  Descripción: Crear curso { nombre, profesor, cicloId }
  ────────────────────────────────────────
  Método: PUT
  Endpoint: /api/admin/cursos/:id
  Auth: Bearer
  Descripción: Actualizar curso
  ────────────────────────────────────────
  Método: DELETE
  Endpoint: /api/admin/cursos/:id
  Auth: Bearer
  Descripción: Eliminar curso
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/matricula/manual
  Auth: Bearer
  Descripción: Matrícula individual { alumnoId, cursoId, cicloId }
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/matricula/masiva
  Auth: Bearer
  Descripción: Matrícula masiva { registros: [...] }
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/asistencia
  Auth: Bearer
  Descripción: Registrar asistencia por { dni }
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/asistencia/inhabilitar-dia
  Auth: Bearer
  Descripción: Inhabilitar día { cicloId, fecha }
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/examen
  Auth: Bearer
  Descripción: Crear examen { cicloId, semana, tipoExamen, fecha }
  ────────────────────────────────────────
  Método: POST
  Endpoint: /api/admin/examen/:examenId/calificaciones
  Auth: Bearer
  Descripción: Registrar notas [{ alumnoId, nota }] + orden de mérito

  Total: 25 endpoints (10 alumno + 15 admin)
