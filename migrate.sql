-- ============================================================
--  MIGRACIÓN — Intranet CEC Camargo
--  Rama: feature/excel-simulacro
--  Fecha: 2026-03-15
--
--  Ejecutar UNA SOLA VEZ sobre la BD existente.
--  Es seguro re-ejecutar: cada sentencia comprueba si la
--  columna/tabla ya existe antes de actuar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLA examen
--    · puntaje_pregunta_buena / _mala: DECIMAL(5,2) → (5,3)
--      para aceptar valores como 1.125
--    · Nueva columna: area  (carácter del área OMR: A-E)
--    · Nueva columna: ponderaciones_json (matriz P1-P10 de todas
--      las áreas, guardada como JSON text)
-- ------------------------------------------------------------

-- Ampliar precisión para aceptar 3 decimales (ej. 1.125)
ALTER TABLE `examen`
  MODIFY COLUMN `puntaje_pregunta_buena` DECIMAL(5,3) NOT NULL DEFAULT 4.000,
  MODIFY COLUMN `puntaje_pregunta_mala`  DECIMAL(5,3) NOT NULL DEFAULT 1.000;

-- Columna área del examen OMR (NULL si no aplica)
ALTER TABLE `examen`
  ADD COLUMN IF NOT EXISTS `area` CHAR(1) NULL DEFAULT NULL
    COMMENT 'Área OMR del simulacro: A, B, C, D o E';

-- Columna JSON con la matriz de ponderaciones P1-P10 por área
ALTER TABLE `examen`
  ADD COLUMN IF NOT EXISTS `ponderaciones_json` TEXT NULL DEFAULT NULL
    COMMENT 'JSON: { A:[4,20,...], B:[...], ... }';

-- ------------------------------------------------------------
-- 2. TABLA nota
--    · Nueva columna: nc   (preguntas no contestadas)
--    · Nueva columna: area    (área OMR del alumno en ese examen)
--    · Nueva columna: carrera (carrera del alumno según Excel)
--    · Nueva columna: aula    (aula del alumno según Excel)
-- ------------------------------------------------------------

ALTER TABLE `nota`
  ADD COLUMN IF NOT EXISTS `nc`      INT          NULL DEFAULT NULL
    COMMENT 'Preguntas no contestadas (simulacro OMR)',
  ADD COLUMN IF NOT EXISTS `area`    CHAR(1)      NULL DEFAULT NULL
    COMMENT 'Área OMR del alumno: A, B, C, D o E',
  ADD COLUMN IF NOT EXISTS `carrera` VARCHAR(80)  NULL DEFAULT NULL
    COMMENT 'Carrera del alumno según el Excel OMR',
  ADD COLUMN IF NOT EXISTS `aula`    VARCHAR(30)  NULL DEFAULT NULL
    COMMENT 'Aula del alumno según el Excel OMR';

-- ------------------------------------------------------------
-- 3. TABLA nota_curso  (NUEVA)
--    Almacena el puntaje detallado por curso para cada nota
--    de simulacro. Relación: nota (1) → nota_curso (N).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `nota_curso` (
  `id`           INT            NOT NULL AUTO_INCREMENT,
  `nota_id`      INT            NOT NULL,
  `curso_nombre` VARCHAR(80)    NOT NULL  COMMENT 'Nombre del curso: Aritmética, Física, etc.',
  `buenas`       INT            NOT NULL  DEFAULT 0,
  `malas`        INT            NOT NULL  DEFAULT 0,
  `nc`           INT            NOT NULL  DEFAULT 0,
  `puntaje`      DECIMAL(10,3)  NULL      DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nota_curso_nota_id` (`nota_id`),
  CONSTRAINT `fk_nota_curso_nota`
    FOREIGN KEY (`nota_id`) REFERENCES `nota` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Detalle de puntaje por curso para simulacros OMR';

-- ------------------------------------------------------------
-- FIN DE MIGRACIÓN
-- Verificación rápida (opcional, descomenta para revisar):
-- ------------------------------------------------------------
-- DESCRIBE examen;
-- DESCRIBE nota;
-- DESCRIBE nota_curso;
