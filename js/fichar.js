import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, setDoc, query, where, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

const currentDateEl = document.getElementById("currentDate");
const elapsedClock = document.getElementById("elapsedClock");
const statusBadge = document.getElementById("statusBadge");
const btnFichar = document.getElementById("btnFichar");
const btnBuceo = document.getElementById("btnBuceo");
const btnLogout = document.getElementById("btnLogout");
const btnCalendario = document.getElementById("btnCalendario");
const btnInforme = document.getElementById("btnInforme");
const btnAjustes = document.getElementById("btnAjustes");

let usuarioActual = null;
let horaEntradaTimestamp = null;
let timerInterval = null;
let buceoActivo = false;
let msAcumuladosHoy = 0;
let jornadaActiva = false; // Estado booleano en lugar de almacenar un ID aleatorio

function obtenerFechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function mostrarFechaActual() {
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const fechaStr = new Date().toLocaleDateString('es-ES', opciones);
  currentDateEl.textContent = fechaStr;
}
mostrarFechaActual();

function formatearTiempo(ms) {
  if (ms < 0) ms = 0;
  const segundosTotales = Math.floor(ms / 1000);
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;

  return (
    String(horas).padStart(2, '0') + ":" +
    String(minutos).padStart(2, '0') + ":" +
    String(segundos).padStart(2, '0')
  );
}

// Inicialización segura esperando a que Firebase lea el almacenamiento local
async function inicializarSesionSegura() {
  try {
    if (auth.authStateReady) {
      await auth.authStateReady();
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const user = auth.currentUser;
    if (user) {
      usuarioActual = user;
      await calcularEstadoYJornadasHoy(user.uid);
    } else {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Error al verificar sesión:", error);
    window.location.href = "index.html";
  }
}

inicializarSesionSegura();

onAuthStateChanged(auth, (user) => {
  if (!user && usuarioActual) {
    window.location.href = "index.html";
  }
});

async function calcularEstadoYJornadasHoy(uid) {
  try {
    const fechaHoy = obtenerFechaHoy();
    const q = query(
      collection(db, "jornadas"),
      where("usuarioId", "==", uid),
      where("fecha", "==", fechaHoy)
    );

    const querySnapshot = await getDocs(q);

    msAcumuladosHoy = 0;
    jornadaActiva = false;
    horaEntradaTimestamp = null;
    let sesionActivaEncontrada = false;

    // Si por error histórico hubiera varios documentos para hoy, los procesamos o limpiamos
    let documentosEncontrados = [];

    querySnapshot.forEach((docSnap) => {
      documentosEncontrados.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Buscamos si hay alguna sesión activa (salida == null)
    const activa = documentosEncontrados.find(d => d.salida === null);

    if (activa) {
      sesionActivaEncontrada = true;
      jornadaActiva = true;
      buceoActivo = activa.plusBuceo || false;
      if (activa.entrada && activa.entrada.toDate) {
        horaEntradaTimestamp = activa.entrada.toDate();
      }
    }

    // Sumamos el tiempo de las sesiones ya cerradas (o de todas si limpiamos)
    documentosEncontrados.forEach((d) => {
      if (d.salida !== null && d.entrada && d.salida && d.entrada.toDate && d.salida.toDate) {
        const duracion = d.salida.toDate() - d.entrada.toDate();
        msAcumuladosHoy += duracion;
        if (d.plusBuceo) buceoActivo = true;
      }
    });

    actualizarBotonBuceoUI();

    if (sesionActivaEncontrada) {
      actualizarInterfazEstado(true);
      iniciarRelojAcumulativo();
    } else {
      actualizarInterfazEstado(false);
      elapsedClock.textContent = formatearTiempo(msAcumuladosHoy);
    }
  } catch (error) {
    console.error("Error al calcular jornadas de hoy:", error);
  }
}

function iniciarRelojAcumulativo() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!horaEntradaTimestamp) return;
    const ahora = new Date();
    const msSesionActual = ahora - horaEntradaTimestamp;
    const msTotalHoy = msAcumuladosHoy + msSesionActual;

    elapsedClock.textContent = formatearTiempo(msTotalHoy);
  }, 1000);
}

function detenerReloj() {
  if (timerInterval) clearInterval(timerInterval);
}

function actualizarInterfazEstado(activo) {
  if (activo) {
    statusBadge.textContent = "Estado: Jornada en curso 🟢";
    statusBadge.style.color = "#4caf50";
    btnFichar.textContent = "🛑 Finalizar Jornada";
    btnFichar.style.background = "#d32f2f";
    btnFichar.style.color = "#ffffff";
  } else {
    statusBadge.textContent = "Estado: Fuera de servicio ⚪";
    statusBadge.style.color = "var(--muted)";
    btnFichar.textContent = "▶ Fichar Entrada";
    btnFichar.style.background = "#00e676";
    btnFichar.style.color = "#000000";
    detenerReloj();
  }
}

function actualizarBotonBuceoUI() {
  if (buceoActivo) {
    btnBuceo.textContent = "🤿 Plus Buceo: Activo";
    btnBuceo.classList.add("active");
  } else {
    btnBuceo.textContent = "🤿 Plus Buceo: Inactivo";
    btnBuceo.classList.remove("active");
  }
}

btnFichar.addEventListener("click", async () => {
  if (!usuarioActual) return;

  try {
    btnFichar.disabled = true;
    const fechaHoy = obtenerFechaHoy();
    // ID único y determinista por usuario y día (evita duplicados de documentos)
    const idJornadaUnico = `${usuarioActual.uid}_${fechaHoy}`;
    const jornadaRef = doc(db, "jornadas", idJornadaUnico);
    const ahora = new Date();

    if (jornadaActiva) {
      // Finalizar la jornada activa del día actual
      const docSnap = await getDoc(jornadaRef);
      let entradaOriginal = serverTimestamp();

      if (docSnap.exists() && docSnap.data().entrada) {
        entradaOriginal = docSnap.data().entrada;
        if (docSnap.data().entrada.toDate) {
          horaEntradaTimestamp = docSnap.data().entrada.toDate();
        }
      }

      await setDoc(jornadaRef, {
        usuarioId: usuarioActual.uid,
        fecha: fechaHoy,
        entrada: entradaOriginal,
        salida: serverTimestamp(),
        plusBuceo: buceoActivo
      }, { merge: true });

      if (horaEntradaTimestamp) {
        msAcumuladosHoy += (ahora - horaEntradaTimestamp);
      }

      jornadaActiva = false;
      horaEntradaTimestamp = null;
      actualizarInterfazEstado(false);
      elapsedClock.textContent = formatearTiempo(msAcumuladosHoy);

    } else {
      // Iniciar o reanudar la jornada del día actual
      const userDoc = await getDoc(doc(db, "usuarios", usuarioActual.uid));
      const empresaId = userDoc.exists() ? userDoc.data().empresaId : null;

      // Si ya existía un documento previo de hoy cerrado, mantenemos su hora de entrada original o seteamos una nueva si empieza de cero
      const docSnap = await getDoc(jornadaRef);
      let entradaAUsar = serverTimestamp();

      if (docSnap.exists() && docSnap.data().entrada && msAcumuladosHoy === 0) {
        entradaAUsar = docSnap.data().entrada;
      }

      await setDoc(jornadaRef, {
        usuarioId: usuarioActual.uid,
        empresaId: empresaId,
        fecha: fechaHoy,
        entrada: entradaAUsar,
        salida: null, // Dejamos la salida abierta
        plusBuceo: buceoActivo
      }, { merge: true });

      jornadaActiva = true;
      horaEntradaTimestamp = new Date();
      iniciarRelojAcumulativo();
      actualizarInterfazEstado(true);
    }

  } catch (error) {
    alert("Error al procesar el fichaje: " + error.message);
  } finally {
    btnFichar.disabled = false;
  }
});

btnBuceo.addEventListener("click", async () => {
  if (buceoActivo) {
    const confirmar = confirm("¿Estás seguro de que deseas desactivar el Plus de Buceo?");
    if (!confirmar) return;
  }

  buceoActivo = !buceoActivo;
  actualizarBotonBuceoUI();

  try {
    const fechaHoy = obtenerFechaHoy();
    const idJornadaUnico = `${usuarioActual.uid}_${fechaHoy}`;
    const jornadaRef = doc(db, "jornadas", idJornadaUnico);

    // Actualizamos el plus de buceo en el documento del día si ya existe
    await setDoc(jornadaRef, {
      plusBuceo: buceoActivo
    }, { merge: true });
  } catch (error) {
    console.error("Error al actualizar el plus de buceo:", error);
  }
});

btnCalendario.addEventListener("click", () => {
  window.location.href = "calendario.html";
});
btnInforme.addEventListener("click", () => {
  window.location.href = "informe.html";
});
btnAjustes.addEventListener("click", () => {
  window.location.href = "ajustes.html";
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
});
