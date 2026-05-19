/**
 * app.js — Controlador principal de la aplicación
 * Gestiona: navegación, dashboard, deportes, reservas, suscripciones y panel admin.
 */

/* ============================================================
   UTILIDADES
   ============================================================ */

/**
 * Funcion que permite formatear una fecha en ISO(YYYY-MM-DDTH:min:seg) a DD/MM/YYY
 * @param {string} iso Fecha en formato iso
 * @returns {string} fecha en formato DD/MM/YYY
 */
function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  // Devuelve el formateo de la fecha
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Funcion que permite formatear una fecha en ISO(YYYY-MM-DD) sin tiempo a DD/MM/YYY
 * @param {string} isoDate Fecha en formato iso
 * @returns {string} fecha en formato DD/MM/YYY
 */
function formatFechaSola(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  // Devuelve el formateo
  return `${d}/${m}/${y}`;
}

/**
 * Funcion que coge las iniciales de la persona para el icono al iniciar sesión
 * @param {string} nombre Cadena de texto con nombre apellido1 apellido2
 * @returns {string} Cadena de texto para las iniciales de la persona
 */
function iniciales(nombre) {
  if (!nombre) return '?';
  // Separa y posteriormente junta las iniciales
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

/**
 * Modifica la clase pasada por parametro para eliminar o añadir hidden
 * @param {HTMLElement} el Elemento para modificar la clase
 * @param {boolean} mostrar Boolean para modificar la clase y eliminar hidden
 */
function toggle(el, mostrar) {
  // Obtiene el objeto en el dom y segun el mostrar permite activar el atributo a activo o deshabilitarlo
  if (mostrar) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

/**
 * Crea un mensaje en la esquina inferior
 * @param {string} mensaje Texto a mostrar
 * @param {string} tipo Tipo de mensaje ('success' o 'error')
 */
function mostrarToast(mensaje, tipo = 'success') {
  // Recoge el toast en caso de que exista en el documento
  let toast = document.getElementById('app-toast');
  // Si no recoge nada lo crea
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  // Configuración del mensaje y sus estilos
  toast.textContent = mensaje;
  toast.className = `app-toast app-toast--${tipo} app-toast--visible`;
  // Timer para eliminar el mensaje tras 3.2 segundos
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('app-toast--visible');
  }, 3200);
}

/* ============================================================
   DEPORTES CONFIG (cargado desde Firestore)
   ============================================================ */

let DEPORTES_CONFIG = {};

/**
 * Carga la configuración de todos los deportes desde Firestore y la almacena en DEPORTES_CONFIG.
 * @returns {Promise<array>} Lista de deportes
 */
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

/**
 * Constante con los nombres de las diferentes paginas de la web
 */
const PAGINAS = ['dashboard', 'deportes', 'reservas', 'suscripciones', 'admin'];

/**
 * Funcion que permite la navegación entre las diferentes paginas de la web
 * @param {string} pagina Cadena de texto con la pagina a cambiar
 */
async function navegarA(pagina) {
  // Recorre el array completo y le añade la clase hidden a todas las paginas
  PAGINAS.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.add('hidden');
  });
  // Elimina la clase hidden a la pagina a mostrar
  const target = document.getElementById(`page-${pagina}`);
  if (target) target.classList.remove('hidden');

  // Muestra el boton correspondiente a la pagina
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pagina);
  });

  await cargarDeportesConfig();

  // Utiliza el render de la pagina que se necesite
  switch (pagina) {
    case 'dashboard': await renderDashboard(); break;
    case 'deportes': await renderDeportes(); break;
    case 'reservas': await renderPaginaReservas(); break;
    case 'suscripciones': await renderSuscripciones(); break;
    case 'admin': await renderAdmin(); break;
  }
}

// Se ejecuta nada más iniciar la página para cargar todos los botones
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navegarA(link.dataset.page);
  });
});

/* ============================================================
   DASHBOARD
   ============================================================ */

/**
 * Carga la información del panel principal a partir de la información del usuario en tiempo real
 */
async function renderDashboard() {
  // Obtiene el usuario actual desde Auth.js
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;

  // Recoge el nombre del usuario
  const primerNombre = usuario.Nombre.split(' ')[0];
  document.getElementById('hero-user-name').textContent = primerNombre;

  // Recoge todas las suscripciones y reservas del usuario para filtrar las activas
  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  const subsActivas = subs.filter(s => s.Estado === 'activa').length;
  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);

  // Actualiza los contadores del dashboard
  document.getElementById('stat-subs').textContent = subsActivas;
  document.getElementById('stat-reservas').textContent = reservas.length;

  // Próximas reservas (como máximo 4)
  const containerReservas = document.getElementById('dashboard-reservas');
  const proximas = reservas
    .filter(r => new Date(r.Fecha_Inicio) >= new Date())
    .slice(0, 4);

  // Si no hay próximas muestra un mensaje; si las hay genera el HTML junto a los listener para los botones de cancelar
  if (proximas.length === 0) {
    containerReservas.innerHTML = `<div class="empty-state">No tienes clases próximas reservadas. <a href="#" data-page="reservas" class="nav-link-inline">Reservar ahora →</a></div>`;
  } else {
    containerReservas.innerHTML = proximas.map(r => reservaItemHTML(r)).join('');
    containerReservas.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
      btn.addEventListener('click', () => cancelarReserva(btn.dataset.id));
    });
  }

  // Carga todos los deportes y comprueba que el usuario tiene la suscripción activa por deporte
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

    // Genera las tarjetas de deportes al usuario
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

    // Permite direccionar en los deportes que se seleccionan a la suscripción
    dashDeportes.querySelectorAll('.sport-card').forEach(card => {
      card.addEventListener('click', () => navegarA('suscripciones'));
    });
  }

  // Enlaces dentro del mensaje
  containerReservas.querySelectorAll('.nav-link-inline').forEach(a => {
    a.addEventListener('click', (e) => { e.preventDefault(); navegarA(a.dataset.page); });
  });
}

/**
 * Genera el HTML con la reserva con el objeto pasado por parametro
 * @param {object} r Objeto que recoge todos los datos de la reserva
 * @returns {string} HTML con toda la reserva generada
 */
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

/**
 * Crea la pagina de deportes y la renderiza
 */
async function renderDeportes() {
  // Variables para almacenar las tarjetas de deporte, profesores y clases de la base de datos
  const grid = document.getElementById('deportes-grid');
  const profesores = await DB.Profesor.listarTodos();
  const clases = await DB.Clases.listarTodas();

  if (Object.keys(DEPORTES_CONFIG).length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No hay deportes configurados todavía.</div>';
    return;
  }

  // Genera una tarjeta por deporte con sus profesores y clases correspondiente
  grid.innerHTML = Object.entries(DEPORTES_CONFIG).map(([key, cfg]) => {
    const profs = profesores.filter(p => p.Especialidad === key);
    const clasesDeporte = clases.filter(c => c.Deporte === key);

    // Genera el HTML de cada profesor
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

/**
 * Funcion que prepara la página de reservas y carga todos los deportes, clases e historial
 */
async function renderPaginaReservas() {
  // Obtiene el usuario actual
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;

  // Obtiene selector de todos los deportes y lo reinicia
  const selectDeporte = document.getElementById('reserva-deporte');
  selectDeporte.innerHTML = '<option value="">— Selecciona deporte —</option>';

  // Comprueba en paralelo si el usuario tiene suscripción activa a cada deporte
  const deportesList = Object.keys(DEPORTES_CONFIG);
  const activosPorDeporte = await Promise.all(
    deportesList.map(key => DB.Subscricion.tieneActiva(usuario.US_DNI, key))
  );

  // Añade los deportes a los que esté suscrito
  deportesList.forEach((key, i) => {
    if (activosPorDeporte[i]) {
      const cfg = DEPORTES_CONFIG[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${cfg.icon} ${cfg.label}`;
      selectDeporte.appendChild(opt);
    }
  });

  // En caso de que no exista ninguna suscripción
  if (selectDeporte.options.length === 1) {
    selectDeporte.innerHTML = '<option value="">No tienes suscripciones activas</option>';
  }

  // Fecha mínima = hoy
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('reserva-fecha').min = hoy;
  document.getElementById('reserva-fecha').value = hoy;

  // Listener: al cambiar deporte, cargar sus clases.
  // Clonamos el nodo para eliminar listeners previos y evitar duplicados
  const nuevoSelect = selectDeporte.cloneNode(true);
  selectDeporte.parentNode.replaceChild(nuevoSelect, selectDeporte);

  // Si el deporte cambia carga las clases del mismo
  nuevoSelect.addEventListener('change', async () => {
    const deporte = nuevoSelect.value;
    const selectClase = document.getElementById('reserva-clase');
    selectClase.innerHTML = '';

    // Muestra el mensaje en caso de no elegir deporte y resetea los límites de fecha
    if (!deporte) {
      selectClase.innerHTML = '<option value="">— Primero selecciona deporte —</option>';
      // Resetea los límites del input de fecha al deseleccionar deporte
      const fi = document.getElementById('reserva-fecha');
      fi.min = new Date().toISOString().split('T')[0];
      fi.max = '';
      return;
    }

    // Obtiene las clases del deporte
    const clases = await DB.Clases.listarPorDeporte(deporte);
    if (clases.length === 0) {
      selectClase.innerHTML = '<option value="">Sin clases disponibles</option>';
      return;
    }

    // Añade las clases al selector
    for (const c of clases) {
      const prof = c.PRO_DNI ? await DB.Profesor.buscarPorDNI(c.PRO_DNI) : null;
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.Horario} — ${c.Descripcion} (${prof ? prof.Nombre : 'Sin prof.'})`;
      selectClase.appendChild(opt);
    }

    // Obtiene la suscripción activa del usuario para limitar el rango de fechas reservables
    const sub = await DB.Subscricion.obtenerActiva(usuario.US_DNI, deporte);
    if (sub) {
      const hoyStr = new Date().toISOString().split('T')[0];
      const fechaInput = document.getElementById('reserva-fecha');
      // Establece el mínimo como el mayor entre hoy y el inicio de la suscripción
      fechaInput.min = sub.Fecha_Inicio > hoyStr ? sub.Fecha_Inicio : hoyStr;
      // Establece el máximo como la fecha de fin de la suscripción
      fechaInput.max = sub.Fecha_Fin;
      // Si el valor actual del input queda fuera del rango lo corrige al mínimo permitido
      if (fechaInput.value < fechaInput.min || fechaInput.value > sub.Fecha_Fin) {
        fechaInput.value = fechaInput.min;
      }
    }
  });

  // Botón reservar — clonar para evitar listeners duplicados
  const btnReserva = document.getElementById('btn-hacer-reserva');
  const nuevoBtn = btnReserva.cloneNode(true);
  btnReserva.parentNode.replaceChild(nuevoBtn, btnReserva);
  nuevoBtn.addEventListener('click', hacerReserva);

  // Renderiza el historial de reservas
  await renderHistorialReservas();
}

/**
 * Funcion que valida y crea una reserva de la clase
 */
async function hacerReserva() {
  // Variables de usuario y elementos del formulario
  const usuario = await Auth.usuarioActual();
  const deporteEl = document.getElementById('reserva-deporte');
  const claseEl = document.getElementById('reserva-clase');
  const fechaEl = document.getElementById('reserva-fecha');
  const msgErr = document.getElementById('reserva-msg');
  const msgOk = document.getElementById('reserva-ok');

  // Oculta mensajes previos
  toggle(msgErr, false);
  toggle(msgOk, false);

  const Clase_ID = claseEl.value;
  const Fecha = fechaEl.value;

  // Validaciones de valores del formulario
  if (!deporteEl.value) { msgErr.textContent = 'Selecciona un deporte.'; toggle(msgErr, true); return; }
  if (!Clase_ID) { msgErr.textContent = 'Selecciona una clase.'; toggle(msgErr, true); return; }
  if (!Fecha) { msgErr.textContent = 'Selecciona una fecha.'; toggle(msgErr, true); return; }

  // Comprueba que las fechas sean dentro del horario normal (lunes a viernes)
  const diaSemana = new Date(Fecha + 'T12:00:00').getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    msgErr.textContent = 'Las clases son de lunes a viernes.';
    toggle(msgErr, true); return;
  }

  // Crea la reserva; en caso de error lo muestra
  const resultado = await DB.Reserva.crear({ US_DNI: usuario.US_DNI, Clase_ID, Fecha });

  if (!resultado.ok) {
    msgErr.textContent = resultado.error;
    toggle(msgErr, true);
    return;
  }

  // Mensaje de corroboración y actualización del dashboard
  msgOk.textContent = `¡Reserva realizada correctamente para el ${formatFechaSola(Fecha)}!`;
  toggle(msgOk, true);
  await renderHistorialReservas();

  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);
  document.getElementById('stat-reservas').textContent = reservas.length;
}

/**
 * Funcion que muestra las reservas del usuario
 */
async function renderHistorialReservas() {
  const usuario = await Auth.usuarioActual();
  const container = document.getElementById('reservas-historial');
  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);

  // Comprobar reservas y mostrar mensaje en consecuencia
  if (reservas.length === 0) {
    container.innerHTML = '<div class="empty-state">No tienes reservas todavía.</div>';
    return;
  }

  // HTML de cada reserva y listener para cancelar
  container.innerHTML = reservas.map(r => reservaItemHTML(r)).join('');
  container.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
    btn.addEventListener('click', () => cancelarReserva(btn.dataset.id));
  });
}

/**
 * Función que cancela una reserva por su ID.
 * @param {string} id Identificador de la reserva a cancelar
 */
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

// Inicialización de variable global para la suscripción a cancelar
let _cancelarSubId = null;

/**
 * Renderiza la pagina de suscripciones del usuario en caso de que exista uno y sus planes disponibles
 */
async function renderSuscripciones() {
  // Obtención de usuario actual
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;
  // Si lo encuentra renderiza sus suscripciones y los planes disponibles
  await renderMisSuscripciones();
  await renderPlanesContratacion();
}

/**
 * Muestra todas las suscripciones activas y calcula los dias restantes junto a la creación de iconos correspondiente
 */
async function renderMisSuscripciones() {
  // Creación de variables y recolección del usuario actual
  const usuario = await Auth.usuarioActual();
  const container = document.getElementById('mis-suscripciones');
  // Obtención de todas las suscripciones del usuario
  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  // Filtro para solo las activas
  const activas = subs.filter(s => s.Estado === 'activa');

  // En caso de no tener suscripciones activas muestra el mensaje
  if (activas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No tienes ninguna suscripción activa.
        <br><span style="font-size:13px;margin-top:6px;display:block">Elige un deporte abajo y empieza hoy.</span>
      </div>`;
    return;
  }

  // Caso contrario muestra sus suscripciones activas
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

  // Listener para cancelar la suscripción
  container.querySelectorAll('.btn-cancelar-sub').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCancelacion(btn.dataset.id));
  });
}

/**
 * Muestra los planes de contratación disponibles para cada deporte
 */
async function renderPlanesContratacion() {
  // Recoge al usuario actual y guardamos los planes
  const usuario = await Auth.usuarioActual();
  const container = document.getElementById('planes-grid');
  const deportesList = Object.entries(DEPORTES_CONFIG);

  if (deportesList.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1">El administrador aún no ha configurado ningún deporte.</div>';
    return;
  }

  // Mostrar un div con la clase plan-card plan-skeleton mientras carga
  container.innerHTML = deportesList.map(() =>
    `<div class="plan-card plan-skeleton"></div>`
  ).join('');

  // Comprueba si el usuario tiene suscripción activa por deporte
  const activosPorDeporte = await Promise.all(
    deportesList.map(([key]) => DB.Subscricion.tieneActiva(usuario.US_DNI, key))
  );

  // Genera las tarjetas de planes
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

  // Permite al usuario seleccionar la modalidad
  container.querySelectorAll('.plan-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const deporte = opt.dataset.deporte;
      const card = container.querySelector(`.plan-card[data-deporte="${deporte}"]`);
      // No deja cambiar modalidad en caso de que ya esté suscrito ese usuario
      if (card.classList.contains('plan-card--suscrito')) return;
      // Elimina la selección anterior y permite marcar una nueva añadiendo la clase selected
      container.querySelectorAll(`.plan-option[data-deporte="${deporte}"]`)
        .forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Contratar suscripción
  container.querySelectorAll('.btn-contratar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const deporte = btn.dataset.deporte;
      const cfg = DEPORTES_CONFIG[deporte];
      // Obtención de la modalidad seleccionada anteriormente
      const modalidadOpt = container.querySelector(`.plan-option.selected[data-deporte="${deporte}"]`);
      const modalidad = modalidadOpt ? modalidadOpt.dataset.modalidad : 'mensual';

      // Estado de carga del botón
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

      // Creación de la suscripción si es posible
      const resultado = await DB.Subscricion.crear({ US_DNI: usuario.US_DNI, Modalidad: modalidad, Deporte: deporte });

      // Muestra error en caso de que exista
      if (!resultado.ok) {
        btn.disabled = false;
        btn.textContent = `Suscribirse a ${cfg.label}`;
        btn.style.opacity = '';
        mostrarToast(resultado.error, 'error');
        return;
      }

      mostrarToast(`¡Suscripción a ${cfg.label} activada! 🎉`, 'success');
      // Actualiza las suscripciones y planes
      await renderMisSuscripciones();
      await renderPlanesContratacion();

      // Actualizar stat del dashboard si está visible
      const statSubs = document.getElementById('stat-subs');
      if (statSubs) {
        const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
        statSubs.textContent = subs.filter(s => s.Estado === 'activa').length;
      }
    });
  });
}

/**
 * Muestra la configuración de la suscripción para cancelar la misma
 * @param {string} subId ID de la suscripción a cancelar
 */
function abrirModalCancelacion(subId) {
  _cancelarSubId = subId;
  toggle(document.getElementById('modal-cancelar'), true);
}

// Crea un listener con un botón para poder cancelar la suscripción seleccionada
document.getElementById('btn-confirm-cancelar').addEventListener('click', async () => {
  // Si no hay ninguna seleccionada no hace nada
  if (_cancelarSubId === null) return;
  // Variables que contienen la información del usuario y suscripción
  const usuario = await Auth.usuarioActual();
  const resultado = await DB.Subscricion.cancelar(_cancelarSubId, usuario.US_DNI);
  // Si la cancelación es correcta oculta la confirmación y renderiza la lista de suscripciones y planes
  if (resultado.ok) {
    toggle(document.getElementById('modal-cancelar'), false);
    // Reset de variable para la cancelación
    _cancelarSubId = null;
    await renderMisSuscripciones();
    await renderPlanesContratacion();
    const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
    document.getElementById('stat-subs').textContent = subs.filter(s => s.Estado === 'activa').length;
  }
});

// Listener para cerrar el modal cuando el usuario pulsa cancelar
document.getElementById('btn-cancel-modal').addEventListener('click', () => {
  toggle(document.getElementById('modal-cancelar'), false);
  // Reset de variable
  _cancelarSubId = null;
});

// Listener para cerrar modal cuando el usuario pulsa la "X"
document.getElementById('close-modal-cancelar').addEventListener('click', () => {
  toggle(document.getElementById('modal-cancelar'), false);
  _cancelarSubId = null;
});

/* ============================================================
   PERFIL
   ============================================================ */

/**
 * Listener para abrir el perfil de usuario y carga los datos del usuario junto a sus suscripciones activas
 */
document.getElementById('btn-perfil').addEventListener('click', async () => {
  // Obtiene el usuario actual autorizado
  const usuario = await Auth.usuarioActual();
  // Si no se encuentra no carga nada
  if (!usuario) return;
  // Obtención de suscripciones activas
  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  const activas = subs.filter(s => s.Estado === 'activa');

  const rolBadge = usuario.Rol === 'admin'
    ? `<span style="background:rgba(232,255,71,0.15);border:1px solid rgba(232,255,71,0.4);color:var(--clr-accent);
                    font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;letter-spacing:.5px">ADMIN</span>`
    : '';

  // Rellena el perfil con los datos del usuario
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

  // Muestra el perfil
  toggle(document.getElementById('modal-perfil'), true);

  // Listener del botón "Eliminar mi cuenta" (se re-registra cada vez que se abre el perfil)
  document.getElementById('btn-abrir-eliminar-cuenta').addEventListener('click', () => {
    toggle(document.getElementById('modal-perfil'), false);
    toggle(document.getElementById('modal-eliminar-cuenta'), true);
  });
});

// Listener para cerrar el perfil al pulsar la X
document.getElementById('close-modal-perfil').addEventListener('click', () => {
  toggle(document.getElementById('modal-perfil'), false);
});

// Listener para cerrar en caso de que el usuario pulse en cualquier otro sitio que no sea el perfil
document.getElementById('modal-perfil').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) toggle(e.currentTarget, false);
});

/* ============================================================
   LOGOUT
   ============================================================ */

// Listener para cerrar la sesion del usuario y recargar la página borrando la sesión anterior
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
  // Cuenta eliminada → redirigir al login
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

/**
 * Renderiza el panel de administración si el usuario tiene rol admin;
 * en caso contrario muestra un mensaje de acceso denegado.
 */
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

/**
 * Genera las pestañas de navegación del panel admin y sus listeners
 */
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

/**
 * Cambia la pestaña activa del panel admin y renderiza su contenido
 * @param {string} tab Identificador de la pestaña a mostrar
 */
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

/**
 * Renderiza la tabla de deportes en el panel admin con opciones de crear, editar y eliminar
 */
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

/**
 * Muestra el formulario inline para crear o editar un deporte
 * @param {object|null} dep Deporte a editar, o null para crear uno nuevo
 */
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

/**
 * Muestra el modal de confirmación para eliminar un deporte en cascada
 * @param {string} id ID del deporte a eliminar
 * @param {string} nombre Nombre del deporte para mostrar en el mensaje
 */
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

/**
 * Renderiza la tabla de categorías en el panel admin con opciones de crear, editar y eliminar
 */
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

/**
 * Muestra el formulario inline para crear o editar una categoría
 * @param {object|null} cat Categoría a editar, o null para crear una nueva
 * @param {Array} deportesList Lista de deportes disponibles para el selector
 */
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

/**
 * Renderiza la tabla de profesores en el panel admin con opciones de crear, editar y eliminar
 */
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

/**
 * Muestra el formulario inline para crear o editar un profesor
 * @param {object|null} prof Profesor a editar, o null para crear uno nuevo
 * @param {Array} deportesList Lista de deportes disponibles para el selector de especialidad
 */
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

/**
 * Renderiza la tabla de clases en el panel admin con opciones de crear, editar y eliminar
 */
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

/**
 * Muestra el formulario inline para crear o editar una clase
 * @param {object|null} clase Clase a editar, o null para crear una nueva
 * @param {Array} deportesList Lista de deportes disponibles
 * @param {Array} profesores Lista de profesores disponibles
 * @param {Array} categorias Lista de categorías disponibles
 */
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

  // Al cambiar deporte, filtrar profesores y categorías disponibles
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

// Oculta la pantalla de login y muestra la aplicación cargando el dashboard
window.App = {
  /**
   * Inicialización de la web: oculta el login, muestra la navbar y navega al inicio
   */
  async iniciar() {
    // Recoge el usuario actual
    const usuario = await Auth.usuarioActual();
    if (!usuario) return;

    // Oculta la página de autenticación
    document.getElementById('page-auth').classList.add('hidden');
    // Muestra barra de navegación, nombre de usuario y las iniciales del usuario
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
    await navegarA('reservas');
  }
};

/* ============================================================
   ARRANQUE
   ============================================================ */

/**
 * Funcion que se ejecuta al cargar la página.
 * Inserta los datos iniciales en la Base de datos en Firestore y
 * Firebase Auth notifica el estado de sesión de forma asíncrona mediante onAuthStateChanged.
 */
(async function arranque() {
  // Ocultar el formulario de auth mientras se verifica la sesión,
  // para evitar que aparezca brevemente antes de redirigir al dashboard
  const pageAuth = document.getElementById('page-auth');
  pageAuth.classList.add('hidden');

  // Inserta datos iniciales si no existen
  await DB.seed();

  // Quitar overlay de carga
  const overlay = document.getElementById('loading-overlay');

  // Firebase Auth notifica el estado de sesión de forma asíncrona.
  // onAuthStateChanged se dispara una vez al cargar con el usuario actual (o null).
  firebase.auth().onAuthStateChanged(async (firebaseUser) => {
    // Aplica animación de desvanecimiento y oculta completamente el overlay
    if (!overlay.classList.contains('hidden')) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.classList.add('hidden'), 400);
    }

    if (firebaseUser) {
      // Sesión activa: arrancar app sin mostrar auth en ningún momento
      await window.App.iniciar();
    } else {
      // Sin sesión → mostrar login y ocultar el resto de páginas
      document.getElementById('navbar').classList.add('hidden');
      pageAuth.classList.remove('hidden');
      document.querySelectorAll('.page:not(#page-auth)').forEach(p => p.classList.add('hidden'));
    }
  });
})();