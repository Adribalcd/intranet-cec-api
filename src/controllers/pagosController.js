const { ConceptoPago, Pago, Alumno, Matricula, Ciclo, ConfigPagosCiclo } = require('../models');

// ── Conceptos ──────────────────────────────────────────────────

exports.getConceptos = async (req, res) => {
  try {
    const { cicloId } = req.params;
    const conceptos = await ConceptoPago.findAll({
      where: { ciclo_id: cicloId },
      order: [['orden', 'ASC'], ['id', 'ASC']],
    });
    res.json(conceptos);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createConcepto = async (req, res) => {
  try {
    const { cicloId } = req.params;
    const c = await ConceptoPago.create({ ...req.body, ciclo_id: cicloId });
    res.status(201).json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateConcepto = async (req, res) => {
  try {
    const c = await ConceptoPago.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    await c.update(req.body);
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteConcepto = async (req, res) => {
  try {
    const c = await ConceptoPago.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    await Pago.destroy({ where: { concepto_id: c.id } });
    await c.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Config de pagos por ciclo ──────────────────────────────────

exports.getConfigPagos = async (req, res) => {
  try {
    const { cicloId } = req.params;
    const config = await ConfigPagosCiclo.findOne({ where: { ciclo_id: cicloId } });
    res.json(config || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.upsertConfigPagos = async (req, res) => {
  try {
    const { cicloId } = req.params;
    let config = await ConfigPagosCiclo.findOne({ where: { ciclo_id: cicloId } });
    if (config) {
      await config.update(req.body);
    } else {
      config = await ConfigPagosCiclo.create({ ...req.body, ciclo_id: cicloId });
    }
    res.json(config);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Pagos por alumno (admin) ───────────────────────────────────

exports.getPagosAlumno = async (req, res) => {
  try {
    const { alumnoId, cicloId } = req.params;
    const conceptos = await ConceptoPago.findAll({
      where: { ciclo_id: cicloId },
      include: [{
        model: Pago, as: 'Pagos',
        where: { alumno_id: alumnoId },
        required: false,
      }],
      order: [['orden', 'ASC'], ['id', 'ASC']],
    });
    res.json(conceptos);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getResumenCiclo = async (req, res) => {
  try {
    const { cicloId } = req.params;
    const matriculas = await Matricula.findAll({
      where: { ciclo_id: cicloId },
      include: [{ model: Alumno, attributes: ['id', 'codigo', 'nombres', 'apellidos', 'suspendido'] }],
    });
    const conceptos = await ConceptoPago.findAll({
      where: { ciclo_id: cicloId },
      order: [['orden', 'ASC']],
    });
    const pagos = await Pago.findAll({
      include: [{ model: ConceptoPago, as: 'Concepto', where: { ciclo_id: cicloId }, required: true }],
    });
    const pagoMap = {};
    pagos.forEach(p => { pagoMap[`${p.alumno_id}_${p.concepto_id}`] = p; });
    const alumnosList = matriculas.map(m => {
      const a = m.Alumno;
      const pagosList = conceptos.map(c => ({
        concepto_id: c.id, descripcion: c.descripcion,
        fecha_vencimiento: c.fecha_vencimiento, monto_opcion_1: c.monto_opcion_1,
        pago: pagoMap[`${a.id}_${c.id}`] || null,
      }));
      return {
        alumno: { id: a.id, codigo: a.codigo, nombres: a.nombres, apellidos: a.apellidos, suspendido: a.suspendido },
        pagos: pagosList,
        total_pagados: pagosList.filter(p => p.pago && p.pago.estado === 'confirmado').length,
        total_conceptos: conceptos.length,
      };
    });
    res.json({ conceptos, alumnos: alumnosList });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Pagos online pendientes (admin) ───────────────────────────

exports.getPagosOnlinePendientes = async (req, res) => {
  try {
    const where = { tipo_registro: 'online', estado: 'pendiente' };
    const pagos = await Pago.findAll({
      where,
      include: [
        { model: Alumno, attributes: ['id', 'codigo', 'nombres', 'apellidos'] },
        { model: ConceptoPago, as: 'Concepto',
          include: [{ model: Ciclo, attributes: ['id', 'nombres'] }] },
      ],
      order: [['id', 'DESC']],
    });
    res.json(pagos);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.confirmarPago = async (req, res) => {
  try {
    const pago = await Pago.findByPk(req.params.id);
    if (!pago) return res.status(404).json({ error: 'No encontrado' });
    const { accion, observaciones } = req.body;
    const updates = {};
    if (observaciones !== undefined) updates.observaciones = observaciones;
    if (accion === 'confirmar') {
      updates.estado = 'confirmado';
      updates.visible_alumno = true;
    } else if (accion === 'rechazar') {
      updates.estado = 'rechazado';
      updates.visible_alumno = false;
    } else {
      return res.status(400).json({ error: 'accion debe ser "confirmar" o "rechazar"' });
    }
    await pago.update(updates);
    res.json(pago);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── CRUD pagos (admin) ─────────────────────────────────────────

exports.registrarPago = async (req, res) => {
  try {
    const pago = await Pago.create({ ...req.body, estado: 'confirmado', tipo_registro: 'admin' });
    res.status(201).json(pago);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updatePago = async (req, res) => {
  try {
    const pago = await Pago.findByPk(req.params.id);
    if (!pago) return res.status(404).json({ error: 'No encontrado' });
    await pago.update(req.body);
    res.json(pago);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deletePago = async (req, res) => {
  try {
    const pago = await Pago.findByPk(req.params.id);
    if (!pago) return res.status(404).json({ error: 'No encontrado' });
    await pago.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.toggleVisibilidad = async (req, res) => {
  try {
    const pago = await Pago.findByPk(req.params.id);
    if (!pago) return res.status(404).json({ error: 'No encontrado' });
    await pago.update({ visible_alumno: !pago.visible_alumno });
    res.json({ visible_alumno: pago.visible_alumno });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.toggleSuspension = async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ where: { codigo: req.params.codigo } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    await alumno.update({ suspendido: !alumno.suspendido });
    res.json({ suspendido: alumno.suspendido, codigo: alumno.codigo });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Pago online (alumno) ───────────────────────────────────────

exports.pagoOnline = async (req, res) => {
  try {
    const alumnoId = req.usuario.id;
    const { concepto_id, monto_pagado, metodo_pago, numero_operacion, opcion_pago } = req.body;

    if (!concepto_id || !monto_pagado || !metodo_pago) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar concepto
    const concepto = await ConceptoPago.findByPk(concepto_id);
    if (!concepto) return res.status(404).json({ error: 'Concepto no encontrado' });
    if (!concepto.permite_pago_online) {
      return res.status(403).json({ error: 'Este concepto no permite pago en línea' });
    }

    // Verificar matrícula
    const matricula = await Matricula.findOne({ where: { alumno_id: alumnoId, ciclo_id: concepto.ciclo_id } });
    if (!matricula) return res.status(403).json({ error: 'No estás matriculado en este ciclo' });

    // Verificar config del ciclo
    const config = await ConfigPagosCiclo.findOne({ where: { ciclo_id: concepto.ciclo_id } });
    if (!config || (!config.permite_transferencia && !config.permite_yape_plin)) {
      return res.status(403).json({ error: 'Los pagos en línea no están habilitados para este ciclo' });
    }

    // Verificar método permitido
    if (metodo_pago === 'Transferencia' && !config.permite_transferencia) {
      return res.status(403).json({ error: 'La transferencia bancaria no está habilitada' });
    }
    if ((metodo_pago === 'Yape' || metodo_pago === 'Plin') && !config.permite_yape_plin) {
      return res.status(403).json({ error: 'Yape/Plin no está habilitado' });
    }

    // Revisar pago existente
    const existing = await Pago.findOne({ where: { alumno_id: alumnoId, concepto_id } });
    if (existing) {
      if (existing.estado === 'confirmado') {
        return res.status(400).json({ error: 'Este pago ya fue confirmado' });
      }
      if (existing.estado === 'pendiente') {
        return res.status(400).json({ error: 'Ya tienes un pago pendiente de revisión para este concepto' });
      }
      // Rechazado: eliminar y volver a crear
      await existing.destroy();
    }

    const pago = await Pago.create({
      alumno_id: alumnoId,
      concepto_id,
      monto_pagado,
      metodo_pago,
      numero_operacion: numero_operacion || null,
      opcion_pago: opcion_pago || 'opcion_1',
      fecha_pago: new Date().toISOString().slice(0, 10),
      visible_alumno: false,
      estado: 'pendiente',
      tipo_registro: 'online',
    });

    res.status(201).json(pago);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Estado de cuenta alumno (público) ─────────────────────────

exports.getPagosAlumnoPublico = async (req, res) => {
  try {
    const alumnoId = req.usuario.id;
    const matriculas = await Matricula.findAll({
      where: { alumno_id: alumnoId },
      include: [{
        model: Ciclo,
        attributes: ['id', 'nombres', 'fecha_fin'],
        include: [{ model: ConfigPagosCiclo }],
      }],
    });

    const result = [];
    const hoy = new Date();

    for (const matricula of matriculas) {
      const ciclo = matricula.Ciclo;
      const config = ciclo.ConfigPagosCiclo || null;
      // Si no hay config o pagos_visible es false, no mostramos nada de este ciclo
      if (!config || !config.pagos_visible) continue;

      const conceptos = await ConceptoPago.findAll({
        where: { ciclo_id: ciclo.id },
        order: [['orden', 'ASC'], ['id', 'ASC']],
      });

      // Obtenemos todos los pagos del alumno para este ciclo
      const pagos = await Pago.findAll({
        where: { alumno_id: alumnoId },
      });
      
      const pagoMap = {};
      pagos.forEach(p => { 
        // Eliminamos el filtro de visibilidad y el where redundante para asegurar 
        // que capturamos TODOS los pagos asociados a los conceptos del ciclo
        pagoMap[p.concepto_id] = p; 
      });

      const items = conceptos.map(c => {
        const pago = pagoMap[c.id] || null;
        const vence = c.fecha_vencimiento ? new Date(c.fecha_vencimiento + 'T12:00:00') : null;
        let estado;
        
        if (pago) {
          if (pago.estado === 'confirmado') {
            estado = 'pagado';
          } else if (pago.estado === 'pendiente') {
            estado = 'en_revision';
          } else {
            estado = 'rechazado';
          }
        } else {
          // Si no hay pago registrado:
          // 1. Si ya pasó la fecha de vencimiento -> Vencido
          if (vence && vence < hoy) {
            estado = 'vencido';
          } 
          // 2. Si es de un mes/año específico y ya estamos en ese mes/año -> Pendiente
          else if (c.mes && c.anio) {
            const primerDiaMes = new Date(c.anio, c.mes - 1, 1);
            if (hoy >= primerDiaMes) {
              estado = 'pendiente';
            } else {
              estado = 'proximo'; // O podrías dejarlo como invisible hasta que llegue el mes
            }
          }
          // 3. Por defecto si no tiene mes o aún no llega la fecha -> Pendiente
          else {
            estado = 'pendiente';
          }
        }
        
        return { 
          concepto: c, 
          pago, 
          estado,
          // Forzamos la lógica para que acepte tanto booleano como 1/0
          puedePagarOnline: !!(
            (c.permite_pago_online == 1 || c.permite_pago_online == true) && 
            config && (
              config.permite_transferencia == 1 || config.permite_transferencia == true ||
              config.permite_yape_plin == 1 || config.permite_yape_plin == true
            )
          )
        };
      });

      // Exponer solo campos de config necesarios para el alumno
      const safeConfig = {
        permitePagarOnline: !!(
          config.permite_transferencia == 1 || config.permite_transferencia == true ||
          config.permite_yape_plin == 1 || config.permite_yape_plin == true
        ),
        permite_transferencia: !!(config.permite_transferencia == 1 || config.permite_transferencia == true),
        permite_yape_plin:     !!(config.permite_yape_plin == 1 || config.permite_yape_plin == true),
        bcp_cuenta:            config.bcp_cuenta,
        bcp_cci:               config.bcp_cci,
        bbva_cuenta:           config.bbva_cuenta,
        bbva_cci:              config.bbva_cci,
        interbank_cuenta:      config.interbank_cuenta,
        interbank_cci:         config.interbank_cci,
        yape_numero:           config.yape_numero,
        plin_numero:           config.plin_numero,
        yape_qr_url:           config.yape_qr_url,
        plin_qr_url:           config.plin_qr_url,
      };

      result.push({
        ciclo: { id: ciclo.id, nombres: ciclo.nombres },
        config: safeConfig,
        items,
      });
    }

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
