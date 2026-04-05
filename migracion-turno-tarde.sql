-- ============================================================
-- Migración: turno tarde en asistencia + config tarde en ciclo
-- Ejecutar UNA SOLA VEZ en la base de datos
-- ============================================================

-- 1. Agregar columna 'turno' a la tabla asistencia
--    (mañana = turno habitual; tarde = turno de tarde)
ALTER TABLE asistencia
  ADD COLUMN turno VARCHAR(10) NOT NULL DEFAULT 'mañana'
  AFTER observaciones;

-- 2. Agregar configuración de turno tarde al ciclo
ALTER TABLE ciclo
  ADD COLUMN tiene_tarde  TINYINT(1)  NOT NULL DEFAULT 0   AFTER fecha_fin,
  ADD COLUMN hora_tarde_inicio  VARCHAR(8)  NULL               AFTER tiene_tarde,
  ADD COLUMN hora_tarde_puntual VARCHAR(8)  NULL               AFTER hora_tarde_inicio;

-- ============================================================
-- Verificar
-- ============================================================
-- DESCRIBE asistencia;
-- DESCRIBE ciclo;
