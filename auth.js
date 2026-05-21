/**
 * auth.js — Sistema de autenticación con Firebase Authentication
 */
<<<<<<< HEAD

/**
 * vbfispbvdsuobio
=======
/**
 * mario se a guardado 
>>>>>>> d6b19479af0f75a1764df2188891a504b24ab258
 */
const Auth = (() => {
  const auth = firebase.auth();

  function obtenerSesion() {
    return auth.currentUser ? auth.currentUser.email : null;
  }

  async function usuarioActual() {
    const user = auth.currentUser;
    if (!user) return null;
    return await DB.Usuario.buscarPorCorreo(user.email);
  }

  function estaAutenticado() {
    return auth.currentUser !== null;
  }

  function _esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function _esDNIValido(dni) {
    return /^[0-9]{8}[A-Za-z]$/.test(dni.trim());
  }

  async function registrar({ Nombre, US_DNI, F_Nacimiento, Correo, Contrasenna }) {
    if (!Nombre || Nombre.trim().length < 3)
      return { ok: false, error: 'El nombre completo debe tener al menos 3 caracteres.' };
    if (!_esDNIValido(US_DNI))
      return { ok: false, error: 'El DNI no tiene un formato válido (ej: 12345678A).' };
    if (!F_Nacimiento)
      return { ok: false, error: 'La fecha de nacimiento es obligatoria.' };
    if (!_esEmailValido(Correo))
      return { ok: false, error: 'El correo electrónico no tiene un formato válido.' };
    if (!Contrasenna || Contrasenna.length < 6)
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };

    const dniUpper = US_DNI.toUpperCase().trim();
    const porDNI = await firebase.firestore().collection('Usuario').doc(dniUpper).get();
    if (porDNI.exists) return { ok: false, error: 'El DNI ya está registrado.' };

    try {
      const cred = await auth.createUserWithEmailAndPassword(
        Correo.trim().toLowerCase(),
        Contrasenna
      );

      const resultado = await DB.Usuario.insertar({
        US_DNI: dniUpper,
        Nombre: Nombre.trim(),
        Correo: Correo.trim().toLowerCase(),
        F_Nacimiento,
        // Rol se asigna en DB.Usuario.insertar como 'predeterminado'
      });

      if (!resultado.ok) {
        await cred.user.delete();
        return resultado;
      }

      await auth.signOut();
      return { ok: true };
    } catch (err) {
      if (err.code === 'auth/email-already-in-use')
        return { ok: false, error: 'El correo ya está en uso.' };
      if (err.code === 'auth/invalid-email')
        return { ok: false, error: 'El correo electrónico no tiene un formato válido.' };
      if (err.code === 'auth/weak-password')
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
      return { ok: false, error: 'Error al crear la cuenta. Inténtalo de nuevo.' };
    }
  }

  async function iniciarSesion(correo, contrasenna) {
    if (!correo || !contrasenna)
      return { ok: false, error: 'Introduce tu correo y contraseña.' };

    try {
      await auth.signInWithEmailAndPassword(correo.trim().toLowerCase(), contrasenna);

      const perfil = await DB.Usuario.buscarPorCorreo(correo.trim().toLowerCase());
      if (!perfil) {
        await auth.signOut();
        return { ok: false, error: 'Cuenta de acceso correcta pero perfil no encontrado. Contacta con soporte.' };
      }

      return { ok: true };
    } catch (err) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-email'
      ) return { ok: false, error: 'No existe ninguna cuenta con ese correo.' };
      if (err.code === 'auth/wrong-password')
        return { ok: false, error: 'La contraseña es incorrecta.' };
      if (err.code === 'auth/too-many-requests')
        return { ok: false, error: 'Demasiados intentos fallidos. Espera unos minutos.' };
      return { ok: false, error: 'Error al iniciar sesión. Inténtalo de nuevo.' };
    }
  }

  function cerrarSesion() {
    return auth.signOut();
  }

  async function eliminarCuenta() {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: 'No hay ninguna sesión activa.' };

    const usuario = await DB.Usuario.buscarPorCorreo(user.email);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado en la base de datos.' };

    const resultado = await DB.eliminarUsuario(usuario.US_DNI);
    if (!resultado.ok) return resultado;

    try {
      await user.delete();
    } catch (err) {
      if (err.code === 'auth/requires-recent-login')
        return { ok: false, error: 'Por seguridad, cierra sesión, vuelve a entrar y elimina la cuenta.' };
      return { ok: false, error: 'No se pudo eliminar la cuenta de autenticación.' };
    }

    return { ok: true };
  }

  async function recuperarContrasenna(correo) {
    if (!_esEmailValido(correo))
      return { ok: false, error: 'Introduce un correo electrónico válido.' };

    try {
      await auth.sendPasswordResetEmail(correo.trim().toLowerCase());
      return { ok: true };
    } catch (err) {
      if (err.code === 'auth/user-not-found')
        return { ok: false, error: 'No hay ninguna cuenta registrada con ese correo.' };
      return { ok: false, error: 'No se pudo enviar el correo. Inténtalo de nuevo.' };
    }
  }

  async function resetearContrasenna() {
    return { ok: false, error: 'Usa el enlace del correo para restablecer tu contraseña.' };
  }

  return {
    registrar,
    iniciarSesion,
    cerrarSesion,
    eliminarCuenta,
    recuperarContrasenna,
    resetearContrasenna,
    obtenerSesion,
    usuarioActual,
    estaAutenticado,
  };

})();


/* ============================================================
   CONTROLADOR DE LA VISTA DE AUTH
   ============================================================ */

(function initAuthUI() {

  function mostrarForm(id) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function mostrarError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function ocultarMsg(id) {
    document.getElementById(id).classList.add('hidden');
  }

  document.getElementById('link-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarForm('form-register');
  });

  document.getElementById('link-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarForm('form-login');
  });

  document.getElementById('link-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarForm('form-forgot');
  });

  document.getElementById('link-back-login').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarForm('form-login');
  });

  /* ---- LOGIN ---- */
  document.getElementById('btn-login').addEventListener('click', async () => {
    ocultarMsg('login-error');
    const correo = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    const resultado = await Auth.iniciarSesion(correo, pass);
    if (!resultado.ok) {
      mostrarError('login-error', resultado.error);
      return;
    }
  });

  ['login-email', 'login-pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  });

  /* ---- REGISTRO ---- */
  document.getElementById('btn-register').addEventListener('click', async () => {
    ocultarMsg('reg-error');
    ocultarMsg('reg-success');

    const resultado = await Auth.registrar({
      Nombre: document.getElementById('reg-nombre').value,
      US_DNI: document.getElementById('reg-dni').value,
      F_Nacimiento: document.getElementById('reg-fnac').value,
      Correo: document.getElementById('reg-email').value,
      Contrasenna: document.getElementById('reg-pass').value,
    });

    if (!resultado.ok) {
      mostrarError('reg-error', resultado.error);
      return;
    }

    const okEl = document.getElementById('reg-success');
    okEl.textContent = '¡Cuenta creada correctamente! Ya puedes iniciar sesión.';
    okEl.classList.remove('hidden');

    setTimeout(() => {
      ['reg-nombre', 'reg-dni', 'reg-fnac', 'reg-email', 'reg-pass'].forEach(id => {
        document.getElementById(id).value = '';
      });
      mostrarForm('form-login');
    }, 1500);
  });

  /* ---- RECUPERAR CONTRASEÑA ---- */
  document.getElementById('btn-forgot').addEventListener('click', async () => {
    const msgEl = document.getElementById('forgot-msg');
    msgEl.classList.add('hidden');

    const btn = document.getElementById('btn-forgot');
    const correo = document.getElementById('forgot-email').value;

    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const resultado = await Auth.recuperarContrasenna(correo);

    btn.disabled = false;
    btn.textContent = 'Enviar instrucciones';

    if (!resultado.ok) {
      msgEl.className = 'msg-error';
      msgEl.textContent = resultado.error;
      msgEl.classList.remove('hidden');
      return;
    }

    msgEl.className = 'msg-success';
    msgEl.textContent = '✓ Correo enviado. Revisa tu bandeja de entrada (y la carpeta de spam).';
    msgEl.classList.remove('hidden');
  });

  document.getElementById('btn-reset-pass').addEventListener('click', async () => {
    const msgEl = document.getElementById('reset-msg');
    msgEl.className = 'msg-error';
    msgEl.textContent = 'Usa el enlace del correo para restablecer tu contraseña.';
    msgEl.classList.remove('hidden');
  });

})();
