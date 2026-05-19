/**
 * app.js — Controlador principal de la aplicación
 * Gestiona: navegación, dashboard, deportes, reservas, suscripciones y panel admin.
 */

/* ============================================================
   UTILIDADES
   ============================================================ */

function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFechaSola(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function toggle(el, mostrar) {
  if (mostrar) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

function mostrarToast(mensaje, tipo = 'success') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.className = `app-toast app-toast--${tipo} app-toast--visible`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('app-toast--visible');
  }, 3200);
}

/* ============================================================
   DEPORTES CONFIG (cargado desde Firestore)
   ============================================================ */

let DEPORTES_CONFIG = {};

async function cargarDeportesConfig() {
  const deportes = await DB.Deporte.listarTodos();
  DEPORTES_CONFIG = {};
  deportes.forEach(d => {
    DEPORTES_CONFIG[d.id] = {
      label: d.Nombre,
      icon: d.Icono || '🏅',
      color: d.Color || 'var(--clr-accent)',
      precio: d.Precios || { mensual: 29.99, trimestral: 79.99, anual: 269.99 },
    };
  });
  return deportes;
}

/* ============================================================
   NAVEGACIÓN
   ============================================================ */

const PAGINAS = ['dashboard', 'deportes', 'reservas', 'suscripciones', 'admin'];

async function navegarA(pagina) {
  PAGINAS.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(`page-${pagina}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pagina);
  });

  await cargarDeportesConfig();

  switch (pagina) {
    case 'dashboard': await renderDashboard(); break;
    case 'deportes': await renderDeportes(); break;
    case 'reservas': await renderPaginaReservas(); break;
    case 'suscripciones': await renderSuscripciones(); break;
    case 'admin': await renderAdmin(); break;
  }
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navegarA(link.dataset.page);
  });
});

/* ============================================================
   DASHBOARD
   ============================================================ */

async function renderDashboard() {
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;

  const primerNombre = usuario.Nombre.split(' ')[0];
  document.getElementById('hero-user-name').textContent = primerNombre;

  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  const subsActivas = subs.filter(s => s.Estado === 'activa').length;
  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);

  document.getElementById('stat-subs').textContent = subsActivas;
  document.getElementById('stat-reservas').textContent = reservas.length;

  // Próximas reservas
  const containerReservas = document.getElementById('dashboard-reservas');
  const proximas = reservas
    .filter(r => new Date(r.Fecha_Inicio) >= new Date())
    .slice(0, 4);

  if (proximas.length === 0) {
    containerReservas.innerHTML = `<div class="empty-state">No tienes clases próximas reservadas. <a href="#" data-page="reservas" class="nav-link-inline">Reservar ahora →</a></div>`;
  } else {
    containerReservas.innerHTML = proximas.map(r => reservaItemHTML(r)).join('');
    containerReservas.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
      btn.addEventListener('click', () => cancelarReserva(btn.dataset.id));
    });
  }

  // Tarjetas de deportes
  const dashDeportes = document.getElementById('dash-deportes');
  const deportesList = Object.keys(DEPORTES_CONFIG);

  if (deportesList.length === 0) {
    dashDeportes.innerHTML = '<div class="empty-state">No hay deportes configurados todavía.</div>';
  } else {
    const clasesPorDeporte = await Promise.all(
      deportesList.map(key => DB.Clases.listarPorDeporte(key))
    );
    const activosPorDeporte = await Promise.all(
      deportesList.map(key => DB.Subscricion.tieneActiva(usuario.US_DNI, key))
    );

    dashDeportes.innerHTML = deportesList.map((key, i) => {
      const cfg = DEPORTES_CONFIG[key];
      const activo = activosPorDeporte[i];
      return `
        <div class="sport-card" style="--sport-color:${cfg.color}" data-deporte="${key}">
          <div class="sport-card-icon">${cfg.icon}</div>
          <div class="sport-card-name">${cfg.label}</div>
          <div class="sport-card-detail">${clasesPorDeporte[i].length} clases disponibles</div>
          <span class="sport-badge ${activo ? 'activo' : 'inactivo'}">${activo ? '✓ Suscrito' : 'No suscrito'}</span>
        </div>`;
    }).join('');

    dashDeportes.querySelectorAll('.sport-card').forEach(card => {
      card.addEventListener('click', () => navegarA('suscripciones'));
    });
  }

  containerReservas.querySelectorAll('.nav-link-inline').forEach(a => {
    a.addEventListener('click', (e) => { e.preventDefault(); navegarA(a.dataset.page); });
  });
}

function reservaItemHTML(r) {
  const cfg = DEPORTES_CONFIG[r.Deporte] || {};
  const color = r.DeporteColor || cfg.color || '#fff';
  const icon = r.DeporteIcono || cfg.icon || '🏅';
  const label = r.DeporteNombre || cfg.label || r.Deporte;
  return `
    <div class="reserva-item">
      <span class="reserva-sport-dot" style="background:${color}"></span>
      <div class="reserva-info">
        <div class="reserva-title">${icon} ${label} — ${r.Descripcion}</div>
        <div class="reserva-detail">Prof. ${r.ProfesorNombre} · ${r.Pista} · ${r.Horario}</div>
      </div>
      <div class="reserva-date">${formatFechaSola(r.Fecha)}</div>
      <button class="btn-cancelar-reserva" data-id="${r.id}" title="Cancelar reserva">Cancelar</button>
    </div>`;
}

/* ============================================================
   DEPORTES (vista pública)
   ============================================================ */

async function renderDeportes() {
  const grid = document.getElementById('deportes-grid');
  const profesores = await DB.Profesor.listarTodos();
  const clases = await DB.Clases.listarTodas();

  if (Object.keys(DEPORTES_CONFIG).length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No hay deportes configurados todavía.</div>';
    return;
  }

  grid.innerHTML = Object.entries(DEPORTES_CONFIG).map(([key, cfg]) => {
    const profs = profesores.filter(p => p.Especialidad === key);
    const clasesDeporte = clases.filter(c => c.Deporte === key);

    const profesoresHTML = profs.map(prof => {
      const clase = clasesDeporte.find(c => c.PRO_DNI === prof.PRO_DNI);
      return `
        <div class="profesor-item">
          <div class="profesor-avatar">${iniciales(prof.Nombre)}</div>
          <div class="profesor-info">
            <div class="profesor-name">${prof.Nombre}</div>
            <div class="profesor-horario">${clase ? clase.Horario + ' · ' + clase.Pista : 'Horario no asignado'}</div>
          </div>
          ${clase ? `<span class="horario-tag">${clase.Horario.split(' ')[1] || ''}</span>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="deporte-card-full">
        <div class="deporte-card-header">
          <div class="deporte-card-header-icon" style="background:${cfg.color}20; border:1px solid ${cfg.color}30">
            <span style="font-size:26px">${cfg.icon}</span>
          </div>
          <div>
            <h3 style="color:${cfg.color}">${cfg.label}</h3>
            <p>${profs.length} profesores · ${clasesDeporte.length} clases</p>
          </div>
        </div>
        <div class="deporte-card-body">${profesoresHTML || '<p style="color:var(--clr-muted);font-size:13px">Sin profesores asignados</p>'}</div>
      </div>`;
  }).join('');
}

/* ============================================================
   RESERVAS
   ============================================================ */

async function renderPaginaReservas() {
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;

  const selectDeporte = document.getElementById('reserva-deporte');
  selectDeporte.innerHTML = '<option value="">— Selecciona deporte —</option>';

  const deportesList = Object.keys(DEPORTES_CONFIG);
  const activosPorDeporte = await Promise.all(
    deportesList.map(key => DB.Subscricion.tieneActiva(usuario.US_DNI, key))
  );

  deportesList.forEach((key, i) => {
    if (activosPorDeporte[i]) {
      const cfg = DEPORTES_CONFIG[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${cfg.icon} ${cfg.label}`;
      selectDeporte.appendChild(opt);
    }
  });

  if (selectDeporte.options.length === 1) {
    selectDeporte.innerHTML = '<option value="">No tienes suscripciones activas</option>';
  }

  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('reserva-fecha').min = hoy;
  document.getElementById('reserva-fecha').value = hoy;

  const nuevoSelect = selectDeporte.cloneNode(true);
  selectDeporte.parentNode.replaceChild(nuevoSelect, selectDeporte);

  nuevoSelect.addEventListener('change', async () => {
    const deporte = nuevoSelect.value;
    const selectClase = document.getElementById('reserva-clase');
    selectClase.innerHTML = '';

    if (!deporte) {
      selectClase.innerHTML = '<option value="">— Primero selecciona deporte —</option>';
      const fi = document.getElementById('reserva-fecha');
      fi.min = new Date().toISOString().split('T')[0];
      fi.max = '';
      return;
    }

    const clases = await DB.Clases.listarPorDeporte(deporte);
    if (clases.length === 0) {
      selectClase.innerHTML = '<option value="">Sin clases disponibles</option>';
      return;
    }

    for (const c of clases) {
      const prof = c.PRO_DNI ? await DB.Profesor.buscarPorDNI(c.PRO_DNI) : null;
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.Horario} — ${c.Descripcion} (${prof ? prof.Nombre : 'Sin prof.'})`;
      selectClase.appendChild(opt);
    }

    const sub = await DB.Subscricion.obtenerActiva(usuario.US_DNI, deporte);
    if (sub) {
      const hoyStr = new Date().toISOString().split('T')[0];
      const fechaInput = document.getElementById('reserva-fecha');
      fechaInput.min = sub.Fecha_Inicio > hoyStr ? sub.Fecha_Inicio : hoyStr;
      fechaInput.max = sub.Fecha_Fin;
      if (fechaInput.value < fechaInput.min || fechaInput.value > sub.Fecha_Fin) {
        fechaInput.value = fechaInput.min;
      }
    }
  });

  const btnReserva = document.getElementById('btn-hacer-reserva');
  const nuevoBtn = btnReserva.cloneNode(true);
  btnReserva.parentNode.replaceChild(nuevoBtn, btnReserva);
  nuevoBtn.addEventListener('click', hacerReserva);

  await renderHistorialReservas();
}

async function hacerReserva() {
  const usuario = await Auth.usuarioActual();
  const deporteEl = document.getElementById('reserva-deporte');
  const claseEl = document.getElementById('reserva-clase');
  const fechaEl = document.getElementById('reserva-fecha');
  const msgErr = document.getElementById('reserva-msg');
  const msgOk = document.getElementById('reserva-ok');

  toggle(msgErr, false);
  toggle(msgOk, false);

  const Clase_ID = claseEl.value;
  const Fecha = fechaEl.value;

  if (!deporteEl.value) { msgErr.textContent = 'Selecciona un deporte.'; toggle(msgErr, true); return; }
  if (!Clase_ID) { msgErr.textContent = 'Selecciona una clase.'; toggle(msgErr, true); return; }
  if (!Fecha) { msgErr.textContent = 'Selecciona una fecha.'; toggle(msgErr, true); return; }

  const diaSemana = new Date(Fecha + 'T12:00:00').getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    msgErr.textContent = 'Las clases son de lunes a viernes.';
    toggle(msgErr, true); return;
  }

  const resultado = await DB.Reserva.crear({ US_DNI: usuario.US_DNI, Clase_ID, Fecha });

  if (!resultado.ok) {
    msgErr.textContent = resultado.error;
    toggle(msgErr, true);
    return;
  }

  msgOk.textContent = `¡Reserva realizada correctamente para el ${formatFechaSola(Fecha)}!`;
  toggle(msgOk, true);
  await renderHistorialReservas();

  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);
  document.getElementById('stat-reservas').textContent = reservas.length;
}

async function renderHistorialReservas() {
  const usuario = await Auth.usuarioActual();
  const container = document.getElementById('reservas-historial');
  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);

  if (reservas.length === 0) {
    container.innerHTML = '<div class="empty-state">No tienes reservas todavía.</div>';
    return;
  }

  container.innerHTML = reservas.map(r => reservaItemHTML(r)).join('');
  container.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
    btn.addEventListener('click', () => cancelarReserva(btn.dataset.id));
  });
}

async function cancelarReserva(id) {
  const usuario = await Auth.usuarioActual();
  const resultado = await DB.Reserva.cancelar(id, usuario.US_DNI);
  if (resultado.ok) {
    await renderHistorialReservas();
    await renderDashboard();
  }
}

/* ============================================================
   SUSCRIPCIONES
   ============================================================ */

let _cancelarSubId = null;

async function renderSuscripciones() {
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;
  await renderMisSuscripciones();
  await renderPlanesContratacion();
}

async function renderMisSuscripciones() {
  const usuario = await Auth.usuarioActual();
  const container = document.getElementById('mis-suscripciones');
  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  const activas = subs.filter(s => s.Estado === 'activa');

  if (activas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No tienes ninguna suscripción activa.
        <br><span style="font-size:13px;margin-top:6px;display:block">Elige un deporte abajo y empieza hoy.</span>
      </div>`;
    return;
  }

  container.innerHTML = activas.map(s => {
    const cfg = DEPORTES_CONFIG[s.Deporte] || {};
    const hoy = new Date();
    const fin = new Date(s.Fecha_Fin);
    const diasRestantes = Math.max(0, Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24)));
    const urgente = diasRestantes <= 7;
    return `
      <div class="sub-activa-item" style="--sport-color:${cfg.color || '#fff'}">
        <div class="sub-sport-bar" style="background:${cfg.color || '#fff'}"></div>
        <div class="sub-icon-circle" style="background:${cfg.color}18;border:1px solid ${cfg.color}30">
          <span style="font-size:22px">${cfg.icon || '🏅'}</span>
        </div>
        <div class="sub-info">
          <div class="sub-title">${cfg.label || s.Deporte}</div>
          <div class="sub-detail">
            <span class="sub-modalidad-tag">${s.Modalidad.charAt(0).toUpperCase() + s.Modalidad.slice(1)}</span>
            ${formatFechaSola(s.Fecha_Inicio)} → ${formatFechaSola(s.Fecha_Fin)}
          </div>
          <span class="sub-dias ${urgente ? 'urgente' : ''}">
            ${urgente ? '⚠️ ' : ''}${diasRestantes} días restantes
          </span>
        </div>
        <div class="sub-actions">
          <span class="sub-status activa">ACTIVA</span>
          <button class="btn-cancelar-sub" data-id="${s.id}" title="Cancelar suscripción">Cancelar</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.btn-cancelar-sub').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCancelacion(btn.dataset.id));
  });
}

async function renderPlanesContratacion() {
  const usuario = await Auth.usuarioActual();
  const container = document.getElementById('planes-grid');
  const deportesList = Object.entries(DEPORTES_CONFIG);

  if (deportesList.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1">El administrador aún no ha configurado ningún deporte.</div>';
    return;
  }

  container.innerHTML = deportesList.map(() =>
    `<div class="plan-card plan-skeleton"></div>`
  ).join('');

  const activosPorDeporte = await Promise.all(
    deportesList.map(([key]) => DB.Subscricion.tieneActiva(usuario.US_DNI, key))
  );

  container.innerHTML = deportesList.map(([key, cfg], i) => {
    const yaActivo = activosPorDeporte[i];
    return `
      <div class="plan-card ${yaActivo ? 'plan-card--suscrito' : ''}" style="--sport-color:${cfg.color}" data-deporte="${key}">
        ${yaActivo ? `<div class="plan-badge-suscrito">✓ SUSCRITO</div>` : ''}
        <div class="plan-sport-name"><span>${cfg.icon}</span> ${cfg.label}</div>
        <div id="plan-edad-${key}" class="plan-edad-info" style="font-size:12px;color:var(--clr-muted);margin-bottom:0.5rem;min-height:16px"></div>
        <div class="plan-options ${yaActivo ? 'plan-options--disabled' : ''}">
          <div class="plan-option selected" data-modalidad="mensual" data-deporte="${key}">
            <div class="plan-option-label">Mensual</div>
            <div class="plan-option-price" style="color:${cfg.color}">${cfg.precio.mensual}€</div>
            <div class="plan-option-sub">/mes</div>
          </div>
          <div class="plan-option" data-modalidad="trimestral" data-deporte="${key}">
            <div class="plan-option-label">Trimestral</div>
            <div class="plan-option-price" style="color:${cfg.color}">${cfg.precio.trimestral}€</div>
            <div class="plan-option-sub">/3 meses</div>
          </div>
          <div class="plan-option" data-modalidad="anual" data-deporte="${key}">
            <div class="plan-option-label">Anual</div>
            <div class="plan-option-price" style="color:${cfg.color}">${cfg.precio.anual}€</div>
            <div class="plan-option-sub">/año</div>
            <div class="plan-option-ahorro" style="color:${cfg.color}">MEJOR PRECIO</div>
          </div>
        </div>
        ${yaActivo
        ? `<div class="plan-ya-activo"><span style="color:var(--clr-success)">✓</span> Ya tienes este deporte activo</div>`
        : `<button class="btn-contratar full" data-deporte="${key}" style="--btn-color:${cfg.color}">Suscribirse a ${cfg.label}</button>`
      }
      </div>`;
  }).join('');

  // Cargar y mostrar rangos de edad por deporte
  deportesList.forEach(async ([key]) => {
    const el = document.getElementById(`plan-edad-${key}`);
    if (!el) return;
    const cats = await DB.Categoria.listarPorDeporte(key);
    if (cats.length === 0) {
      el.textContent = '';
    } else {
      el.textContent = '👥 ' + cats.map(c => `${c.Nombre}: ${c.EdadMin}–${c.EdadMax} años`).join(' · ');
    }
  });

  container.querySelectorAll('.plan-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const deporte = opt.dataset.deporte;
      const card = container.querySelector(`.plan-card[data-deporte="${deporte}"]`);
      if (card.classList.contains('plan-card--suscrito')) return;
      container.querySelectorAll(`.plan-option[data-deporte="${deporte}"]`)
        .forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  container.querySelectorAll('.btn-contratar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const deporte = btn.dataset.deporte;
      const cfg = DEPORTES_CONFIG[deporte];
      const modalidadOpt = container.querySelector(`.plan-option.selected[data-deporte="${deporte}"]`);
      const modalidad = modalidadOpt ? modalidadOpt.dataset.modalidad : 'mensual';

      btn.disabled = true;
      btn.textContent = 'Procesando…';
      btn.style.opacity = '0.7';

      // Validar edad del usuario contra las categorías del deporte
      const categoriasDeporte = await DB.Categoria.listarPorDeporte(deporte);
      if (categoriasDeporte.length > 0) {
        const hoy = new Date();
        const fnac = new Date(usuario.F_Nacimiento);
        let edad = hoy.getFullYear() - fnac.getFullYear();
        const mDiff = hoy.getMonth() - fnac.getMonth();
        if (mDiff < 0 || (mDiff === 0 && hoy.getDate() < fnac.getDate())) edad--;

        const categoriaValida = categoriasDeporte.some(
          cat => edad >= cat.EdadMin && edad <= cat.EdadMax
        );

        if (!categoriaValida) {
          const rangos = categoriasDeporte
            .map(cat => `${cat.Nombre} (${cat.EdadMin}–${cat.EdadMax} años)`)
            .join(', ');
          btn.disabled = false;
          btn.textContent = `Suscribirse a ${cfg.label}`;
          btn.style.opacity = '';
          mostrarToast(
            `No puedes suscribirte a ${cfg.label}. Tu edad (${edad} años) no encaja en ninguna categoría disponible: ${rangos}.`,
            'error'
          );
          return;
        }
      }

      const resultado = await DB.Subscricion.crear({ US_DNI: usuario.US_DNI, Modalidad: modalidad, Deporte: deporte });

      if (!resultado.ok) {
        btn.disabled = false;
        btn.textContent = `Suscribirse a ${cfg.label}`;
        btn.style.opacity = '';
        mostrarToast(resultado.error, 'error');
        return;
      }

      mostrarToast(`¡Suscripción a ${cfg.label} activada! 🎉`, 'success');
      await renderMisSuscripciones();
      await renderPlanesContratacion();

      const statSubs = document.getElementById('stat-subs');
      if (statSubs) {
        const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
        statSubs.textContent = subs.filter(s => s.Estado === 'activa').length;
      }
    });
  });
}

function abrirModalCancelacion(subId) {
  _cancelarSubId = subId;
  toggle(document.getElementById('modal-cancelar'), true);
}

document.getElementById('btn-confirm-cancelar').addEventListener('click', async () => {
  if (_cancelarSubId === null) return;
  const usuario = await Auth.usuarioActual();
  const resultado = await DB.Subscricion.cancelar(_cancelarSubId, usuario.US_DNI);
  if (resultado.ok) {
    toggle(document.getElementById('modal-cancelar'), false);
    _cancelarSubId = null;
    await renderMisSuscripciones();
    await renderPlanesContratacion();
    const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
    document.getElementById('stat-subs').textContent = subs.filter(s => s.Estado === 'activa').length;
  }
});

document.getElementById('btn-cancel-modal').addEventListener('click', () => {
  toggle(document.getElementById('modal-cancelar'), false);
  _cancelarSubId = null;
});

document.getElementById('close-modal-cancelar').addEventListener('click', () => {
  toggle(document.getElementById('modal-cancelar'), false);
  _cancelarSubId = null;
});

/* ============================================================
   PERFIL
   ============================================================ */

document.getElementById('btn-perfil').addEventListener('click', async () => {
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;
  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  const activas = subs.filter(s => s.Estado === 'activa');

  const rolBadge = usuario.Rol === 'admin'
    ? `<span style="background:rgba(232,255,71,0.15);border:1px solid rgba(232,255,71,0.4);color:var(--clr-accent);
                    font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;letter-spacing:.5px">ADMIN</span>`
    : '';

  document.getElementById('perfil-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(232,255,71,0.1);
                  border:1px solid rgba(232,255,71,0.3);display:flex;align-items:center;
                  justify-content:center;font-family:var(--font-display);font-size:20px;
                  font-weight:700;color:var(--clr-accent)">
        ${iniciales(usuario.Nombre)}
      </div>
      <div>
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;display:flex;align-items:center;gap:8px">
          ${usuario.Nombre} ${rolBadge}
        </div>
        <div style="font-size:12px;color:var(--clr-muted)">${usuario.Correo}</div>
      </div>
    </div>
    <div class="perfil-field">
      <div class="perfil-label">DNI</div>
      <div class="perfil-value">${usuario.US_DNI}</div>
    </div>
    <div class="perfil-field">
      <div class="perfil-label">Fecha de nacimiento</div>
      <div class="perfil-value">${formatFechaSola(usuario.F_Nacimiento)}</div>
    </div>
    <div class="perfil-field">
      <div class="perfil-label">Rol</div>
      <div class="perfil-value" style="text-transform:capitalize">${usuario.Rol || 'predeterminado'}</div>
    </div>
    <div class="perfil-field">
      <div class="perfil-label">Suscripciones activas</div>
      <div class="perfil-value">
        ${activas.length === 0
      ? '<span style="color:var(--clr-muted);font-size:14px">Ninguna</span>'
      : activas.map(s => {
        const cfg = DEPORTES_CONFIG[s.Deporte] || {};
        return `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:8px;margin-bottom:4px;
                                    background:var(--clr-surface2);border:1px solid var(--clr-border);
                                    border-radius:20px;padding:3px 10px;font-size:13px">
                        ${cfg.icon || '🏅'} ${cfg.label || s.Deporte}
                      </span>`;
      }).join('')
    }
      </div>
    </div>
    <div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--clr-border)">
      <button id="btn-abrir-eliminar-cuenta" class="btn-danger" style="width:100%">
        🗑 Eliminar mi cuenta
      </button>
    </div>`;

  toggle(document.getElementById('modal-perfil'), true);

  document.getElementById('btn-abrir-eliminar-cuenta').addEventListener('click', () => {
    toggle(document.getElementById('modal-perfil'), false);
    toggle(document.getElementById('modal-eliminar-cuenta'), true);
  });
});

document.getElementById('close-modal-perfil').addEventListener('click', () => {
  toggle(document.getElementById('modal-perfil'), false);
});

document.getElementById('modal-perfil').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) toggle(e.currentTarget, false);
});

/* ============================================================
   LOGOUT
   ============================================================ */

document.getElementById('btn-logout').addEventListener('click', () => {
  Auth.cerrarSesion();
  location.reload();
});

/* ============================================================
   ELIMINAR CUENTA
   ============================================================ */

document.getElementById('close-modal-eliminar-cuenta').addEventListener('click', () => {
  toggle(document.getElementById('modal-eliminar-cuenta'), false);
});
document.getElementById('btn-cancel-eliminar-cuenta').addEventListener('click', () => {
  toggle(document.getElementById('modal-eliminar-cuenta'), false);
});
document.getElementById('modal-eliminar-cuenta').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) toggle(e.currentTarget, false);
});
document.getElementById('btn-confirm-eliminar-cuenta').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-eliminar-cuenta');
  btn.disabled = true;
  btn.textContent = 'Eliminando…';

  const resultado = await Auth.eliminarCuenta();
  if (!resultado.ok) {
    btn.disabled = false;
    btn.textContent = 'Sí, eliminar mi cuenta';
    mostrarToast(resultado.error, 'error');
    return;
  }
  location.reload();
});

/* ============================================================
   PANEL ADMIN
   ============================================================ */

// Estado local del admin
const adminState = {
  tabActual: 'deportes',
  editandoDeporte: null,
  editandoProfesor: null,
  editandoClase: null,
  editandoCategoria: null,
};

async function renderAdmin() {
  const usuario = await Auth.usuarioActual();
  if (!usuario || usuario.Rol !== 'admin') {
    document.getElementById('page-admin').innerHTML = `
      <div class="page-header"><h2 class="page-title">Acceso denegado</h2></div>
      <div class="page-content"><div class="empty-state">No tienes permisos para acceder a esta sección.</div></div>`;
    return;
  }
  renderAdminTabs();
  await switchAdminTab(adminState.tabActual);
}

function renderAdminTabs() {
  const tabs = document.getElementById('admin-tabs');
  if (!tabs) return;
  const tabsList = [
    { id: 'deportes', label: '🏅 Deportes' },
    { id: 'categorias', label: '🏷️ Categorías' },
    { id: 'profesores', label: '👨‍🏫 Profesores' },
    { id: 'clases', label: '📅 Clases' },
  ];

  tabs.innerHTML = tabsList.map(t => `
    <button class="admin-tab ${adminState.tabActual === t.id ? 'active' : ''}" data-tab="${t.id}">
      ${t.label}
    </button>`).join('');

  tabs.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
  });
}

async function switchAdminTab(tab) {
  adminState.tabActual = tab;
  renderAdminTabs();
  const content = document.getElementById('admin-content');
  content.innerHTML = '<div class="admin-loading">Cargando…</div>';

  switch (tab) {
    case 'deportes': await renderAdminDeportes(); break;
    case 'categorias': await renderAdminCategorias(); break;
    case 'profesores': await renderAdminProfesores(); break;
    case 'clases': await renderAdminClases(); break;
  }
}

/* --- ADMIN: DEPORTES --- */
async function renderAdminDeportes() {
  const content = document.getElementById('admin-content');
  const deportes = await DB.Deporte.listarTodos();

  content.innerHTML = `
    <div class="admin-section-header">
      <h3 class="admin-section-title">Deportes (${deportes.length})</h3>
      <button class="btn-primary" id="btn-nuevo-deporte">+ Nuevo deporte</button>
    </div>
    <div id="form-deporte" class="admin-form hidden"></div>
    <div class="admin-table-wrap">
      ${deportes.length === 0
      ? '<div class="empty-state">No hay deportes. Crea el primero.</div>'
      : `<table class="admin-table">
            <thead><tr><th>Icono</th><th>Nombre</th><th>Color</th><th>Mensual</th><th>Trimestral</th><th>Anual</th><th>Acciones</th></tr></thead>
            <tbody>
              ${deportes.map(d => `
                <tr>
                  <td style="font-size:22px">${d.Icono || '🏅'}</td>
                  <td><strong>${d.Nombre}</strong></td>
                  <td><span class="color-dot" style="background:${d.Color}"></span>${d.Color}</td>
                  <td>${(d.Precios?.mensual ?? '—')}€</td>
                  <td>${(d.Precios?.trimestral ?? '—')}€</td>
                  <td>${(d.Precios?.anual ?? '—')}€</td>
                  <td class="admin-actions">
                    <button class="btn-ghost btn-sm btn-edit-deporte" data-id="${d.id}">Editar</button>
                    <button class="btn-danger btn-sm btn-del-deporte" data-id="${d.id}" data-nombre="${d.Nombre}">Eliminar</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`
    }
    </div>`;

  document.getElementById('btn-nuevo-deporte').addEventListener('click', () => {
    mostrarFormDeporte(null);
  });

  content.querySelectorAll('.btn-edit-deporte').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dep = await DB.Deporte.buscarPorId(btn.dataset.id);
      mostrarFormDeporte(dep);
    });
  });

  content.querySelectorAll('.btn-del-deporte').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminarDeporte(btn.dataset.id, btn.dataset.nombre));
  });
}

function mostrarFormDeporte(dep) {
  const formEl = document.getElementById('form-deporte');
  const esNuevo = !dep;

  formEl.innerHTML = `
    <div class="admin-form-inner">
      <h4>${esNuevo ? 'Nuevo deporte' : 'Editar: ' + dep.Nombre}</h4>
      <div class="admin-form-grid">
        ${esNuevo ? `<div class="field"><label>Nombre</label><input id="dep-nombre" type="text" placeholder="Ej: Natación" value="" /></div>` : ''}
        <div class="field"><label>Icono (emoji)</label><input id="dep-icono" type="text" maxlength="4" placeholder="🏅" value="${dep?.Icono || ''}" /></div>
        <div class="field"><label>Color (hex)</label><input id="dep-color" type="color" value="${dep?.Color || '#e8ff47'}" /></div>
        <div class="field"><label>Precio mensual (€)</label><input id="dep-p-mensual" type="number" step="0.01" min="0" value="${dep?.Precios?.mensual ?? 29.99}" /></div>
        <div class="field"><label>Precio trimestral (€)</label><input id="dep-p-trim" type="number" step="0.01" min="0" value="${dep?.Precios?.trimestral ?? 79.99}" /></div>
        <div class="field"><label>Precio anual (€)</label><input id="dep-p-anual" type="number" step="0.01" min="0" value="${dep?.Precios?.anual ?? 269.99}" /></div>
      </div>
      <div id="form-dep-error" class="msg-error hidden"></div>
      <div class="admin-form-actions">
        <button class="btn-primary" id="btn-guardar-deporte">${esNuevo ? 'Crear deporte' : 'Guardar cambios'}</button>
        <button class="btn-ghost" id="btn-cancelar-form-deporte">Cancelar</button>
      </div>
    </div>`;

  formEl.classList.remove('hidden');

  document.getElementById('btn-cancelar-form-deporte').addEventListener('click', () => {
    formEl.classList.add('hidden');
  });

  document.getElementById('btn-guardar-deporte').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-deporte');
    const errEl = document.getElementById('form-dep-error');
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const datos = {
      Icono: document.getElementById('dep-icono').value || '🏅',
      Color: document.getElementById('dep-color').value,
      Precios: {
        mensual: parseFloat(document.getElementById('dep-p-mensual').value),
        trimestral: parseFloat(document.getElementById('dep-p-trim').value),
        anual: parseFloat(document.getElementById('dep-p-anual').value),
      },
    };

    let resultado;
    if (esNuevo) {
      const nombre = document.getElementById('dep-nombre').value.trim();
      if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Crear deporte'; return; }
      resultado = await DB.Deporte.crear({ Nombre: nombre, ...datos });
    } else {
      resultado = await DB.Deporte.actualizar(dep.id, datos);
    }

    btn.disabled = false; btn.textContent = esNuevo ? 'Crear deporte' : 'Guardar cambios';

    if (!resultado.ok) {
      errEl.textContent = resultado.error;
      errEl.classList.remove('hidden');
      return;
    }

    mostrarToast(esNuevo ? '¡Deporte creado!' : '¡Deporte actualizado!', 'success');
    await cargarDeportesConfig();
    await renderAdminDeportes();
  });
}

function confirmarEliminarDeporte(id, nombre) {
  const modal = document.getElementById('modal-admin-eliminar');
  document.getElementById('admin-eliminar-msg').innerHTML =
    `⚠️ ¿Eliminar el deporte <strong>${nombre}</strong>?<br>
     <span style="font-size:13px;color:var(--clr-muted)">Se eliminarán en cascada todas sus categorías, clases, reservas de esas clases y suscripciones activas.</span>`;

  toggle(modal, true);

  const btnConfirm = document.getElementById('btn-admin-confirm-eliminar');
  const nuevoBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(nuevoBtn, btnConfirm);

  nuevoBtn.addEventListener('click', async () => {
    nuevoBtn.disabled = true; nuevoBtn.textContent = 'Eliminando…';
    await DB.Deporte.eliminar(id);
    await cargarDeportesConfig();
    toggle(modal, false);
    mostrarToast(`Deporte "${nombre}" eliminado con todos sus datos.`, 'success');
    await renderAdminDeportes();
  });
}

/* --- ADMIN: CATEGORÍAS --- */
async function renderAdminCategorias() {
  const content = document.getElementById('admin-content');
  await cargarDeportesConfig();
  const deportesList = Object.entries(DEPORTES_CONFIG);
  const categorias = await DB.Categoria.listarTodas();

  content.innerHTML = `
    <div class="admin-section-header">
      <h3 class="admin-section-title">Categorías (${categorias.length})</h3>
      <button class="btn-primary" id="btn-nueva-categoria">+ Nueva categoría</button>
    </div>
    <div id="form-categoria" class="admin-form hidden"></div>
    <div class="admin-table-wrap">
      ${categorias.length === 0
      ? '<div class="empty-state">No hay categorías. Crea la primera.</div>'
      : `<table class="admin-table">
            <thead><tr><th>Nombre</th><th>Deporte</th><th>Edad mín.</th><th>Edad máx.</th><th>Acciones</th></tr></thead>
            <tbody>
              ${categorias.map(c => {
        const dep = DEPORTES_CONFIG[c.Deporte] || {};
        return `
                  <tr>
                    <td><strong>${c.Nombre}</strong></td>
                    <td>${dep.icon || ''} ${dep.label || c.Deporte}</td>
                    <td>${c.EdadMin} años</td>
                    <td>${c.EdadMax} años</td>
                    <td class="admin-actions">
                      <button class="btn-ghost btn-sm btn-edit-cat" data-id="${c.id}">Editar</button>
                      <button class="btn-danger btn-sm btn-del-cat" data-id="${c.id}" data-nombre="${c.Nombre}">Eliminar</button>
                    </td>
                  </tr>`;
      }).join('')}
            </tbody>
          </table>`
    }
    </div>`;

  document.getElementById('btn-nueva-categoria').addEventListener('click', () => {
    mostrarFormCategoria(null, deportesList);
  });

  content.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const snap = await firebase.firestore().collection('Categoria').doc(btn.dataset.id).get();
      if (snap.exists) mostrarFormCategoria({ id: snap.id, ...snap.data() }, deportesList);
    });
  });

  content.querySelectorAll('.btn-del-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-admin-eliminar');
      document.getElementById('admin-eliminar-msg').innerHTML =
        `¿Eliminar la categoría <strong>${btn.dataset.nombre}</strong>?`;
      toggle(modal, true);
      const btnC = document.getElementById('btn-admin-confirm-eliminar');
      const nuevoBtn = btnC.cloneNode(true);
      btnC.parentNode.replaceChild(nuevoBtn, btnC);
      nuevoBtn.addEventListener('click', async () => {
        await DB.Categoria.eliminar(btn.dataset.id);
        toggle(modal, false);
        mostrarToast('Categoría eliminada.', 'success');
        await renderAdminCategorias();
      });
    });
  });
}

function mostrarFormCategoria(cat, deportesList) {
  const formEl = document.getElementById('form-categoria');
  const esNuevo = !cat;

  formEl.innerHTML = `
    <div class="admin-form-inner">
      <h4>${esNuevo ? 'Nueva categoría' : 'Editar: ' + cat.Nombre}</h4>
      <div class="admin-form-grid">
        <div class="field"><label>Nombre</label><input id="cat-nombre" type="text" placeholder="Ej: Alevín" value="${cat?.Nombre || ''}" /></div>
        <div class="field">
          <label>Deporte</label>
          <select id="cat-deporte">
            ${deportesList.map(([key, cfg]) => `<option value="${key}" ${cat?.Deporte === key ? 'selected' : ''}>${cfg.icon} ${cfg.label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Edad mínima</label><input id="cat-edad-min" type="number" min="0" max="99" value="${cat?.EdadMin ?? 0}" /></div>
        <div class="field"><label>Edad máxima</label><input id="cat-edad-max" type="number" min="0" max="99" value="${cat?.EdadMax ?? 18}" /></div>
      </div>
      <div id="form-cat-error" class="msg-error hidden"></div>
      <div class="admin-form-actions">
        <button class="btn-primary" id="btn-guardar-cat">${esNuevo ? 'Crear categoría' : 'Guardar cambios'}</button>
        <button class="btn-ghost" id="btn-cancelar-form-cat">Cancelar</button>
      </div>
    </div>`;

  formEl.classList.remove('hidden');

  document.getElementById('btn-cancelar-form-cat').addEventListener('click', () => formEl.classList.add('hidden'));

  document.getElementById('btn-guardar-cat').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-cat');
    const errEl = document.getElementById('form-cat-error');
    errEl.classList.add('hidden');

    const datos = {
      Nombre: document.getElementById('cat-nombre').value.trim(),
      Deporte: document.getElementById('cat-deporte').value,
      EdadMin: parseInt(document.getElementById('cat-edad-min').value),
      EdadMax: parseInt(document.getElementById('cat-edad-max').value),
    };

    if (!datos.Nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.remove('hidden'); return; }
    if (datos.EdadMin > datos.EdadMax) { errEl.textContent = 'La edad mínima no puede ser mayor que la máxima.'; errEl.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Guardando…';

    const resultado = esNuevo
      ? await DB.Categoria.crear(datos)
      : await DB.Categoria.actualizar(cat.id, datos);

    btn.disabled = false; btn.textContent = esNuevo ? 'Crear categoría' : 'Guardar cambios';

    if (!resultado.ok) { errEl.textContent = resultado.error; errEl.classList.remove('hidden'); return; }

    mostrarToast(esNuevo ? '¡Categoría creada!' : '¡Categoría actualizada!', 'success');
    await renderAdminCategorias();
  });
}

/* --- ADMIN: PROFESORES --- */
async function renderAdminProfesores() {
  const content = document.getElementById('admin-content');
  const profesores = await DB.Profesor.listarTodos();
  const deportesList = Object.entries(DEPORTES_CONFIG);

  content.innerHTML = `
    <div class="admin-section-header">
      <h3 class="admin-section-title">Profesores (${profesores.length})</h3>
      <button class="btn-primary" id="btn-nuevo-profesor">+ Nuevo profesor</button>
    </div>
    <div id="form-profesor" class="admin-form hidden"></div>
    <div class="admin-table-wrap">
      ${profesores.length === 0
      ? '<div class="empty-state">No hay profesores. Crea el primero.</div>'
      : `<table class="admin-table">
            <thead><tr><th>Nombre</th><th>DNI</th><th>Especialidad</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr></thead>
            <tbody>
              ${profesores.map(p => {
        const dep = DEPORTES_CONFIG[p.Especialidad] || {};
        return `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:8px">
                      <div class="profesor-avatar" style="flex-shrink:0">${iniciales(p.Nombre)}</div>
                      <strong>${p.Nombre}</strong>
                    </div></td>
                    <td><code>${p.PRO_DNI}</code></td>
                    <td>${dep.icon || ''} ${dep.label || p.Especialidad}</td>
                    <td>${p.Email || '—'}</td>
                    <td>${p.Telefono || '—'}</td>
                    <td class="admin-actions">
                      <button class="btn-ghost btn-sm btn-edit-prof" data-dni="${p.PRO_DNI}">Editar</button>
                      <button class="btn-danger btn-sm btn-del-prof" data-dni="${p.PRO_DNI}" data-nombre="${p.Nombre}">Eliminar</button>
                    </td>
                  </tr>`;
      }).join('')}
            </tbody>
          </table>`
    }
    </div>`;

  document.getElementById('btn-nuevo-profesor').addEventListener('click', () => {
    mostrarFormProfesor(null, deportesList);
  });

  content.querySelectorAll('.btn-edit-prof').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prof = await DB.Profesor.buscarPorDNI(btn.dataset.dni);
      mostrarFormProfesor(prof, deportesList);
    });
  });

  content.querySelectorAll('.btn-del-prof').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-admin-eliminar');
      document.getElementById('admin-eliminar-msg').innerHTML =
        `¿Eliminar al profesor <strong>${btn.dataset.nombre}</strong>?<br>
         <span style="font-size:13px;color:var(--clr-muted)">Sus clases quedarán sin profesor asignado.</span>`;
      toggle(modal, true);
      const btnC = document.getElementById('btn-admin-confirm-eliminar');
      const nuevoBtn = btnC.cloneNode(true);
      btnC.parentNode.replaceChild(nuevoBtn, btnC);
      nuevoBtn.addEventListener('click', async () => {
        await DB.Profesor.eliminar(btn.dataset.dni);
        toggle(modal, false);
        mostrarToast(`Profesor "${btn.dataset.nombre}" eliminado.`, 'success');
        await renderAdminProfesores();
      });
    });
  });
}

function mostrarFormProfesor(prof, deportesList) {
  const formEl = document.getElementById('form-profesor');
  const esNuevo = !prof;

  formEl.innerHTML = `
    <div class="admin-form-inner">
      <h4>${esNuevo ? 'Nuevo profesor' : 'Editar: ' + prof.Nombre}</h4>
      <div class="admin-form-grid">
        <div class="field"><label>Nombre completo</label><input id="prof-nombre" type="text" placeholder="Ana García" value="${prof?.Nombre || ''}" /></div>
        ${esNuevo ? `<div class="field"><label>DNI</label><input id="prof-dni" type="text" placeholder="12345678A" value="" /></div>` : `<div class="field"><label>DNI</label><input disabled type="text" value="${prof.PRO_DNI}" style="opacity:.5" /></div>`}
        <div class="field">
          <label>Especialidad</label>
          <select id="prof-especialidad">
            ${deportesList.length === 0 ? '<option value="">— Crea un deporte primero —</option>' : deportesList.map(([key, cfg]) => `<option value="${key}" ${prof?.Especialidad === key ? 'selected' : ''}>${cfg.icon} ${cfg.label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Email</label><input id="prof-email" type="email" placeholder="prof@email.com" value="${prof?.Email || ''}" /></div>
        <div class="field"><label>Teléfono</label><input id="prof-tel" type="tel" placeholder="+34 600 000 000" value="${prof?.Telefono || ''}" /></div>
      </div>
      <div id="form-prof-error" class="msg-error hidden"></div>
      <div class="admin-form-actions">
        <button class="btn-primary" id="btn-guardar-prof">${esNuevo ? 'Crear profesor' : 'Guardar cambios'}</button>
        <button class="btn-ghost" id="btn-cancelar-form-prof">Cancelar</button>
      </div>
    </div>`;

  formEl.classList.remove('hidden');

  document.getElementById('btn-cancelar-form-prof').addEventListener('click', () => formEl.classList.add('hidden'));

  document.getElementById('btn-guardar-prof').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-prof');
    const errEl = document.getElementById('form-prof-error');
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const datos = {
      Nombre: document.getElementById('prof-nombre').value.trim(),
      Especialidad: document.getElementById('prof-especialidad').value,
      Email: document.getElementById('prof-email').value.trim(),
      Telefono: document.getElementById('prof-tel').value.trim(),
    };

    if (!datos.Nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = esNuevo ? 'Crear profesor' : 'Guardar cambios'; return; }

    let resultado;
    if (esNuevo) {
      const dni = document.getElementById('prof-dni').value.trim().toUpperCase();
      if (!/^[0-9]{8}[A-Za-z]$/.test(dni)) { errEl.textContent = 'DNI inválido (ej: 12345678A).'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Crear profesor'; return; }
      resultado = await DB.Profesor.crear({ PRO_DNI: dni, ...datos });
    } else {
      resultado = await DB.Profesor.actualizar(prof.PRO_DNI, datos);
    }

    btn.disabled = false; btn.textContent = esNuevo ? 'Crear profesor' : 'Guardar cambios';

    if (!resultado.ok) { errEl.textContent = resultado.error; errEl.classList.remove('hidden'); return; }

    mostrarToast(esNuevo ? '¡Profesor creado!' : '¡Profesor actualizado!', 'success');
    await renderAdminProfesores();
  });
}

/* --- ADMIN: CLASES --- */
async function renderAdminClases() {
  const content = document.getElementById('admin-content');
  const clases = await DB.Clases.listarTodas();
  const profesores = await DB.Profesor.listarTodos();
  const categorias = await DB.Categoria.listarTodas();
  const deportesList = Object.entries(DEPORTES_CONFIG);

  content.innerHTML = `
    <div class="admin-section-header">
      <h3 class="admin-section-title">Clases (${clases.length})</h3>
      <button class="btn-primary" id="btn-nueva-clase">+ Nueva clase</button>
    </div>
    <div id="form-clase" class="admin-form hidden"></div>
    <div class="admin-table-wrap">
      ${clases.length === 0
      ? '<div class="empty-state">No hay clases. Crea la primera.</div>'
      : `<table class="admin-table">
            <thead><tr><th>Deporte</th><th>Descripción</th><th>Horario</th><th>Pista</th><th>Profesor</th><th>Categoría</th><th>Acciones</th></tr></thead>
            <tbody>
              ${clases.map(c => {
        const dep = DEPORTES_CONFIG[c.Deporte] || {};
        const prof = profesores.find(p => p.PRO_DNI === c.PRO_DNI);
        const cat = categorias.find(cat => cat.id === c.Categoria);
        return `
                  <tr>
                    <td>${dep.icon || ''} ${dep.label || c.Deporte}</td>
                    <td>${c.Descripcion}</td>
                    <td><code>${c.Horario}</code></td>
                    <td>${c.Pista}</td>
                    <td>${prof ? prof.Nombre : '<span style="color:var(--clr-muted)">Sin asignar</span>'}</td>
                    <td>${cat ? cat.Nombre : '<span style="color:var(--clr-muted)">—</span>'}</td>
                    <td class="admin-actions">
                      <button class="btn-ghost btn-sm btn-edit-clase" data-id="${c.id}">Editar</button>
                      <button class="btn-danger btn-sm btn-del-clase" data-id="${c.id}" data-desc="${c.Descripcion}">Eliminar</button>
                    </td>
                  </tr>`;
      }).join('')}
            </tbody>
          </table>`
    }
    </div>`;

  document.getElementById('btn-nueva-clase').addEventListener('click', () => {
    mostrarFormClase(null, deportesList, profesores, categorias);
  });

  content.querySelectorAll('.btn-edit-clase').forEach(btn => {
    btn.addEventListener('click', async () => {
      const clase = await DB.Clases.buscarPorId(btn.dataset.id);
      mostrarFormClase(clase, deportesList, profesores, categorias);
    });
  });

  content.querySelectorAll('.btn-del-clase').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-admin-eliminar');
      document.getElementById('admin-eliminar-msg').innerHTML =
        `¿Eliminar la clase <strong>${btn.dataset.desc}</strong>?<br>
         <span style="font-size:13px;color:var(--clr-muted)">Se eliminarán todas las reservas asociadas a esta clase.</span>`;
      toggle(modal, true);
      const btnC = document.getElementById('btn-admin-confirm-eliminar');
      const nuevoBtn = btnC.cloneNode(true);
      btnC.parentNode.replaceChild(nuevoBtn, btnC);
      nuevoBtn.addEventListener('click', async () => {
        await DB.Clases.eliminar(btn.dataset.id);
        toggle(modal, false);
        mostrarToast('Clase y sus reservas eliminadas.', 'success');
        await renderAdminClases();
      });
    });
  });
}

function mostrarFormClase(clase, deportesList, profesores, categorias) {
  const formEl = document.getElementById('form-clase');
  const esNuevo = !clase;

  const profesoresFiltrados = (depId) =>
    profesores.filter(p => !depId || p.Especialidad === depId);

  const categoriasFiltradas = (depId) =>
    categorias.filter(c => !depId || c.Deporte === depId);

  formEl.innerHTML = `
    <div class="admin-form-inner">
      <h4>${esNuevo ? 'Nueva clase' : 'Editar clase'}</h4>
      <div class="admin-form-grid">
        <div class="field">
          <label>Deporte</label>
          <select id="clase-deporte">
            ${deportesList.length === 0 ? '<option value="">— Crea un deporte primero —</option>' : deportesList.map(([key, cfg]) => `<option value="${key}" ${clase?.Deporte === key ? 'selected' : ''}>${cfg.icon} ${cfg.label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Descripción</label><input id="clase-desc" type="text" placeholder="Ej: Técnica avanzada" value="${clase?.Descripcion || ''}" /></div>
        <div class="field"><label>Horario (ej: L-V 09:00-10:00)</label><input id="clase-horario" type="text" placeholder="L-V 09:00-10:00" value="${clase?.Horario || ''}" /></div>
        <div class="field"><label>Pista / Instalación</label><input id="clase-pista" type="text" placeholder="Ej: Campo A" value="${clase?.Pista || ''}" /></div>
        <div class="field">
          <label>Profesor</label>
          <select id="clase-profesor">
            <option value="">Sin asignar</option>
            ${profesoresFiltrados(clase?.Deporte).map(p => `<option value="${p.PRO_DNI}" ${clase?.PRO_DNI === p.PRO_DNI ? 'selected' : ''}>${p.Nombre}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Categoría</label>
          <select id="clase-categoria">
            <option value="">Sin categoría</option>
            ${categoriasFiltradas(clase?.Deporte).map(c => `<option value="${c.id}" ${clase?.Categoria === c.id ? 'selected' : ''}>${c.Nombre} (${c.EdadMin}-${c.EdadMax} años)</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="form-clase-error" class="msg-error hidden"></div>
      <div class="admin-form-actions">
        <button class="btn-primary" id="btn-guardar-clase">${esNuevo ? 'Crear clase' : 'Guardar cambios'}</button>
        <button class="btn-ghost" id="btn-cancelar-form-clase">Cancelar</button>
      </div>
    </div>`;

  formEl.classList.remove('hidden');

  // Al cambiar deporte, filtrar profesores y categorías
  document.getElementById('clase-deporte').addEventListener('change', (e) => {
    const depId = e.target.value;
    const selProf = document.getElementById('clase-profesor');
    const selCat = document.getElementById('clase-categoria');
    selProf.innerHTML = `<option value="">Sin asignar</option>` +
      profesoresFiltrados(depId).map(p => `<option value="${p.PRO_DNI}">${p.Nombre}</option>`).join('');
    selCat.innerHTML = `<option value="">Sin categoría</option>` +
      categoriasFiltradas(depId).map(c => `<option value="${c.id}">${c.Nombre} (${c.EdadMin}-${c.EdadMax} años)</option>`).join('');
  });

  document.getElementById('btn-cancelar-form-clase').addEventListener('click', () => formEl.classList.add('hidden'));

  document.getElementById('btn-guardar-clase').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-clase');
    const errEl = document.getElementById('form-clase-error');
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const datos = {
      Deporte: document.getElementById('clase-deporte').value,
      Descripcion: document.getElementById('clase-desc').value.trim(),
      Horario: document.getElementById('clase-horario').value.trim(),
      Pista: document.getElementById('clase-pista').value.trim(),
      PRO_DNI: document.getElementById('clase-profesor').value || null,
      Categoria: document.getElementById('clase-categoria').value || '',
    };

    if (!datos.Deporte || !datos.Descripcion || !datos.Horario || !datos.Pista) {
      errEl.textContent = 'Deporte, descripción, horario y pista son obligatorios.';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = esNuevo ? 'Crear clase' : 'Guardar cambios';
      return;
    }

    const resultado = esNuevo
      ? await DB.Clases.crear(datos)
      : await DB.Clases.actualizar(clase.id, datos);

    btn.disabled = false; btn.textContent = esNuevo ? 'Crear clase' : 'Guardar cambios';

    if (!resultado.ok) { errEl.textContent = resultado.error; errEl.classList.remove('hidden'); return; }

    mostrarToast(esNuevo ? '¡Clase creada!' : '¡Clase actualizada!', 'success');
    await renderAdminClases();
  });
}

/* ============================================================
   MODAL ADMIN ELIMINAR (compartido)
   ============================================================ */

document.getElementById('btn-admin-cancel-eliminar').addEventListener('click', () => {
  toggle(document.getElementById('modal-admin-eliminar'), false);
});
document.getElementById('close-modal-admin-eliminar').addEventListener('click', () => {
  toggle(document.getElementById('modal-admin-eliminar'), false);
});
document.getElementById('modal-admin-eliminar').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) toggle(e.currentTarget, false);
});

/* ============================================================
   INICIALIZACIÓN (post-login)
   ============================================================ */

window.App = {
  async iniciar() {
    const usuario = await Auth.usuarioActual();
    if (!usuario) return;

    // Ocultar pantalla de auth, mostrar app
    document.getElementById('page-auth').classList.add('hidden');
    document.getElementById('navbar').classList.remove('hidden');
    document.getElementById('nav-username').textContent = usuario.Nombre.split(' ')[0];
    document.getElementById('avatar-initials').textContent = iniciales(usuario.Nombre);

    // Mostrar/ocultar enlace admin según rol
    const navAdmin = document.getElementById('nav-admin-link');
    if (navAdmin) {
      if (usuario.Rol === 'admin') {
        navAdmin.classList.remove('hidden');
      } else {
        navAdmin.classList.add('hidden');
      }
    }

    await cargarDeportesConfig();
    await navegarA('dashboard'); // <--- AHORA NAVEGA A dashboard
  }
};

/* ARRANQUE */
(async function arranque() {
  // Ocultar el formulario de auth mientras se verifica la sesión,
  // para evitar que aparezca brevemente antes de redirigir al dashboard
  const pageAuth = document.getElementById('page-auth');
  pageAuth.classList.add('hidden');

  await DB.seed();

  const overlay = document.getElementById('loading-overlay');

  firebase.auth().onAuthStateChanged(async (firebaseUser) => {
    if (!overlay.classList.contains('hidden')) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.classList.add('hidden'), 400);
    }

    if (firebaseUser) {
      // Sesión activa: arrancar app sin mostrar auth en ningún momento
      await window.App.iniciar();
    } else {
      // Sin sesión: mostrar el formulario de login
      document.getElementById('navbar').classList.add('hidden');
      pageAuth.classList.remove('hidden');
      document.querySelectorAll('.page:not(#page-auth)').forEach(p => p.classList.add('hidden'));
    }
  });
})();
