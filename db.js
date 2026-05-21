const DB = (() => {

  const db = firebase.firestore();
/**
 * javier
 */ 


  /**
   * Inicializa solo el documento centinela si no existe.
   * Los deportes y profesores los crea el administrador.
   */
  async function seedInicialSiNecesario() {
    const seedRef = db.collection('_meta').doc('seeded');
    const snap = await seedRef.get();
    if (snap.exists) return;
    await seedRef.set({ done: true });
    console.log('✅ Meta inicializada');
  }

  /* 
    Esta funcion es para controlar que no se puedan crear usuarios con el mismo DNI ni con el mismo correo 
  */
  const Usuario = {
    async insertar({ US_DNI, Nombre, Correo, F_Nacimiento }) {
      const porDNI = await db.collection('Usuario').doc(US_DNI).get();
      if (porDNI.exists) return { ok: false, error: 'El DNI ya está registrado.' };

      const porCorreo = await db.collection('Usuario')
        .where('Correo', '==', Correo.toLowerCase()).get();
      if (!porCorreo.empty) return { ok: false, error: 'El correo ya está en uso.' };

      await db.collection('Usuario').doc(US_DNI).set({
        US_DNI,
        Nombre,
        Correo: Correo.toLowerCase(),
        F_Nacimiento,
        Rol: 'predeterminado',  // ← nuevo campo de rol
      });
      return { ok: true };
    },
    //Esta funcion sirve para buscar a un usuario y recoger todos sus datos por el correo 
    async buscarPorCorreo(correo) {
      const snap = await db.collection('Usuario')
        .where('Correo', '==', correo.toLowerCase()).get();
      if (snap.empty) return null;
      return snap.docs[0].data();
    },

    async buscarPorDNI(dni) {
      const snap = await db.collection('Usuario').doc(dni).get();
      return snap.exists ? snap.data() : null;
    },

    async listarTodos() {
      const snap = await db.collection('Usuario').get();
      return snap.docs.map(d => d.data());
    },
  };

  /* ============================================================
     TABLA: Subscricion
     ============================================================ */
  const Subscricion = {
    async crear({ US_DNI, Modalidad, Deporte }) {
      const existente = await db.collection('Subscricion')
        .where('US_DNI', '==', US_DNI)
        .where('Deporte', '==', Deporte)
        .where('Estado', '==', 'activa')
        .get();

      if (!existente.empty)
        return { ok: false, error: 'Ya tienes una suscripción activa para este deporte.' };

      const hoy = new Date();
      const fechaInicio = hoy.toISOString().split('T')[0];
      let fechaFin;
      if (Modalidad === 'mensual') {
        const fin = new Date(hoy); fin.setMonth(fin.getMonth() + 1);
        fechaFin = fin.toISOString().split('T')[0];
      } else if (Modalidad === 'trimestral') {
        const fin = new Date(hoy); fin.setMonth(fin.getMonth() + 3);
        fechaFin = fin.toISOString().split('T')[0];
      } else {
        const fin = new Date(hoy); fin.setFullYear(fin.getFullYear() + 1);
        fechaFin = fin.toISOString().split('T')[0];
      }

      const ref = await db.collection('Subscricion').add({
        Modalidad, Estado: 'activa',
        Fecha_Inicio: fechaInicio,
        Fecha_Fin: fechaFin,
        US_DNI, Deporte,
      });
      return { ok: true, suscripcion: { id: ref.id, Modalidad, Estado: 'activa', Fecha_Inicio: fechaInicio, Fecha_Fin: fechaFin, US_DNI, Deporte } };
    },

    async cancelar(id, US_DNI) {
      const ref = db.collection('Subscricion').doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data().US_DNI !== US_DNI)
        return { ok: false, error: 'Suscripción no encontrada.' };
      await ref.update({ Estado: 'inactiva' });
      return { ok: true };
    },

    async listarPorUsuario(US_DNI) {
      const snap = await db.collection('Subscricion')
        .where('US_DNI', '==', US_DNI).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async tieneActiva(US_DNI, Deporte) {
      const hoy = new Date().toISOString().split('T')[0];
      const snap = await db.collection('Subscricion')
        .where('US_DNI', '==', US_DNI)
        .where('Deporte', '==', Deporte)
        .where('Estado', '==', 'activa')
        .get();
      return snap.docs.some(d => d.data().Fecha_Fin >= hoy);
    },

    async obtenerActiva(US_DNI, Deporte) {
      const hoy = new Date().toISOString().split('T')[0];
      const snap = await db.collection('Subscricion')
        .where('US_DNI', '==', US_DNI)
        .where('Deporte', '==', Deporte)
        .where('Estado', '==', 'activa')
        .get();
      const doc = snap.docs.find(d => d.data().Fecha_Fin >= hoy);
      return doc ? { id: doc.id, ...doc.data() } : null;
    },

    /** Cancela todas las suscripciones activas de un deporte (para cascada admin) */
    async cancelarPorDeporte(deporteId) {
      const snap = await db.collection('Subscricion')
        .where('Deporte', '==', deporteId).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    },
  };

  /* ============================================================
     TABLA: Clases
     ============================================================ */
  const Clases = {
    async listarTodas() {
      const snap = await db.collection('Clases').get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async listarPorDeporte(deporte) {
      const snap = await db.collection('Clases')
        .where('Deporte', '==', deporte).get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async buscarPorId(id) {
      const snap = await db.collection('Clases').doc(String(id)).get();
      return snap.exists ? { ...snap.data(), id: snap.id } : null;
    },

    async crear({ Deporte, Descripcion, Horario, Pista, PRO_DNI, Categoria }) {
      const ref = await db.collection('Clases').add({
        Deporte, Descripcion, Horario, Pista, PRO_DNI,
        Categoria: Categoria || '',
      });
      return { ok: true, id: ref.id };
    },

    async actualizar(id, datos) {
      await db.collection('Clases').doc(String(id)).update(datos);
      return { ok: true };
    },

    async eliminar(id) {
      await db.collection('Clases').doc(String(id)).delete();
      // Eliminar reservas de esta clase en cascada
      const reservasSnap = await db.collection('Reserva')
        .where('Clase_ID', '==', String(id)).get();
      if (!reservasSnap.empty) {
        const batch = db.batch();
        reservasSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      return { ok: true };
    },

    /** Elimina todas las clases de un deporte (para cascada de deporte) */
    async eliminarPorDeporte(deporteId) {
      const snap = await db.collection('Clases')
        .where('Deporte', '==', deporteId).get();
      for (const doc of snap.docs) {
        await Clases.eliminar(doc.id);
      }
    },
  };

  /* ============================================================
     TABLA: Profesor
     ============================================================ */
  const Profesor = {
    async listarTodos() {
      const snap = await db.collection('Profesor').get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async listarPorDeporte(deporte) {
      const snap = await db.collection('Profesor')
        .where('Especialidad', '==', deporte).get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async buscarPorDNI(dni) {
      const snap = await db.collection('Profesor').doc(dni).get();
      return snap.exists ? snap.data() : null;
    },

    async crear({ PRO_DNI, Nombre, Especialidad, Email, Telefono }) {
      const existe = await db.collection('Profesor').doc(PRO_DNI).get();
      if (existe.exists) return { ok: false, error: 'Ya existe un profesor con ese DNI.' };
      await db.collection('Profesor').doc(PRO_DNI).set({
        PRO_DNI, Nombre, Especialidad,
        Email: Email || '',
        Telefono: Telefono || '',
      });
      return { ok: true };
    },

    async actualizar(dni, datos) {
      await db.collection('Profesor').doc(dni).update(datos);
      return { ok: true };
    },

    /**
     * Elimina un profesor y desvincula sus clases (pone PRO_DNI a null).
     */
    async eliminar(dni) {
      await db.collection('Profesor').doc(dni).delete();
      // Desvincular clases que apuntaban a este profesor
      const clasesSnap = await db.collection('Clases')
        .where('PRO_DNI', '==', dni).get();
      if (!clasesSnap.empty) {
        const batch = db.batch();
        clasesSnap.docs.forEach(d => batch.update(d.ref, { PRO_DNI: null }));
        await batch.commit();
      }
      return { ok: true };
    },

    /** Elimina todos los profesores de un deporte (para cascada) */
    async eliminarPorDeporte(deporteId) {
      const snap = await db.collection('Profesor')
        .where('Especialidad', '==', deporteId).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    },
  };

  /* ============================================================
     TABLA: Deporte (gestionada por el admin)
     Estructura: { id, Nombre, Icono, Color, Precios: { mensual, trimestral, anual } }
     ============================================================ */
  const Deporte = {
    async listarTodos() {
      const snap = await db.collection('Deporte').get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async buscarPorId(id) {
      const snap = await db.collection('Deporte').doc(id).get();
      return snap.exists ? { ...snap.data(), id: snap.id } : null;
    },

    async crear({ Nombre, Icono, Color, Precios }) {
      // Usamos el nombre en mayúsculas como ID para compatibilidad
      const id = Nombre.toUpperCase().replace(/\s+/g, '_');
      const existe = await db.collection('Deporte').doc(id).get();
      if (existe.exists) return { ok: false, error: 'Ya existe un deporte con ese nombre.' };
      await db.collection('Deporte').doc(id).set({
        id, Nombre, Icono: Icono || '🏅',
        Color: Color || '#e8ff47',
        Precios: Precios || { mensual: 29.99, trimestral: 79.99, anual: 269.99 },
      });
      return { ok: true, id };
    },

    async actualizar(id, datos) {
      await db.collection('Deporte').doc(id).update(datos);
      return { ok: true };
    },

    /**
     * Elimina un deporte en cascada:
     * → Categorías del deporte
     * → Clases del deporte (y sus reservas)
     * → Profesores del deporte
     * → Suscripciones del deporte
     * → Documento del deporte
     */
    async eliminar(id) {
      await Categoria.eliminarPorDeporte(id);
      await Clases.eliminarPorDeporte(id);
      await Profesor.eliminarPorDeporte(id);
      await Subscricion.cancelarPorDeporte(id);
      await db.collection('Deporte').doc(id).delete();
      return { ok: true };
    },
  };

  /* ============================================================
     TABLA: Categoria
     Estructura: { id, Nombre, Deporte, EdadMin, EdadMax }
     ============================================================ */
  const Categoria = {
    async listarTodas() {
      const snap = await db.collection('Categoria').get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async listarPorDeporte(deporte) {
      const snap = await db.collection('Categoria')
        .where('Deporte', '==', deporte).get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },

    async crear({ Nombre, Deporte, EdadMin, EdadMax }) {
      const ref = await db.collection('Categoria').add({
        Nombre, Deporte,
        EdadMin: Number(EdadMin),
        EdadMax: Number(EdadMax),
      });
      return { ok: true, id: ref.id };
    },

    async actualizar(id, datos) {
      await db.collection('Categoria').doc(id).update({
        ...datos,
        EdadMin: Number(datos.EdadMin),
        EdadMax: Number(datos.EdadMax),
      });
      return { ok: true };
    },

    async eliminar(id) {
      await db.collection('Categoria').doc(id).delete();
      return { ok: true };
    },

    async eliminarPorDeporte(deporteId) {
      const snap = await db.collection('Categoria')
        .where('Deporte', '==', deporteId).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    },
  };

  /* ============================================================
     TABLA: Reserva
     ============================================================ */
  const Reserva = {
    /**
     * Crea una reserva para el usuario indicado.
     * Si la reserva es para un tercero, se persiste el objeto `tercero`:
     *   { Nombre, Edad, Telefono, Alergias, DNI? }
     *
     * @param {string}      US_DNI    DNI del usuario titular de la suscripción
     * @param {string}      Clase_ID  ID de la clase
     * @param {string}      Fecha     Fecha en formato YYYY-MM-DD
     * @param {object|null} tercero   Datos de la persona ajena (opcional)
     */
    async crear({ US_DNI, Clase_ID, Fecha, tercero = null }) {
      const clase = await Clases.buscarPorId(Clase_ID);
      if (!clase) return { ok: false, error: 'La clase no existe.' };

      const sub = await Subscricion.obtenerActiva(US_DNI, clase.Deporte);
      if (!sub)
        return { ok: false, error: `Necesitas una suscripción activa a ${clase.Deporte} para reservar esta clase.` };
      if (Fecha < sub.Fecha_Inicio || Fecha > sub.Fecha_Fin)
        return { ok: false, error: `La fecha debe estar dentro del período de tu suscripción (${sub.Fecha_Inicio} → ${sub.Fecha_Fin}).` };

      const dup = await db.collection('Reserva')
        .where('US_DNI', '==', US_DNI)
        .where('Clase_ID', '==', String(Clase_ID))
        .where('Fecha', '==', Fecha)
        .get();
      if (!dup.empty) return { ok: false, error: 'Ya tienes una reserva para esta clase en esa fecha.' };

      const horarioParte = clase.Horario.split(' ')[1] || '00:00-01:00';
      const [horaInicio, horaFin] = horarioParte.split('-');

      const nueva = {
        Fecha_Inicio: `${Fecha}T${horaInicio}:00`,
        Fecha_Fin:    `${Fecha}T${horaFin}:00`,
        Fecha,
        US_DNI,
        Clase_ID: String(Clase_ID),
        // Si hay datos de tercero los guardamos; en caso contrario null
        Tercero: tercero
          ? {
              Nombre:   tercero.Nombre.trim(),
              Edad:     Number(tercero.Edad),
              Telefono: tercero.Telefono.trim(),
              Alergias: tercero.Alergias.trim() || 'Ninguna',
              DNI:      tercero.DNI ? tercero.DNI.trim().toUpperCase() : null,
            }
          : null,
      };
      const ref = await db.collection('Reserva').add(nueva);
      return { ok: true, reserva: { id: ref.id, ...nueva } };
    },

    async listarPorUsuario(US_DNI) {
      const snap = await db.collection('Reserva')
        .where('US_DNI', '==', US_DNI).get();
      const reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Cargar config de deportes para enriquecer datos
      const deportes = await Deporte.listarTodos();
      const deportesMap = {};
      deportes.forEach(d => { deportesMap[d.id] = d; });

      return Promise.all(reservas.map(async r => {
        const clase    = await Clases.buscarPorId(r.Clase_ID) || {};
        const profesor = clase.PRO_DNI ? await Profesor.buscarPorDNI(clase.PRO_DNI) : null;
        const depCfg   = deportesMap[clase.Deporte] || {};
        return {
          ...r,
          Deporte:        clase.Deporte      || '?',
          DeporteNombre:  depCfg.Nombre      || clase.Deporte || '?',
          DeporteIcono:   depCfg.Icono       || '🏅',
          DeporteColor:   depCfg.Color       || '#e8ff47',
          Descripcion:    clase.Descripcion  || '',
          Horario:        clase.Horario      || '',
          Pista:          clase.Pista        || '',
          ProfesorNombre: profesor ? profesor.Nombre : 'Sin asignar',
        };
      })).then(list =>
        list.sort((a, b) => new Date(b.Fecha_Inicio) - new Date(a.Fecha_Inicio))
      );
    },

    async cancelar(id, US_DNI) {
      const ref  = db.collection('Reserva').doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data().US_DNI !== US_DNI)
        return { ok: false, error: 'Reserva no encontrada.' };
      await ref.delete();
      return { ok: true };
    },
  };

  /* ============================================================
     ELIMINAR USUARIO (con cascada)
     ============================================================ */
  async function eliminarUsuario(US_DNI) {
    const usuarioSnap = await db.collection('Usuario').doc(US_DNI).get();
    if (!usuarioSnap.exists) return { ok: false, error: 'Usuario no encontrado.' };

    const reservasSnap = await db.collection('Reserva')
      .where('US_DNI', '==', US_DNI).get();
    const subsSnap = await db.collection('Subscricion')
      .where('US_DNI', '==', US_DNI).get();

    const todosLosDocs = [...reservasSnap.docs, ...subsSnap.docs];
    while (todosLosDocs.length > 0) {
      const lote = todosLosDocs.splice(0, 499);
      const batch = db.batch();
      lote.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    await db.collection('Usuario').doc(US_DNI).delete();
    return { ok: true };
  }

  return {
    seed: seedInicialSiNecesario,
    Usuario,
    Subscricion,
    Clases,
    Profesor,
    Deporte,
    Categoria,
    Reserva,
    eliminarUsuario,
  };

})();
