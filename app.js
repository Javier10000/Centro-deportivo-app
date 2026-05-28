/**
 * Archivo de funciones para la web 
 */

/* ============================================================
   UTILIDADES
   ============================================================ */

/**
 * Formatea una fecha en formato ISO (por ejemplo: "2026-05-21") y la convierte a un formato de dd/mm/yyyy h m.
 * @param {string} iso - Cadena con una fecha en formato ISO.
 * @returns {string} - Fecha formateada o '—' si no se proporciona fecha.
 */
function formatFecha(iso) {
  //Recoge la fecha si no es nula y la devuelve formateada con fecha y hora
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
/**
 * Formatea una fecha en formato ISO (por ejemplo: "2026-05-21") y la convierte a un formato de dd/mm/yyyy.
 * @param {string} isoDate - Cadena con una fecha en formato ISO.
 * @returns {string} - Fecha formateada o '—' si no se proporciona fecha.
 */
function formatFechaSola(isoDate) {
    //Recoge la fecha si no es nula y la devuelve formateada solo con fecha
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
/**
 * Genera las iniciales a partir de un nombre completo.
 * @param {string} nombre - Nombre completo del usuario.
 * @returns {string} - Iniciales en mayúsculas o '?' si no hay nombre.
 */
function iniciales(nombre) {
  //modifica la cadena solo cogiendo con trim las iniciales
  if (!nombre) return '?';
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}
/**
 * Muestra u oculta un elemento del DOM añadiendo o quitando la clase 'hidden'.
 * Se usa para controlar la visibilidad de secciones/páginas en la aplicación.
 * @param {HTMLElement} el - Elemento del DOM que queremos mostrar u ocultar.
 * @param {boolean} mostrar - Si es true se muestra; si es false se oculta.
 */
function toggle(el, mostrar) {
  if (mostrar) el.classList.remove('hidden');
  else el.classList.add('hidden');
}
/**
 * Muestra elemento del DOM quitando la clase 'hidden'.
 * @param {HTMLElement} el - Elemento del DOM que queremos mostrar u ocultar.
 * @param {boolean} mostrar - Si es true se muestra; si es false se oculta.
 */
function mostrarToast(mensaje, tipo = 'success') {
  //Recoge o crea una capa div para aplicar a todo el contexto para aplicar la clase hidden
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.className = `app-toast app-toast--${tipo} app-toast--visible`;
  //Muestra u oculta el html tras 3 segundos
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('app-toast--visible');
  }, 3200);
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento ISO.
 * @param {string} fnacISO - Fecha de nacimiento en formato ISO.
 * @returns {number} - Edad en años completos.
 */
function calcularEdad(fnacISO) {
  const hoy = new Date();
  const fnac = new Date(fnacISO);
  let edad = hoy.getFullYear() - fnac.getFullYear();
  const mDiff = hoy.getMonth() - fnac.getMonth();
  if (mDiff < 0 || (mDiff === 0 && hoy.getDate() < fnac.getDate())) edad--;
  return edad;
}

/**
 * Clona un elemento del DOM para eliminar todos sus listeners previos y lo reinserta en su lugar.
 * @param {string} id - ID del elemento a clonar.
 * @returns {HTMLElement} - El nuevo nodo ya insertado en el DOM.
 */
function clonarElemento(id) {
  const el = document.getElementById(id);
  const nuevo = el.cloneNode(true);
  el.parentNode.replaceChild(nuevo, el);
  return nuevo;
}

/**
 * Abre el modal compartido de confirmación de eliminación del panel admin.
 * @param {string} htmlMensaje - Mensaje HTML a mostrar en el modal.
 * @param {Function} onConfirm - Función async a ejecutar al confirmar.
 */
function abrirModalAdminEliminar(htmlMensaje, onConfirm) {
  const modal = document.getElementById('modal-admin-eliminar');
  document.getElementById('admin-eliminar-msg').innerHTML = htmlMensaje;
  toggle(modal, true);
  //Reset de boton de confirmación para evitar listeners duplicados
  const nuevoBtn = clonarElemento('btn-admin-confirm-eliminar');
  nuevoBtn.addEventListener('click', async () => {
    nuevoBtn.disabled = true; nuevoBtn.textContent = 'Eliminando…';
    await onConfirm();
    toggle(modal, false);
  });
}

/* ============================================================
   DEPORTES CONFIG (cargado desde Firestore)
   ============================================================ */
//Array con todos los deportes guardados en la base de datos
let DEPORTES_CONFIG = {};
/**
 * Carga la configuración de todos los deportes desde la base de datos
 * @returns {Promise<Array>} - Lista de deportes obtenidos desde la BD.
 */
async function cargarDeportesConfig() {
  //REcoge los deportes de la base de datos
  const deportes = await DB.Deporte.listarTodos();

  DEPORTES_CONFIG = {};
  //Añade los deportes al array
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
   SIDEBAR — CATEGORÍAS
   ============================================================ */
/**
 * Carga y renderiza las categorías en la barra lateral agrupadas por deporte.
 * Muestra para cada categoría su nombre, rango de edad y el deporte al que pertenece.
 * @returns {Promise<void>} No devuelve valor; actualiza el DOM directamente.
 */
async function renderSidebarCategorias() {
  // Contenedor de la lista en el sidebar
  const lista = document.getElementById('sidebar-categorias-lista');
  if (!lista) return;

  // Asegurar que la config de deportes esté cargada
  if (Object.keys(DEPORTES_CONFIG).length === 0) {
    await cargarDeportesConfig();
  }

  // Obtener todas las categorías de la base de datos
  const categorias = await DB.Categoria.listarTodas();

  if (categorias.length === 0) {
    lista.innerHTML = '<div class="sidebar-cat-empty">Sin categorías definidas</div>';
    return;
  }

  // Agrupar categorías por deporte
  const porDeporte = {};
  categorias.forEach(cat => {
    const key = cat.Deporte || '_sin_deporte';
    if (!porDeporte[key]) porDeporte[key] = [];
    porDeporte[key].push(cat);
  });

  // Ordenar cada grupo por edad mínima
  Object.values(porDeporte).forEach(grupo =>
    grupo.sort((a, b) => a.EdadMin - b.EdadMin)
  );

  // Construir HTML agrupado por deporte
  lista.innerHTML = Object.entries(porDeporte).map(([depKey, cats]) => {
    const cfg = DEPORTES_CONFIG[depKey] || {};
    const deporteLabel = cfg.label || depKey;
    const deporteIcon = cfg.icon || '🏅';
    const deporteColor = cfg.color || 'var(--clr-accent)';

    return `
      <div class="sidebar-cat-grupo">
        <div class="sidebar-cat-deporte-header" style="--dep-color:${deporteColor}">
          <span class="sidebar-cat-deporte-icon">${deporteIcon}</span>
          <span class="sidebar-cat-deporte-nombre">${deporteLabel}</span>
        </div>
        <ul class="sidebar-cat-items">
          ${cats.map(cat => `
            <li class="sidebar-cat-item">
              <span class="sidebar-cat-nombre">${cat.Nombre}</span>
              <span class="sidebar-cat-edad">${cat.EdadMin}–${cat.EdadMax} años</span>
            </li>`).join('')}
        </ul>
      </div>`;
  }).join('');
}


//Array con todas las paginas disponibles en la web
const PAGINAS = ['dashboard', 'deportes', 'reservas', 'horarios', 'suscripciones', 'admin'];
/**
 * Navega a una página específica de la aplicación 
 * @param {string} pagina - Nombre de la página a mostrar (dashboard, deportes, reservas, etc.)
 */
async function navegarA(pagina) {
  //Oculta todas las paginas de la web añadiendo la clase hidden a todas ellas
  PAGINAS.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.add('hidden');
  });
//elimina hidden de la pagina a mostrar
  const target = document.getElementById(`page-${pagina}`);
  if (target) target.classList.remove('hidden');
//Recorre y activa solo la pagina seleccionada
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pagina);
  });
//Recoge los deportes para que se refleje tanto en la web como en la base de datos los deportes
  await cargarDeportesConfig();
//Renderiza la pagina seleccionada
  switch (pagina) {
    case 'dashboard': await renderDashboard(); break;
    case 'deportes': await renderDeportes(); break;
    case 'reservas': await renderPaginaReservas(); break;
    case 'horarios': await renderHorarios(); break;
    case 'suscripciones': await renderSuscripciones(); break;
    case 'admin': await renderAdmin(); break;
  }
}
//Recorremos todos los objetos que contengan el selector nav-link y les añade un boton a la espera del evento
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSidebar();
    navegarA(link.dataset.page);
  });
});

/* ============================================================
   SIDEBAR — abrir / cerrar
   ============================================================ */
/**
 * Abre el sidebar lateral de navegación.
 */
function abrirSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.add('sidebar--open');
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
/**
 * Cierra el sidebar lateral de navegación.
 */
function cerrarSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('sidebar--open');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('btn-sidebar-toggle').addEventListener('click', abrirSidebar);
document.getElementById('btn-sidebar-close').addEventListener('click', cerrarSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', cerrarSidebar);

/* ============================================================
   DASHBOARD
   ============================================================ */
/**
 * Renderiza el panel principal (dashboard) del usuario y muestra los datos 
 */
async function renderDashboard() {
  //Obtiene le usuario autenticado si no existe sale de la funcion
  const usuario = await Auth.usuarioActual();
  if (!usuario) return;

  //Recoge el nombre para mostrar un saludo al iniciar la sesion
  const primerNombre = usuario.Nombre.split(' ')[0];
  document.getElementById('hero-user-name').textContent = primerNombre;
  //Obtenemos todas las suscripciones y las filtramos por activas junto a sus reservas
  const subs = await DB.Subscricion.listarPorUsuario(usuario.US_DNI);
  const subsActivas = subs.filter(s => s.Estado === 'activa').length;
  const reservas = await DB.Reserva.listarPorUsuario(usuario.US_DNI);
//Muestra dentro de la pagina dashboards los datos
  document.getElementById('stat-subs').textContent = subsActivas;
  document.getElementById('stat-reservas').textContent = reservas.length;

//Recoge las proximas clases
  const containerReservas = document.getElementById('dashboard-reservas');
  //Filtra solo las activas, en caso de no existir ninguna genera un html y lo inserta en index
  const proximas = reservas
    .filter(r => new Date(r.Fecha_Inicio) >= new Date())
    .slice(0, 4);

  if (proximas.length === 0) {
    containerReservas.innerHTML = `<div class="empty-state">No tienes clases próximas reservadas. <a href="#" data-page="reservas" class="nav-link-inline">Reservar ahora →</a></div>`;
  } else {
    //Muestra las activas
    containerReservas.innerHTML = proximas.map(r => reservaItemHTML(r)).join('');
    containerReservas.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
      btn.addEventListener('click', () => cancelarReserva(btn.dataset.id));
    });
  }

  // Tarjetas de deportes
  const dashDeportes = document.getElementById('dash-deportes');
  const deportesList = Object.keys(DEPORTES_CONFIG);
  //Si no existen los deportes se genera un html 
  if (deportesList.length === 0) {
    //Construye cada tarjeta de deporte disponible
    dashDeportes.innerHTML = '<div class="empty-state">No hay deportes configurados todavía.</div>';
  } else {
//Obtenemos todas las clases disponibles por deportes y si tiene suscripcion activa para el mismo
    const clasesPorDeporte = await Promise.all(
      deportesList.map(key => DB.Clases.listarPorDeporte(key))
    );
    const activosPorDeporte = await Promise.all(
      deportesList.map(key => DB.Subscricion.tieneActiva(usuario.US_DNI, key))
    );

    //Construimos el html del dashboard de deportes mostrando sus mensajes
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
/**
 * Genera el HTML correspondiente a una reserva individual
 * @param {Object} r - Objeto de reserva con toda la información necesaria.
 * @returns {string} HTML listo para insertar en el DOM.
 */
function reservaItemHTML(r) {
  //Datos de la tarjeta
  const cfg = DEPORTES_CONFIG[r.Deporte] || {};
  const color = r.DeporteColor || cfg.color || '#fff';
  const icon = r.DeporteIcono || cfg.icon || '🏅';
  const label = r.DeporteNombre || cfg.label || r.Deporte;

 // Si la reserva incluye un tercero (hijo, familiar, amigo), generamos un badge adicional para rellenar los datos
  
  const terceroBadge = r.Tercero
    ? `<span class="reserva-tercero-badge" title="Alergias: ${r.Tercero.Alergias} · Tel: ${r.Tercero.Telefono}">
         👤 ${r.Tercero.Nombre} (${r.Tercero.Edad} años)
       </span>`
    : '';
//HTML listo para insertar en el DOM.
  return `
    <div class="reserva-item">
      <span class="reserva-sport-dot" style="background:${color}"></span>
      <div class="reserva-info">
        <div class="reserva-title">${icon} ${label} — ${r.Descripcion}</div>
        <div class="reserva-detail">Prof. ${r.ProfesorNombre} · ${r.Pista} · ${r.Horario}</div>
        ${terceroBadge}
      </div>
      <div class="reserva-date">${formatFechaSola(r.Fecha)}</div>
      <button class="btn-cancelar-reserva" data-id="${r.id}" title="Cancelar reserva">Cancelar</button>
    </div>`;
}

/* ============================================================
   DEPORTES (vista pública)
   ============================================================ */
/**
 * Renderiza la vista completa de deportes en la pagina principal
 * @returns {Promise<void>} No devuelve valor; actualiza el DOM directamente.
 */
async function renderDeportes() {

  const grid = document.getElementById('deportes-grid');
  const profesores = await DB.Profesor.listarTodos();
  const clases = await DB.Clases.listarTodas();
   // Si no hay deportes configurados en DEPORTES_CONFIG,  
  if (Object.keys(DEPORTES_CONFIG).length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No hay deportes configurados todavía.</div>';
    return;
  }
// Recorremos cada deporte configurado y se genera su tarjeta con todos sus datos
  grid.innerHTML = Object.entries(DEPORTES_CONFIG).map(([key, cfg]) => {
    //Filtrar profesores y clases de cada deporte
    const profs = profesores.filter(p => p.Especialidad === key);
    const clasesDeporte = clases.filter(c => c.Deporte === key);
//Construccion de cada html para profesores 
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
//De cada deporte
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

  //Selector de titular (yo / tercero)
  const panelTercero = document.getElementById('panel-tercero');

  // Clonar para limpiar listeners previos
  const nuevoSelectTitular = clonarElemento('reserva-titular');
  // Panel siempre oculto al entrar en la página
  toggle(panelTercero, false);
  nuevoSelectTitular.value = 'yo';

  nuevoSelectTitular.addEventListener('change', () => {
    const esTercero = nuevoSelectTitular.value === 'tercero';
    toggle(panelTercero, esTercero);
    // Limpia los campos al ocultar el panel y recarga las clases con la edad del usuario
    if (!esTercero) {
      ['tercero-nombre', 'tercero-edad', 'tercero-telefono', 'tercero-alergias', 'tercero-dni']
        .forEach(id => { document.getElementById(id).value = ''; });
    }
    // Refrescar clases según quién es el titular (usuario o tercero sin edad aún)
    nuevoSelect.dispatchEvent(new Event('change'));
  });

  // Cuando cambia la edad del tercero, recalcular las clases disponibles para su categoría
  document.getElementById('tercero-edad').addEventListener('input', () => {
    if (nuevoSelectTitular.value === 'tercero' && nuevoSelect.value) {
      nuevoSelect.dispatchEvent(new Event('change'));
    }
  });
  // Listener: al cambiar deporte, cargar sus clases.
  // Clonamos el nodo para eliminar listeners previos y evitar duplicados
  const nuevoSelect = clonarElemento('reserva-deporte');
// Si el deporte cambia carga las clases del mismo
  nuevoSelect.addEventListener('change', async () => {
    const deporte = nuevoSelect.value;
    const selectClase = document.getElementById('reserva-clase');
    selectClase.innerHTML = '';
// Muestra el mensaje en caso de no elegir deporte y resetea los límites de fecha
    if (!deporte) {




      return;
    }
// Resetea los límites del input de fecha al deseleccionar deporte
    const clases = await DB.Clases.listarPorDeporte(deporte);
    if (clases.length === 0) {
      selectClase.innerHTML = '<option value="">Sin clases disponibles</option>';
      return;
    }

    // Determinar la edad a usar para filtrar categorías
    // Si el titular es un tercero y ya introdujo su edad, se usa esa; si no, la del usuario
    const esTercero = document.getElementById('reserva-titular').value === 'tercero';
    const edadTerceroInput = Number(document.getElementById('tercero-edad').value);
    const usarEdadTercero = esTercero && edadTerceroInput >= 1 && edadTerceroInput <= 120;

    const edadReferencia = usarEdadTercero ? edadTerceroInput : calcularEdad(usuario.F_Nacimiento);

    //Buscar categorías: primero específicas del deporte, si no hay usar globales
    const todasCats = await DB.Categoria.listarTodas();
    let categoriasDeporte = todasCats.filter(c => c.Deporte === deporte);
    if (categoriasDeporte.length === 0) {
      categoriasDeporte = todasCats.filter(c => !c.Deporte || c.Deporte === '');
    }

    //Categoría que corresponde a la edad de referencia
    const categoriaRef = categoriasDeporte.find(
      cat => edadReferencia >= cat.EdadMin && edadReferencia <= cat.EdadMax
    );

    //Texto orientativo para mensajes de error
    const quienLabel = usarEdadTercero
      ? `el invitado (${edadReferencia} años)`
      : `tu edad (${edadReferencia} años)`;

    // Filtrar clases por categoría
    const clasesFiltradas = categoriasDeporte.length === 0
      ? clases  // sin categorías definidas → mostrar todas
      : clases.filter(c => {
        if (!c.Categoria) return false;
        if (!categoriaRef) return false;
        return c.Categoria === categoriaRef.id;
      });

    if (clasesFiltradas.length === 0) {
      selectClase.innerHTML = categoriaRef
        ? `<option value="">Sin clases para la categoría ${categoriaRef.Nombre} (${edadReferencia} años)</option>`
        : `<option value="">No hay categoría para ${quienLabel}</option>`;
      return;
    }
    // Añade las clases al selector
    for (const c of clasesFiltradas) {
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
      const fechaMin = sub.Fecha_Inicio > hoyStr ? sub.Fecha_Inicio : hoyStr;
      fechaInput.value = fechaMin;
    }
  });
  // Botón reservar — clonar para evitar listeners duplicados
  clonarElemento('btn-hacer-reserva').addEventListener('click', hacerReserva);
  // Renderiza el historial de reservas
  await renderHistorialReservas();
}

/**
 * Función que valida y crea una reserva de la clase.
 * Soporta reservas para el propio usuario o para una tercera persona.
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

  // ---- Datos del tercero ----
  const esTercero = document.getElementById('reserva-titular').value === 'tercero';
  let tercero = null;
  /**
   * creamos a la otra persona por si el usuario quiere añadir a un familiar 
   */
  if (esTercero) {
    const tNombre = document.getElementById('tercero-nombre').value.trim();
    const tEdad = document.getElementById('tercero-edad').value.trim();
    const tTelefono = document.getElementById('tercero-telefono').value.trim();
    const tAlergias = document.getElementById('tercero-alergias').value.trim();
    const tDNI = document.getElementById('tercero-dni').value.trim();

    if (!tNombre || tNombre.length < 3) {
      msgErr.textContent = 'El nombre del invitado debe tener al menos 3 caracteres.';
      toggle(msgErr, true); return;
    }
    if (!tEdad || isNaN(tEdad) || Number(tEdad) < 1 || Number(tEdad) > 120) {
      msgErr.textContent = 'Introduce una edad válida para el invitado (1-120).';
      toggle(msgErr, true); return;
    }
    if (!tTelefono || !/^\+?[\d\s\-]{7,15}$/.test(tTelefono)) {
      msgErr.textContent = 'Introduce un número de teléfono válido para el invitado.';
      toggle(msgErr, true); return;
    }
    if (!tAlergias) {
      msgErr.textContent = 'Indica las alergias del invitado (escribe "Ninguna" si no tiene).';
      toggle(msgErr, true); return;
    }
    if (tDNI && !/^[0-9]{8}[A-Za-z]$/.test(tDNI)) {
      msgErr.textContent = 'El DNI del invitado no tiene un formato válido (ej: 12345678A).';
      toggle(msgErr, true); return;
    }
    /**
     * campos de la otra persona 
     */
    tercero = {
      Nombre: tNombre,
      Edad: tEdad,
      Telefono: tTelefono,
      Alergias: tAlergias,
      DNI: tDNI || null,
    };
  }
  // Crea la reserva; en caso de error lo muestra
  const resultado = await DB.Reserva.crear({ US_DNI: usuario.US_DNI, Clase_ID, Fecha, tercero });

  if (!resultado.ok) {
    msgErr.textContent = resultado.error;
    toggle(msgErr, true);
    return;
  }

  const para = esTercero ? ` para ${tercero.Nombre}` : '';
  // Mensaje de corroboración y actualización del dashboard
  msgOk.textContent = `¡Reserva realizada correctamente${para} para el ${formatFechaSola(Fecha)}!`;
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

/* ============================================================
   HORARIOS
   ============================================================ */
//Creación de array con los dias de la semana
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

/**
 * Construye el mapa dia->hora->clases a partir de una lista de clases y profesores.
 * @param {Array} clases - Lista de clases a procesar.
 * @param {Array} profesores - Lista de profesores para resolver nombres (solo admin).
 * @param {boolean} buscarProf - Si true usa DB.Profesor.buscarPorDNI; si false busca en el array local.
 * @returns {Promise<{mapa: object, horas: string[]}>}
 */
async function construirMapaHorario(clases, profesores = [], buscarProf = false) {
  // Recopilar todas las horas únicas ordenadas
  const horasSet = new Set();
  clases.forEach(c => {
    const match = c.Horario.match(/(\d{1,2}:\d{2})/g);
    if (match) horasSet.add(match[0]);
  });
  const horas = [...horasSet].sort();

  // Construir mapa dia->hora->clases
  const mapa = {};
  DIAS_SEMANA.forEach(d => { mapa[d] = {}; horas.forEach(h => { mapa[d][h] = []; }); });
  //Rellenamos el horario
  for (const c of clases) {
    const cfg = DEPORTES_CONFIG[c.Deporte] || {};
    const prof = buscarProf
      ? (c.PRO_DNI ? await DB.Profesor.buscarPorDNI(c.PRO_DNI) : null)
      : profesores.find(p => p.PRO_DNI === c.PRO_DNI);
    const horarioUpper = c.Horario.toUpperCase();
    DIAS_SEMANA.forEach(dia => {
      const diaAbrev = dia.substring(0, 3).toUpperCase();
      const diaAlt = dia === 'Miercoles' ? 'MIE' : diaAbrev;
      if (horarioUpper.includes(diaAbrev) || horarioUpper.includes(diaAlt) || horarioUpper.includes(dia.toUpperCase())) {
        const match = c.Horario.match(/(\d{1,2}:\d{2})/g);
        const hora = match ? match[0] : null;
        if (hora && mapa[dia][hora] !== undefined) {
          mapa[dia][hora].push({ ...c, cfg, profNombre: prof ? prof.Nombre : null });
        }
      }
    });
  }
  return { mapa, horas };
}

/**
 * Genera el HTML de la tabla de horario semanal.
 * @param {object} mapa - Mapa dia->hora->clases generado por construirMapaHorario.
 * @param {string[]} horas - Lista de horas ordenadas.
 * @param {boolean} conBotonEditar - Si true incluye el botón de editar en cada pill (panel admin).
 * @param {string} msgVacio - Mensaje cuando no hay clases.
 * @returns {string} - HTML de la tabla lista para insertar en el DOM.
 */
function generarTablaHorarioHTML(mapa, horas, conBotonEditar = false, msgVacio = 'No hay clases para mostrar.') {
  if (horas.length === 0) return `<div class="empty-state">${msgVacio}</div>`;
  return `
    <div class="horario-scroll">
      <table class="horario-table">
        <thead>
          <tr>
            <th class="hora-col">Hora</th>
            ${DIAS_SEMANA.map(d => `<th>${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${horas.map(hora => `
            <tr>
              <td class="hora-cell">${hora}</td>
              ${DIAS_SEMANA.map(dia => {
    const items = mapa[dia][hora];
    if (!items || items.length === 0) return '<td class="celda-vacia"></td>';
    return `<td class="celda-clase">
                ${items.map(it => `
                  <div class="horario-pill" style="background:${it.cfg.color || '#888'}22;border-left:3px solid ${it.cfg.color || '#888'}">
                    <span class="pill-deporte" style="color:${it.cfg.color || '#888'}">${it.cfg.icon || ''} ${it.cfg.label || it.Deporte}</span>
                    <span class="pill-desc">${it.Descripcion}</span>
                    ${it.Pista ? `<span class="pill-pista">📍 ${it.Pista}</span>` : ''}
                    ${it.profNombre ? `<span class="pill-prof">👤 ${it.profNombre}</span>` : ''}
                    ${conBotonEditar ? `<button class="pill-edit-btn btn-ghost btn-sm" data-id="${it.id}">✏️ Editar</button>` : ''}
                  </div>`).join('')}
              </td>`;
  }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
/**
 * Renderizado completo de los horarios
 */
async function renderHorarios() {
  //Carga de configuración de los deportes
  await cargarDeportesConfig();
  //Obencion de usuario actual, todas las clases de la base de datos
  const usuario = await Auth.usuarioActual();
  const todasClases = await DB.Clases.listarTodas();
  //Recoger el array con todas los deportes de la base de datos y convertirlos en una lista clave valor
  const deportesList = Object.entries(DEPORTES_CONFIG);

  //Creación de elementos para insertar filtros y tabla de horarios
  const filtrosEl = document.getElementById('horarios-filtros');
  const tablaEl = document.getElementById('horarios-tabla');

  // Filtro por deporte
  filtrosEl.innerHTML = `
    <div class="field" style="max-width:220px">
      <label>Filtrar por deporte</label>
      <select id="horario-filtro-deporte">
        <option value="">Todos los deportes</option>
        ${deportesList.map(([key, cfg]) => `<option value="${key}">${cfg.icon} ${cfg.label}</option>`).join('')}
      </select>
    </div>`;
/**
 * Renderiza la tabla de horarios según el deporte seleccionado.
 * @param {string} filtroDeporte - Clave del deporte a filtrar; si está vacío, muestra todos.
 * @returns {Promise<void>} No devuelve valor; actualiza el DOM directamente.
 */
  const renderTabla = async (filtroDeporte) => {
    //Si hay filtro se muestra solo las clases del deporte seleccionado
    const clases = filtroDeporte
      ? todasClases.filter(c => c.Deporte === filtroDeporte)
      : todasClases;
//Si no hay clases se muestra el array y ordenamos las horas
    if (clases.length === 0) {
      tablaEl.innerHTML = '<div class="empty-state">No hay clases para mostrar.</div>';
      return;
    }
    const { mapa, horas } = await construirMapaHorario(clases, [], true);
    tablaEl.innerHTML = generarTablaHorarioHTML(mapa, horas);
  };
//Inicialización sin filtros
  await renderTabla('');

  document.getElementById('horario-filtro-deporte').addEventListener('change', async (e) => {
    await renderTabla(e.target.value);
  });
}
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

  // Calcular edad del usuario una sola vez
  const edadUsuario = calcularEdad(usuario.F_Nacimiento);

  // Cargar categorías de todos los deportes en paralelo
  const categoriasPorDeporte = await Promise.all(
    deportesList.map(([key]) => DB.Categoria.listarPorDeporte(key))
  );

  // Determinar si el usuario puede suscribirse a cada deporte
  const puedeContratar = deportesList.map(([,], i) => {
    const cats = categoriasPorDeporte[i];
    if (cats.length === 0) return true; // Sin restricción de edad
    return cats.some(cat => edadUsuario >= cat.EdadMin && edadUsuario <= cat.EdadMax);
  });

  // Encontrar la categoría del usuario para cada deporte
  const categoriaUsuario = deportesList.map(([,], i) => {
    const cats = categoriasPorDeporte[i];
    return cats.find(cat => edadUsuario >= cat.EdadMin && edadUsuario <= cat.EdadMax) || null;
  });
  // Genera las tarjetas de planes
  container.innerHTML = deportesList.map(([key, cfg], i) => {
    const yaActivo = activosPorDeporte[i];
    const puede = puedeContratar[i];
    const cats = categoriasPorDeporte[i];
    const catUsuario = categoriaUsuario[i];

    // Construir el bloque de info de edad
    let edadInfoHTML = '';
    if (cats.length > 0) {
      if (catUsuario) {
        edadInfoHTML = `
          <div class="plan-edad-info plan-edad-ok">
            ✅ Tu categoría: <strong>${catUsuario.Nombre}</strong>
            <span style="opacity:0.7">(${catUsuario.EdadMin}–${catUsuario.EdadMax} años)</span>
          </div>`;
      } else {
        const rangos = cats.map(c => `${c.Nombre}: ${c.EdadMin}–${c.EdadMax} años`).join(' · ');
        edadInfoHTML = `
          <div class="plan-edad-info plan-edad-error">
            ⛔ Tu edad (${edadUsuario} años) no está en ninguna categoría
            <div style="font-size:11px;margin-top:3px;opacity:0.75">${rangos}</div>
          </div>`;
      }
    }

    return `
      <div class="plan-card ${yaActivo ? 'plan-card--suscrito' : ''} ${!puede && !yaActivo ? 'plan-card--bloqueado' : ''}" style="--sport-color:${cfg.color}" data-deporte="${key}">
        ${yaActivo ? `<div class="plan-badge-suscrito">✓ SUSCRITO</div>` : ''}
        ${!puede && !yaActivo ? `<div class="plan-badge-bloqueado">⛔ SIN ACCESO</div>` : ''}
        <div class="plan-sport-name"><span>${cfg.icon}</span> ${cfg.label}</div>
        ${edadInfoHTML}
        <div class="plan-options ${yaActivo || !puede ? 'plan-options--disabled' : ''}">
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
        : puede
          ? `<button class="btn-contratar full" data-deporte="${key}" style="--btn-color:${cfg.color}">Suscribirse a ${cfg.label}</button>`
          : `<button class="btn-contratar full btn-contratar--bloqueado" disabled data-deporte="${key}" title="Tu edad (${edadUsuario} años) no cumple los requisitos de ninguna categoría">
                 ⛔ No cumples los requisitos de edad
               </button>`
      }
      </div>`;
  }).join('');
  // Permite al usuario seleccionar la modalidad
  container.querySelectorAll('.plan-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const deporte = opt.dataset.deporte;
      const card = container.querySelector(`.plan-card[data-deporte="${deporte}"]`);
      if (card.classList.contains('plan-card--suscrito') || card.classList.contains('plan-card--bloqueado')) return;
      container.querySelectorAll(`.plan-option[data-deporte="${deporte}"]`)
        .forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
  // Contratar suscripción
  container.querySelectorAll('.btn-contratar:not([disabled])').forEach(btn => {
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
        const categoriaValida = categoriasDeporte.some(
          cat => edadUsuario >= cat.EdadMin && edadUsuario <= cat.EdadMax
        );

        if (!categoriaValida) {
          const rangos = categoriasDeporte
            .map(cat => `${cat.Nombre} (${cat.EdadMin}–${cat.EdadMax} años)`)
            .join(', ');
          btn.disabled = false;
          btn.textContent = `Suscribirse a ${cfg.label}`;
          btn.style.opacity = '';
          mostrarToast(
            `No puedes suscribirte a ${cfg.label}. Tu edad (${edadUsuario} años) no encaja en ninguna categoría: ${rangos}.`,
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
// Listener para cerrar el modal cuando el usuario pulsa cancelar o la "X"
['btn-cancel-modal', 'close-modal-cancelar'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    toggle(document.getElementById('modal-cancelar'), false);
    // Reset de variable
    _cancelarSubId = null;
  });
});

/* ============================================================
   PERFIL
   ============================================================ */

/**
 * Convierte un File de imagen a base64 data-URL para previsualización local.
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileADataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza el contenido del modal de perfil con las opciones de edición de foto,
 * nombre y fecha de nacimiento.
 * @param {Object} usuario - Datos del usuario actual.
 * @param {Array} activas - Lista de suscripciones activas del usuario.
 */
function renderizarPerfil(usuario, activas) {
  const rolBadge = usuario.Rol === 'admin'
    ? `<span style="background:rgba(232,255,71,0.15);border:1px solid rgba(232,255,71,0.4);color:var(--clr-accent);
                    font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;letter-spacing:.5px">ADMIN</span>`
    : '';

  // Avatar: foto si existe, si no iniciales
  const avatarContent = usuario.FotoURL
    ? `<img src="${usuario.FotoURL}" alt="Foto de perfil"
            style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : iniciales(usuario.Nombre);

  // Rellena el perfil con los datos del usuario e incluye controles de edición
  document.getElementById('perfil-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
      <!-- Avatar clicable para cambiar foto -->
      <div id="perfil-avatar-wrap" title="Cambiar foto de perfil"
           style="position:relative;width:56px;height:56px;flex-shrink:0;cursor:pointer">
        <div id="perfil-avatar" style="width:56px;height:56px;border-radius:50%;
                    background:rgba(232,255,71,0.1);border:1px solid rgba(232,255,71,0.3);
                    display:flex;align-items:center;justify-content:center;
                    font-family:var(--font-display);font-size:20px;font-weight:700;
                    color:var(--clr-accent);overflow:hidden">
          ${avatarContent}
        </div>
        <!-- Overlay de cámara al hacer hover -->
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.55);
                    display:flex;align-items:center;justify-content:center;opacity:0;
                    transition:opacity .2s;pointer-events:none" id="perfil-avatar-overlay">
          <span style="font-size:18px">📷</span>
        </div>
        <!-- Input oculto de fichero -->
        <input type="file" id="perfil-foto-input" accept="image/*"
               style="position:absolute;inset:0;opacity:0;cursor:pointer;border-radius:50%">
      </div>
      <div>
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;
                    display:flex;align-items:center;gap:8px">
          ${usuario.Nombre} ${rolBadge}
        </div>
        <div style="font-size:12px;color:var(--clr-muted)">${usuario.Correo}</div>
      </div>
    </div>

    <!-- Mensaje de estado para guardar cambios -->
    <div id="perfil-msg" class="msg-success hidden" style="margin-bottom:1rem"></div>
    <div id="perfil-err" class="msg-error hidden" style="margin-bottom:1rem"></div>

    <div class="perfil-field">
      <div class="perfil-label">DNI</div>
      <div class="perfil-value">${usuario.US_DNI}</div>
    </div>

    <!-- Nombre editable -->
    <div class="perfil-field" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div class="perfil-label">Nombre</div>
      <div style="display:flex;gap:8px;width:100%;align-items:center">
        <input id="perfil-nombre-input" type="text" value="${usuario.Nombre}"
               style="flex:1;background:var(--clr-surface2);border:1px solid var(--clr-border);
                      border-radius:8px;padding:7px 12px;color:var(--clr-text);font-size:14px;
                      font-family:var(--font-body);outline:none"
               placeholder="Nombre completo">
      </div>
    </div>

    <!-- Fecha de nacimiento editable -->
    <div class="perfil-field" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div class="perfil-label">Fecha de nacimiento</div>
      <input id="perfil-fnac-input" type="date" value="${usuario.F_Nacimiento || ''}"
             style="background:var(--clr-surface2);border:1px solid var(--clr-border);
                    border-radius:8px;padding:7px 12px;color:var(--clr-text);font-size:14px;
                    font-family:var(--font-body);outline:none;width:100%;box-sizing:border-box"
             max="${new Date().toISOString().split('T')[0]}">
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

    <!-- Botón guardar cambios -->
    <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--clr-border)">
      <button id="btn-guardar-perfil" class="btn-primary" style="width:100%;margin-bottom:0.75rem">
        💾 Guardar cambios
      </button>
      <button id="btn-abrir-eliminar-cuenta" class="btn-danger" style="width:100%">
        🗑 Eliminar mi cuenta
      </button>
    </div>`;

  // Muestra overlay de cámara al pasar el ratón sobre el avatar
  const avatarWrap = document.getElementById('perfil-avatar-wrap');
  const overlay = document.getElementById('perfil-avatar-overlay');
  avatarWrap.addEventListener('mouseenter', () => overlay.style.opacity = '1');
  avatarWrap.addEventListener('mouseleave', () => overlay.style.opacity = '0');

  // Cuando el usuario selecciona una imagen, se previsualiza inmediatamente en el avatar
  document.getElementById('perfil-foto-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Comprueba que el fichero sea una imagen y no supere 2 MB
    if (!file.type.startsWith('image/')) {
      document.getElementById('perfil-err').textContent = 'Solo se admiten imágenes.';
      document.getElementById('perfil-err').classList.remove('hidden');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      document.getElementById('perfil-err').textContent = 'La imagen no debe superar 2 MB.';
      document.getElementById('perfil-err').classList.remove('hidden');
      return;
    }
    document.getElementById('perfil-err').classList.add('hidden');
    // Convierte a data-URL y muestra como previsualización en el avatar
    const dataUrl = await fileADataURL(file);
    document.getElementById('perfil-avatar').innerHTML =
      `<img src="${dataUrl}" alt="Foto de perfil"
            style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    // Guarda en memoria para usarla al guardar
    avatarWrap._pendingFotoURL = dataUrl;
  });

  // Listener del botón "Guardar cambios": actualiza nombre, fecha y foto en Firestore
  document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-perfil');
    const msgOk = document.getElementById('perfil-msg');
    const msgErr = document.getElementById('perfil-err');
    msgOk.classList.add('hidden');
    msgErr.classList.add('hidden');

    const nuevoNombre = document.getElementById('perfil-nombre-input').value.trim();
    const nuevaFnac = document.getElementById('perfil-fnac-input').value;
    const nuevaFoto = document.getElementById('perfil-avatar-wrap')._pendingFotoURL || null;

    // Validaciones básicas
    if (!nuevoNombre || nuevoNombre.length < 3) {
      msgErr.textContent = 'El nombre debe tener al menos 3 caracteres.';
      msgErr.classList.remove('hidden');
      return;
    }
    if (!nuevaFnac) {
      msgErr.textContent = 'La fecha de nacimiento no puede estar vacía.';
      msgErr.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
      // Construye el objeto de actualización sólo con los campos que cambian
      const datosActualizar = { Nombre: nuevoNombre, F_Nacimiento: nuevaFnac };
      if (nuevaFoto) datosActualizar.FotoURL = nuevaFoto;

      await DB.Usuario.actualizar(usuario.US_DNI, datosActualizar);

      // Actualiza la UI del navbar con el nuevo nombre e iniciales / foto
      document.getElementById('nav-username').textContent = nuevoNombre;
      const avatarNavEl = document.getElementById('avatar-initials');
      if (nuevaFoto) {
        avatarNavEl.innerHTML = `<img src="${nuevaFoto}" alt="Avatar"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        avatarNavEl.textContent = iniciales(nuevoNombre);
      }

      msgOk.textContent = '✓ Cambios guardados correctamente.';
      msgOk.classList.remove('hidden');
    } catch (err) {
      msgErr.textContent = 'Error al guardar los cambios. Inténtalo de nuevo.';
      msgErr.classList.remove('hidden');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Guardar cambios';
    }
  });

  // Listener del botón "Eliminar mi cuenta" (se re-registra cada vez que se abre el perfil)
  document.getElementById('btn-abrir-eliminar-cuenta').addEventListener('click', () => {
    toggle(document.getElementById('modal-perfil'), false);
    toggle(document.getElementById('modal-eliminar-cuenta'), true);
  });
}

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

  // Renderiza el contenido del modal con los datos del usuario
  renderizarPerfil(usuario, activas);

  // Muestra el perfil
  toggle(document.getElementById('modal-perfil'), true);
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

document.getElementById('btn-logout').addEventListener('click', () => {
  Auth.cerrarSesion();
  location.reload();
});

/* ============================================================
   ELIMINAR CUENTA
   ============================================================ */
// Listener para cerrar la sesion del usuario y recargar la página borrando la sesión anterior
['close-modal-eliminar-cuenta', 'btn-cancel-eliminar-cuenta'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    toggle(document.getElementById('modal-eliminar-cuenta'), false);
  });
});
//Boton eliminar cuenta
document.getElementById('modal-eliminar-cuenta').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) toggle(e.currentTarget, false);
});
//Boton para confirmar el borrado de la cuenta
document.getElementById('btn-confirm-eliminar-cuenta').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-eliminar-cuenta');
  btn.disabled = true;
  btn.textContent = 'Eliminando…';
//Recoge el eliminado y lo sincroniza con l abase de datos
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
  //Creación de las label para la edición 
  const tabsList = [
    { id: 'deportes', label: '🏅 Deportes' },
    { id: 'categorias', label: '🏷️ Categorías' },
    { id: 'profesores', label: '👨‍🏫 Profesores' },
    { id: 'clases', label: '📅 Clases' },
    { id: 'horarios', label: '🗓️ Horarios' },
  ];
//Genera dinamicamente los botones HTML de cada pestaña y la marca como activa si coincide 
  tabs.innerHTML = tabsList.map(t => `
    <button class="admin-tab ${adminState.tabActual === t.id ? 'active' : ''}" data-tab="${t.id}">
      ${t.label}
    </button>`).join('');
//Selecciona todos los botones creados y les añade un listener con el id de la pestaña 
  tabs.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
  });
}
/**
 * Cambia la pestaña activa del panel admin y renderiza su contenido
 * @param {string} tab Identificador de la pestaña a mostrar
 */
async function switchAdminTab(tab) {
  //Actualiza la pestaña activa del panel administración y renderiza con la pagina
  adminState.tabActual = tab;
  renderAdminTabs();
  //Crea mensaje de cargando en la web y selecciona el contenido de la pestañ
  const content = document.getElementById('admin-content');
  content.innerHTML = '<div class="admin-loading">Cargando…</div>';
//Selecciona la funcion de render de la pagina que seleccione el admin
  switch (tab) {
    case 'deportes': await renderAdminDeportes(); break;
    case 'categorias': await renderAdminCategorias(); break;
    case 'profesores': await renderAdminProfesores(); break;
    case 'clases': await renderAdminClases(); break;
    case 'horarios': await renderAdminHorarios(); break;
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
//Añade un listener al boton para crear nuevo depore
  document.getElementById('btn-nuevo-deporte').addEventListener('click', () => {
    mostrarFormDeporte(null);
  });
//Botones de edición de deporte 
  content.querySelectorAll('.btn-edit-deporte').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dep = await DB.Deporte.buscarPorId(btn.dataset.id);
      mostrarFormDeporte(dep);
    });
  });
//Botones de eliminación de deporte 
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
//Busca el boton de cancelar y le añade un listener para ocultar el formulario 
  document.getElementById('btn-cancelar-form-deporte').addEventListener('click', () => {
    formEl.classList.add('hidden');
  });

//Guarda el click del boton y realiza la validación
  document.getElementById('btn-guardar-deporte').addEventListener('click', async () => {
    // Resetear errores y bloquear el botón mientras se procesa
    const btn = document.getElementById('btn-guardar-deporte');
    const errEl = document.getElementById('form-dep-error');
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Guardando…';
// Recoger datos del formulario
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
    // Crear o actualizar según el modo
    if (esNuevo) {
      const nombre = document.getElementById('dep-nombre').value.trim();
      if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Crear deporte'; return; }
      resultado = await DB.Deporte.crear({ Nombre: nombre, ...datos });
    } else {
      resultado = await DB.Deporte.actualizar(dep.id, datos);
    }
// Restaurar botón
    btn.disabled = false; btn.textContent = esNuevo ? 'Crear deporte' : 'Guardar cambios';
 // Mostrar error si la BD falló
    if (!resultado.ok) {
      errEl.textContent = resultado.error;
      errEl.classList.remove('hidden');
      return;
    }
//SI el resultado esta bien muestra mensaje de confirmación y reccarga la lista 
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
  // Preparar el modal y mensaje de advertencia
  abrirModalAdminEliminar(
    `⚠️ ¿Eliminar el deporte <strong>${nombre}</strong>?<br>
     <span style="font-size:13px;color:var(--clr-muted)">Se eliminarán en cascada todas sus categorías, clases, reservas de esas clases y suscripciones activas.</span>`,
    async () => {
      // Eliminar el deporte y todos sus datos asociados
      await DB.Deporte.eliminar(id);
      // Recargar configuración y cerrar modal
      await cargarDeportesConfig();
      // Notificación de éxito y refrescar la lista
      mostrarToast(`Deporte "${nombre}" eliminado con todos sus datos.`, 'success');
      await renderAdminDeportes();
    }
  );
}

/* --- ADMIN: CATEGORÍAS --- */
/**
 * Renderiza la tabla de categorías en el panel admin con opciones de crear, editar y eliminar
 */
async function renderAdminCategorias() {
  // Contenedor principal donde se mostrará la sección
  const content = document.getElementById('admin-content');
  //Aegura la configuración 
  await cargarDeportesConfig();
  //COnvierte la configuración en lista y obtener todas las categorias
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
// Botón para crear una nueva categoría
  document.getElementById('btn-nueva-categoria').addEventListener('click', () => {
    mostrarFormCategoria(null, deportesList);
  });
// Botones de edición
  content.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const snap = await firebase.firestore().collection('Categoria').doc(btn.dataset.id).get();
      if (snap.exists) mostrarFormCategoria({ id: snap.id, ...snap.data() }, deportesList);
    });
  });
 // Botones de eliminación
  content.querySelectorAll('.btn-del-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      // Mensaje del modal
      abrirModalAdminEliminar(
        `¿Eliminar la categoría <strong>${btn.dataset.nombre}</strong>?`,
        async () => {
          // Acción al confirmar la eliminación
          await DB.Categoria.eliminar(btn.dataset.id);
          mostrarToast('Categoría eliminada.', 'success');
          await renderAdminCategorias();
          await renderSidebarCategorias();
        }
      );
    });
  });
}
/**
 * Muestra el formulario inline para crear o editar una categoría.
 * En modo creación permite buscar y seleccionar varios deportes a la vez.
 * @param {object|null} cat Categoría a editar, o null para crear una nueva
 * @param {Array} deportesList Lista de deportes disponibles para el selector
 */
function mostrarFormCategoria(cat, deportesList) {
  //Recoge la categoria o la crea en caso de ser necesario
  const formEl = document.getElementById('form-categoria');
  const esNuevo = !cat;

  // En modo edición se mantiene el select simple de un único deporte.
  // En modo creación se muestra el buscador con checkboxes para selección múltiple.
  const selectorDeporteHTML = esNuevo
    ? `<div class="field cat-deporte-field" style="grid-column:1/-1">
        <label>Deportes <span style="color:var(--clr-muted);font-weight:400;font-size:11px">(selecciona uno o varios)</span></label>
        <div class="cat-deporte-buscador">
          <input
            type="text"
            id="cat-deporte-buscar"
            class="cat-deporte-buscar-input"
            placeholder="Escribe para filtrar deportes…"
            autocomplete="off"
          />
          <div class="cat-deporte-lista" id="cat-deporte-lista">
            ${deportesList.map(([key, cfg]) => `
              <label class="cat-deporte-opcion" data-key="${key}" data-label="${cfg.label.toLowerCase()}">
                <input type="checkbox" class="cat-deporte-check" value="${key}" />
                <span class="cat-deporte-opcion-icon">${cfg.icon}</span>
                <span class="cat-deporte-opcion-nombre">${cfg.label}</span>
              </label>`).join('')}
          </div>
          <div class="cat-deporte-seleccionados" id="cat-deporte-seleccionados">
            <span style="color:var(--clr-muted);font-size:12px">Ningún deporte seleccionado</span>
          </div>
        </div>
      </div>`
    : `<div class="field">
        <label>Deporte</label>
        <select id="cat-deporte">
          ${deportesList.map(([key, cfg]) => `<option value="${key}" ${cat?.Deporte === key ? 'selected' : ''}>${cfg.icon} ${cfg.label}</option>`).join('')}
        </select>
      </div>`;

  formEl.innerHTML = `
    <div class="admin-form-inner">
      <h4>${esNuevo ? 'Nueva categoría' : 'Editar: ' + cat.Nombre}</h4>
      <div class="admin-form-grid">
        <div class="field"><label>Nombre</label><input id="cat-nombre" type="text" placeholder="Ej: Alevín" value="${cat?.Nombre || ''}" /></div>
        ${selectorDeporteHTML}
        <div class="field"><label>Edad mínima</label><input id="cat-edad-min" type="number" min="0" max="99" value="${cat?.EdadMin ?? 0}" /></div>
        <div class="field"><label>Edad máxima</label><input id="cat-edad-max" type="number" min="0" max="99" value="${cat?.EdadMax ?? 18}" /></div>
      </div>
      <div id="form-cat-error" class="msg-error hidden"></div>
      <div class="admin-form-actions">
        <button class="btn-primary" id="btn-guardar-cat">${esNuevo ? 'Crear categoría' : 'Guardar cambios'}</button>
        <button class="btn-ghost" id="btn-cancelar-form-cat">Cancelar</button>
      </div>
    </div>`;

  //Mostrar el formulario
  formEl.classList.remove('hidden');

  // Lógica del buscador + checkboxes (solo en modo creación)
  if (esNuevo) {
    const inputBuscar = document.getElementById('cat-deporte-buscar');
    const listaEl = document.getElementById('cat-deporte-lista');
    const seleccionadosEl = document.getElementById('cat-deporte-seleccionados');

    // Filtra las opciones visibles según el texto escrito en el buscador
    inputBuscar.addEventListener('input', () => {
      const filtro = inputBuscar.value.toLowerCase().trim();
      listaEl.querySelectorAll('.cat-deporte-opcion').forEach(opcion => {
        const coincide = opcion.dataset.label.includes(filtro);
        opcion.style.display = coincide ? '' : 'none';
      });
    });

    // Actualiza el resumen de deportes seleccionados cuando cambia un checkbox
    listaEl.addEventListener('change', () => {
      const checks = [...listaEl.querySelectorAll('.cat-deporte-check:checked')];
      if (checks.length === 0) {
        seleccionadosEl.innerHTML = '<span style="color:var(--clr-muted);font-size:12px">Ningún deporte seleccionado</span>';
      } else {
        seleccionadosEl.innerHTML = checks.map(ch => {
          const cfg = DEPORTES_CONFIG[ch.value] || {};
          return `<span class="cat-deporte-tag">${cfg.icon || ''} ${cfg.label || ch.value}</span>`;
        }).join('');
      }
    });
  }

  //Boton de cancelar formulario
  document.getElementById('btn-cancelar-form-cat').addEventListener('click', () => formEl.classList.add('hidden'));

  //Boton para guardar o actualizar categorias
  document.getElementById('btn-guardar-cat').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-cat');
    const errEl = document.getElementById('form-cat-error');
    errEl.classList.add('hidden');

    //Recoge los datos comunes del formulario
    const nombre = document.getElementById('cat-nombre').value.trim();
    const edadMin = parseInt(document.getElementById('cat-edad-min').value);
    const edadMax = parseInt(document.getElementById('cat-edad-max').value);

    //Validaciones comunes
    if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.remove('hidden'); return; }
    if (edadMin > edadMax) { errEl.textContent = 'La edad mínima no puede ser mayor que la máxima.'; errEl.classList.remove('hidden'); return; }

    if (esNuevo) {
      // Recoge los deportes seleccionados mediante checkboxes
      const deportesSeleccionados = [
        ...document.querySelectorAll('.cat-deporte-check:checked')
      ].map(ch => ch.value);

      if (deportesSeleccionados.length === 0) {
        errEl.textContent = 'Selecciona al menos un deporte.';
        errEl.classList.remove('hidden');
        return;
      }

      //Bloquear botón mientras guarda
      btn.disabled = true; btn.textContent = 'Guardando…';

      // Crea una categoría por cada deporte seleccionado
      let errores = [];
      for (const deporte of deportesSeleccionados) {
        const resultado = await DB.Categoria.crear({ Nombre: nombre, Deporte: deporte, EdadMin: edadMin, EdadMax: edadMax });
        if (!resultado.ok) errores.push(`${DEPORTES_CONFIG[deporte]?.label || deporte}: ${resultado.error}`);
      }

      btn.disabled = false; btn.textContent = 'Crear categoría';

      if (errores.length > 0) {
        errEl.textContent = 'Algunos deportes fallaron: ' + errores.join(' · ');
        errEl.classList.remove('hidden');
        return;
      }

      mostrarToast(
        deportesSeleccionados.length === 1
          ? '¡Categoría creada!'
          : `¡${deportesSeleccionados.length} categorías creadas!`,
        'success'
      );
    } else {
      // Modo edición: un único deporte
      const deporte = document.getElementById('cat-deporte').value;
      const datos = { Nombre: nombre, Deporte: deporte, EdadMin: edadMin, EdadMax: edadMax };

      //Bloquear botón mientras guarda
      btn.disabled = true; btn.textContent = 'Guardando…';

      const resultado = await DB.Categoria.actualizar(cat.id, datos);

      btn.disabled = false; btn.textContent = 'Guardar cambios';

      //Mostrar mensaje si falla la conexion con la base de datos
      if (!resultado.ok) { errEl.textContent = resultado.error; errEl.classList.remove('hidden'); return; }

      mostrarToast('¡Categoría actualizada!', 'success');
    }

    await renderAdminCategorias();
    await renderSidebarCategorias();
  });
}

/* --- ADMIN: PROFESORES --- */
/**
 * Renderiza la tabla de profesores en el panel admin con opciones de crear, editar y eliminar
 */
async function renderAdminProfesores() {
  //Variables para contener el contenido de la pagina, profesores y deportes
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
//Edición de profesores
  document.getElementById('btn-nuevo-profesor').addEventListener('click', () => {
    mostrarFormProfesor(null, deportesList);
  });
// Eliminar profesor 
  content.querySelectorAll('.btn-edit-prof').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prof = await DB.Profesor.buscarPorDNI(btn.dataset.dni);
      mostrarFormProfesor(prof, deportesList);
    });
  });
//Reset de boton de confirmación
  content.querySelectorAll('.btn-del-prof').forEach(btn => {
    btn.addEventListener('click', () => {
      // Acción al confirmar
      abrirModalAdminEliminar(
        `¿Eliminar al profesor <strong>${btn.dataset.nombre}</strong>?<br>
         <span style="font-size:13px;color:var(--clr-muted)">Sus clases quedarán sin profesor asignado.</span>`,
        async () => {
          await DB.Profesor.eliminar(btn.dataset.dni);
          mostrarToast(`Profesor "${btn.dataset.nombre}" eliminado.`, 'success');
          await renderAdminProfesores();
        }
      );
    });
  });
}
/**
 * Muestra el formulario para crear o editar un profesor.
 * @param {object|null} prof - Profesor existente (modo edición) o null (modo creación).
 * @param {Array} deportesList - Lista de deportes para el selector.
 */
function mostrarFormProfesor(prof, deportesList) {
  const formEl = document.getElementById('form-profesor');
  const esNuevo = !prof;
 // Renderizar el formulario dinámicamente
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
//Mostrar formulario
  formEl.classList.remove('hidden');
// Botón cancelar
  document.getElementById('btn-cancelar-form-prof').addEventListener('click', () => formEl.classList.add('hidden'));
// Botón modificaciónes y guardado del profesor
  document.getElementById('btn-guardar-prof').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-prof');
    const errEl = document.getElementById('form-prof-error');
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Guardando…';
 // Recoger datos del formulario
    const datos = {
      Nombre: document.getElementById('prof-nombre').value.trim(),
      Especialidad: document.getElementById('prof-especialidad').value,
      Email: document.getElementById('prof-email').value.trim(),
      Telefono: document.getElementById('prof-tel').value.trim(),
    };
// Validación del nombre
    if (!datos.Nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = esNuevo ? 'Crear profesor' : 'Guardar cambios'; return; }
 // Crear o actualizar según el estado
    let resultado;
    if (esNuevo) {
      const dni = document.getElementById('prof-dni').value.trim().toUpperCase();
      // Validación del DNI
      if (!/^[0-9]{8}[A-Za-z]$/.test(dni)) { errEl.textContent = 'DNI inválido (ej: 12345678A).'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Crear profesor'; return; }
      resultado = await DB.Profesor.crear({ PRO_DNI: dni, ...datos });
    } else {
      resultado = await DB.Profesor.actualizar(prof.PRO_DNI, datos);
    }
 // Restaurar botón
    btn.disabled = false; btn.textContent = esNuevo ? 'Crear profesor' : 'Guardar cambios';
// Mostrar error si la BD falló
    if (!resultado.ok) { errEl.textContent = resultado.error; errEl.classList.remove('hidden'); return; }

    mostrarToast(esNuevo ? '¡Profesor creado!' : '¡Profesor actualizado!', 'success');
    await renderAdminProfesores();
  });
}

/**
 * Renderiza la tabla de clases en el panel admin con opciones de crear, editar y eliminar
 */
async function renderAdminClases() {
  // Contenedor principal
  const content = document.getElementById('admin-content');
  //Cargar datos de clases, profesores, categorías y deportes desde la base de datos
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
// Crear clase
  document.getElementById('btn-nueva-clase').addEventListener('click', () => {
    mostrarFormClase(null, deportesList, profesores, categorias);
  });
  // Editar clase
  content.querySelectorAll('.btn-edit-clase').forEach(btn => {
    btn.addEventListener('click', async () => {
      const clase = await DB.Clases.buscarPorId(btn.dataset.id);
      mostrarFormClase(clase, deportesList, profesores, categorias);
    });
  });
// Eliminar clase
  content.querySelectorAll('.btn-del-clase').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirModalAdminEliminar(
        `¿Eliminar la clase <strong>${btn.dataset.desc}</strong>?<br>
         <span style="font-size:13px;color:var(--clr-muted)">Se eliminarán todas las reservas asociadas a esta clase.</span>`,
        async () => {
          await DB.Clases.eliminar(btn.dataset.id);
          mostrarToast('Clase y sus reservas eliminadas.', 'success');
          await renderAdminClases();
        }
      );
    });
  });
}
/**
 * Muestra el formulario para crear o editar una clase.
 * @param {object|null} clase - Clase existente (modo edición) o null (modo creación).
 * @param {Array} deportesList - Lista de deportes disponibles.
 * @param {Array} profesores - Lista completa de profesores.
 * @param {Array} categorias - Lista completa de categorías.
 */
function mostrarFormClase(clase, deportesList, profesores, categorias) {
  // Si no hay clase pasa a creación
  const formEl = document.getElementById('form-clase');
  const esNuevo = !clase;

 // Funciones auxiliares para filtrar profesores y categorías según el deporte
  const profesoresFiltrados = (depId) =>
    profesores.filter(p => !depId || p.Especialidad === depId);

  const categoriasFiltradas = (depId) =>
    categorias.filter(c => !depId || c.Deporte === depId);
// Renderizar el formulario dinámicamente
  formEl.innerHTML = `
    <div class="admin-form-inner">
      <h4>${esNuevo ? 'Nueva clase' : 'Editar clase'}</h4>
      <div class="admin-form-grid">
        <div class="field">
          <label>Deporte</label>
          <select id="clase-deporte">
            ${deportesList.length === 0
              // Si no hay deportes creados, mostramos aviso
              ? '<option value="">— Crea un deporte primero —</option>'
              // Si hay deportes: en creación añadimos "Sin asignar" como primera opción por defecto;
              // en edición mostramos directamente los deportes con el deporte actual pre-seleccionado
              : (esNuevo ? '<option value="">— Sin asignar —</option>' : '') +
                deportesList.map(([key, cfg]) =>
                  `<option value="${key}" ${clase?.Deporte === key ? 'selected' : ''}>${cfg.icon} ${cfg.label}</option>`
                ).join('')
            }
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
    // Actualizar profesores
    selProf.innerHTML = `<option value="">Sin asignar</option>` +
      profesoresFiltrados(depId).map(p => `<option value="${p.PRO_DNI}">${p.Nombre}</option>`).join('');
    // Actualizar categorías
      selCat.innerHTML = `<option value="">Sin categoría</option>` +
      categoriasFiltradas(depId).map(c => `<option value="${c.id}">${c.Nombre} (${c.EdadMin}-${c.EdadMax} años)</option>`).join('');
  });
// Botón cancelar 
  document.getElementById('btn-cancelar-form-clase').addEventListener('click', () => formEl.classList.add('hidden'));
//Boton de guardado
  document.getElementById('btn-guardar-clase').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-clase');
    const errEl = document.getElementById('form-clase-error');
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Guardando…';
// Recoger datos del formulario
    const datos = {
      Deporte: document.getElementById('clase-deporte').value,
      Descripcion: document.getElementById('clase-desc').value.trim(),
      Horario: document.getElementById('clase-horario').value.trim(),
      Pista: document.getElementById('clase-pista').value.trim(),
      PRO_DNI: document.getElementById('clase-profesor').value || null,
      Categoria: document.getElementById('clase-categoria').value || '',
    };
// Validación básica
    if (!datos.Deporte || !datos.Descripcion || !datos.Horario || !datos.Pista) {
      errEl.textContent = 'Deporte, descripción, horario y pista son obligatorios.';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = esNuevo ? 'Crear clase' : 'Guardar cambios';
      return;
    }
// Crear o actualizar según el modo
    const resultado = esNuevo
      ? await DB.Clases.crear(datos)
      : await DB.Clases.actualizar(clase.id, datos);

    btn.disabled = false; btn.textContent = esNuevo ? 'Crear clase' : 'Guardar cambios';

    if (!resultado.ok) { errEl.textContent = resultado.error; errEl.classList.remove('hidden'); return; }

    mostrarToast(esNuevo ? '¡Clase creada!' : '¡Clase actualizada!', 'success');
    await renderAdminClases();
  });
}

/* --- ADMIN: HORARIOS --- */
/**
 * Renderiza la vista de horarios semanales del panel admin.
 */
async function renderAdminHorarios() {
  const content = document.getElementById('admin-content');

  // Cargar configuración y datos necesarios
  await cargarDeportesConfig();
  const deportesList = Object.entries(DEPORTES_CONFIG);
  const profesores = await DB.Profesor.listarTodos();
  const todasClases = await DB.Clases.listarTodas();
/**
   * Genera la tabla del horario según el deporte seleccionado.
   * @param {string} filtroDeporte - Clave del deporte o vacío para todos.
   */
  const renderVista = async (filtroDeporte) => {
    // Filtrar clases por deporte
    const clases = filtroDeporte
      ? todasClases.filter(c => c.Deporte === filtroDeporte)
      : todasClases;
    const { mapa, horas } = await construirMapaHorario(clases, profesores);
// Generar HTML de la tabla
    return generarTablaHorarioHTML(
      mapa, horas, true,
      'No hay clases. Créalas en la pestaña Clases.'
    );
  };

  // Asignar listeners a los botones de editar pill (reutilizable para filtro y vista inicial)
  const asignarListenersPillEdit = (contenedor, enHorarios = false) => {
    contenedor.querySelectorAll('.pill-edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const snap = await firebase.firestore().collection('Clases').doc(btn.dataset.id).get();
        if (snap.exists) {
          const cats = await DB.Categoria.listarTodas();
          adminState.tabActual = 'clases';
          if (enHorarios) {
            renderAdminTabs();
            const formContent = document.getElementById('admin-content');
            formContent.innerHTML = '<div id="form-clase" class="admin-form"></div><div id="admin-horarios-back" style="margin-top:1rem"><button class="btn-ghost" id="btn-volver-horarios">← Volver a Horarios</button></div>';
            mostrarFormClase({ id: snap.id, ...snap.data() }, deportesList, profesores, cats);
            document.getElementById('btn-volver-horarios').addEventListener('click', () => switchAdminTab('horarios'));
          } else {
            mostrarFormClase({ id: snap.id, ...snap.data() }, deportesList, profesores, cats);
          }
        }
      });
    });
  };

// Renderizar vista inicial (sin filtros)
  const vistaHTML = await renderVista('');
// Construcción del HTML principal
  content.innerHTML = `
    <div class="admin-section-header">
      <h3 class="admin-section-title">🗓️ Horario Semanal</h3>
      <div style="display:flex;gap:1rem;align-items:center">
        <select id="admin-horario-filtro" style="padding:0.4rem 0.8rem;background:var(--clr-surface);color:var(--clr-text);border:1px solid var(--clr-border);border-radius:6px">
          <option value="">Todos los deportes</option>
          ${deportesList.map(([key, cfg]) => `<option value="${key}">${cfg.icon} ${cfg.label}</option>`).join('')}
        </select>
        <span style="color:var(--clr-muted);font-size:13px">Edita las clases desde la pestaña <strong>Clases</strong></span>
      </div>
    </div>
    <div id="admin-horario-vista">${vistaHTML}</div>`;
  // Listener del filtro por deporte
  document.getElementById('admin-horario-filtro').addEventListener('change', async (e) => {
    document.getElementById('admin-horario-vista').innerHTML = '<div class="admin-loading">Cargando…</div>';
    document.getElementById('admin-horario-vista').innerHTML = await renderVista(e.target.value);
    // Reasignar listeners de editar
    asignarListenersPillEdit(document.getElementById('admin-horario-vista'));
  });

  // Botones editar en la vista inicial
  asignarListenersPillEdit(content, true);
}

/* ============================================================
   MODAL ADMIN ELIMINAR (compartido)
   ============================================================ */

['btn-admin-cancel-eliminar', 'close-modal-admin-eliminar'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    toggle(document.getElementById('modal-admin-eliminar'), false);
  });
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
    document.getElementById('sidebar').classList.remove('hidden-nav');
    document.getElementById('nav-username').textContent = usuario.Nombre.split(' ')[0];
    document.getElementById('avatar-initials').textContent = iniciales(usuario.Nombre);

    // Mostrar/ocultar enlace admin según rol
    const navAdmin = document.getElementById('nav-admin-link');
    if (navAdmin) toggle(navAdmin, usuario.Rol === 'admin');

    await cargarDeportesConfig();
    await renderSidebarCategorias();
    await navegarA('dashboard'); // <--- AHORA NAVEGA A dashboard
  }
};

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

  await DB.seed();

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
      // Sin sesión: mostrar el formulario de login
      document.getElementById('navbar').classList.add('hidden');
      document.getElementById('sidebar').classList.add('hidden-nav');
      cerrarSidebar();
      pageAuth.classList.remove('hidden');
      document.querySelectorAll('.page:not(#page-auth)').forEach(p => p.classList.add('hidden'));
    }
  })
})();