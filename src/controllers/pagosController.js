const { ConceptoPago, Pago, Alumno, Matricula, Ciclo } = require('../models');

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
    const alumnos = matriculas.map(m => {
      const a = m.Alumno;
      const pagosList = conceptos.map(c => ({
        concepto_id: c.id, descripcion: c.descripcion,
        fecha_vencimiento: c.fecha_vencimiento, monto_opcion_1: c.monto_opcion_1,
        pago: pagoMap[`${a.id}_${c.id}`] || null,
      }));
      return {
        alumno: { id: a.id, codigo: a.codigo, nombres: a.nombres, apellidos: a.apellidos, suspendido: a.suspendido },
        pagos: pagosList,
        total_pagados: pagosList.filter(p => p.pago).length,
        total_conceptos: conceptos.length,
      };
    });
    res.json({ conceptos, alumnos });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.registrarPago = async (req, res) => {
  try {
    const pago = await Pago.create(req.body);
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

exports.getPagosAlumnoPublico = async (req, res) => {
  try {
    const alumnoId = req.usuario.id;
    const matriculas = await Matricula.findAll({
      where: { alumno_id: alumnoId },
      include: [{ model: Ciclo, attributes: ['id', 'nombres', 'fecha_fin'] }],
    });
    const cicloIds = matriculas.map(m => m.ciclo_id);
    if (!cicloIds.length) return res.json([]);
    const conceptos = await ConceptoPago.findAll({
      where: { ciclo_id: cicloIds },
      include: [{ model: Ciclo }],
      order: [['orden', 'ASC'], ['id', 'ASC']],
    });
    const pagos = await Pago.findAll({
      where: { alumno_id: alumnoId, visible_alumno: true },
    });
    const pagoMap = {};
    pagos.forEach(p => { pagoMap[p.concepto_id] = p; });
    const hoy = new Date();
    const items = conceptos.map(c => {
      const pago = pagoMap[c.id] || null;
      const vence = c.fecha_vencimiento ? new Date(c.fecha_vencimiento) : null;
      const vencido = !pago && vence && vence < hoy;
      return { concepto: c, pago, estado: pago ? 'pagado' : (vencido ? 'vencido' : 'pendiente') };
    });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
