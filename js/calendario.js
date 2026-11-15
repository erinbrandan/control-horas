import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const monthTitle = document.getElementById("monthTitle");
const daysGrid = document.getElementById("daysGrid");
const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");
const totalMensualVal = document.getElementById("totalMensualVal");
const btnVolver = document.getElementById("btnVolver");

const dayModal = document.getElementById("dayModal");
const modalFechaTitulo = document.getElementById("modalFechaTitulo");
const modalHoraInicio = document.getElementById("modalHoraInicio");
const modalHoraFin = document.getElementById("modalHoraFin");
const modalPlusBuceo = document.getElementById("modalPlusBuceo");
const modalPrecioHora = document.getElementById("modalPrecioHora");
const modalPrecioExtra = document.getElementById("modalPrecioExtra");
const modalPrecioBuceo = document.getElementById("modalPrecioBuceo");
const modalBtnRetroceder = document.getElementById("modalBtnRetroceder");
const dayEditForm = document.getElementById("dayEditForm");

let usuarioActual = null;
let fechaActualVisualizacion = new Date();
let tarifasUsuario = {
  precioHora: 15.83,
  precioHoraExtra: 15.83,
  baseHoras: 6,
  precioBuceo: 30.00
};
let jornadasDelMesMap = {};
let jornadaSeleccionadaId = null;
let fechaSeleccionadaStr = null;

async function inicializarCalendario() {
  try {
    if (auth.authStateReady) {
      await auth.authStateReady();
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    usuarioActual = auth.currentUser;
    if (!usuarioActual) {
      window.location.href = "index.html";
      return;
    }

    await cargarTarifasUsuario();
    await renderizarCalendario();

  } catch (error) {
    console.error("Error al inicializar calendario:", error);
  }
}

inicializarCalendario();

async function cargarTarifasUsuario() {
  try {
    const userDocRef = doc(db, "usuarios", usuarioActual.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      tarifasUsuario.precioHora = data.precioHora !== undefined ? data.precioHora : 15.83;
      tarifasUsuario.precioHoraExtra = data.precioHoraExtra !== undefined ? data.precioHoraExtra : 15.83;
      tarifasUsuario.baseHoras = data.baseHoras !== undefined ? data.baseHoras : 6;
      tarifasUsuario.precioBuceo = data.precioBuceo !== undefined ? data.precioBuceo : 30.00;
    }
  } catch (error) {
    console.error("Error al cargar tarifas:", error);
  }
}

btnPrevMonth.addEventListener("click", async () => {
  fechaActualVisualizacion.setMonth(fechaActualVisualizacion.getMonth() - 1);
  await renderizarCalendario();
});

btnNextMonth.addEventListener("click", async () => {
  fechaActualVisualizacion.setMonth(fechaActualVisualizacion.getMonth() + 1);
  await renderizarCalendario();
});

async function renderizarCalendario() {
  const anio = fechaActualVisualizacion.getFullYear();
  const mes = fechaActualVisualizacion.getMonth();

  const opcionesMes = { month: 'long', year: 'numeric' };
  monthTitle.textContent = fechaActualVisualizacion.toLocaleDateString('es-ES', opcionesMes);

  await cargarJornadasDelMes(anio, mes);

  daysGrid.innerHTML = "";

  const primerDiaMes = new Date(anio, mes, 1);
  const ultimoDiaMes = new Date(anio, mes + 1, 0);
  const totalDias = ultimoDiaMes.getDate();

  let primerDiaSemana = primerDiaMes.getDay() - 1;
  if (primerDiaSemana === -1) primerDiaSemana = 6;

  for (let i = 0; i < primerDiaSemana; i++) {
    const celdaVacia = document.createElement("div");
    celdaVacia.classList.add("day-cell", "cell-empty");
    daysGrid.appendChild(celdaVacia);
  }

  let sumaTotalMes = 0;

  for (let dia = 1; dia <= totalDias; dia++) {
    const mesStr = String(mes + 1).padStart(2, '0');
    const diaStr = String(dia).padStart(2, '0');
    const fechaKey = `${anio}-${mesStr}-${diaStr}`;

    const celda = document.createElement("div");
    celda.classList.add("day-cell");

    const jornadaData = jornadasDelMesMap[fechaKey];

    let textoSueldo = "";
    let textoHoras = "";
    let textoBuceo = "";

    if (jornadaData && jornadaData.entrada) {
      const entradaMs = jornadaData.entrada.toDate().getTime();
      let salidaMs = jornadaData.salida && jornadaData.salida.toDate ? jornadaData.salida.toDate().getTime() : new Date().getTime();

      const duracionMs = salidaMs - entradaMs;
      const horasTrabajadas = duracionMs > 0 ? duracionMs / (1000 * 60 * 60) : 0;

      const baseHoras = tarifasUsuario.baseHoras;
      const pHora = jornadaData.precioHora !== undefined ? jornadaData.precioHora : tarifasUsuario.precioHora;
      const pExtra = jornadaData.precioHoraExtra !== undefined ? jornadaData.precioHoraExtra : tarifasUsuario.precioHoraExtra;
      const pBuceo = jornadaData.precioBuceo !== undefined ? jornadaData.precioBuceo : tarifasUsuario.precioBuceo;

      // REGLA DE HORAS BASE MÍNIMAS Y EXTRAS
      const horasExtra = Math.max(0, horasTrabajadas - baseHoras);
      let sueldoDia = (baseHoras * pHora) + (horasExtra * pExtra);

      if (jornadaData.plusBuceo) {
        sueldoDia += pBuceo;
      }

      // REDONDEO AL EURO MÁS CERCANO
      sueldoDia = Math.round(sueldoDia);

      sumaTotalMes += sueldoDia;

      textoSueldo = `${sueldoDia}€`;
      textoHoras = `${horasTrabajadas.toFixed(1)}h`;

      if (jornadaData.plusBuceo) {
        celda.classList.add("cell-buceo");
        textoBuceo = "🤿 Sí";
      } else {
        celda.classList.add("cell-trabajado");
        textoBuceo = "🤿 No";
      }
    } else {
      celda.classList.add("cell-empty");
    }

    celda.innerHTML = `
      <div class="day-number">${dia}</div>
      <div class="day-info">
        <div>${textoSueldo}</div>
        <div>${textoHoras}</div>
        <div>${textoBuceo}</div>
      </div>
    `;

    celda.addEventListener("click", () => {
      abrirModalDia(fechaKey, jornadaData);
    });

    daysGrid.appendChild(celda);
  }

  totalMensualVal.textContent = `${sumaTotalMes} €`;
}

async function cargarJornadasDelMes(anio, mes) {
  jornadasDelMesMap = {};
  try {
    const q = query(
      collection(db, "jornadas"),
      where("usuarioId", "==", usuarioActual.uid)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.fecha) {
        const [fAnio, fMes] = data.fecha.split('-').map(Number);
        if (fAnio === anio && (fMes - 1) === mes) {
          jornadasDelMesMap[data.fecha] = { id: docSnap.id, ...data };
        }
      }
    });
  } catch (error) {
    console.error("Error al cargar jornadas:", error);
  }
}

function abrirModalDia(fechaStr, jornadaData) {
  fechaSeleccionadaStr = fechaStr;
  modalFechaTitulo.textContent = `Editar: ${fechaStr}`;

  if (jornadaData && jornadaData.entrada) {
    jornadaSeleccionadaId = jornadaData.id;

    const dEntrada = jornadaData.entrada.toDate();
    modalHoraInicio.value = String(dEntrada.getHours()).padStart(2, '0') + ":" + String(dEntrada.getMinutes()).padStart(2, '0');

    if (jornadaData.salida && jornadaData.salida.toDate) {
      const dSalida = jornadaData.salida.toDate();
      modalHoraFin.value = String(dSalida.getHours()).padStart(2, '0') + ":" + String(dSalida.getMinutes()).padStart(2, '0');
    } else {
      const dNow = new Date();
      modalHoraFin.value = String(dNow.getHours()).padStart(2, '0') + ":" + String(dNow.getMinutes()).padStart(2, '0');
    }

    modalPlusBuceo.value = jornadaData.plusBuceo ? "true" : "false";
    modalPrecioHora.value = jornadaData.precioHora !== undefined ? jornadaData.precioHora : tarifasUsuario.precioHora;
    modalPrecioExtra.value = jornadaData.precioHoraExtra !== undefined ? jornadaData.precioHoraExtra : tarifasUsuario.precioHoraExtra;
    modalPrecioBuceo.value = jornadaData.precioBuceo !== undefined ? jornadaData.precioBuceo : tarifasUsuario.precioBuceo;
  } else {
    jornadaSeleccionadaId = null;
    modalHoraInicio.value = "08:00";
    modalHoraFin.value = "14:00";
    modalPlusBuceo.value = "false";
    modalPrecioHora.value = tarifasUsuario.precioHora;
    modalPrecioExtra.value = tarifasUsuario.precioHoraExtra;
    modalPrecioBuceo.value = tarifasUsuario.precioBuceo;
  }

  dayModal.classList.remove("hidden");
}

modalBtnRetroceder.addEventListener("click", () => {
  dayModal.classList.add("hidden");
});

dayEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioActual || !fechaSeleccionadaStr) return;

  try {
    const [hInicio, mInicio] = modalHoraInicio.value.split(':');
    const [hFin, mFin] = modalHoraFin.value.split(':');

    const fechaEntrada = new Date(fechaSeleccionadaStr);
    fechaEntrada.setHours(parseInt(hInicio), parseInt(mInicio), 0);

    const fechaSalida = new Date(fechaSeleccionadaStr);
    fechaSalida.setHours(parseInt(hFin), parseInt(mFin), 0);

    const datosJornada = {
      usuarioId: usuarioActual.uid,
      fecha: fechaSeleccionadaStr,
      entrada: Timestamp.fromDate(fechaEntrada),
      salida: Timestamp.fromDate(fechaSalida),
      plusBuceo: modalPlusBuceo.value === "true",
      precioHora: parseFloat(modalPrecioHora.value),
      precioHoraExtra: parseFloat(modalPrecioExtra.value),
      precioBuceo: parseFloat(modalPrecioBuceo.value)
    };

    if (jornadaSeleccionadaId) {
      const jornadaRef = doc(db, "jornadas", jornadaSeleccionadaId);
      await updateDoc(jornadaRef, datosJornada);
    } else {
      const userDoc = await getDoc(doc(db, "usuarios", usuarioActual.uid));
      datosJornada.empresaId = userDoc.exists() ? userDoc.data().empresaId : null;
      await addDoc(collection(db, "jornadas"), datosJornada);
    }

    dayModal.classList.add("hidden");
    await renderizarCalendario();
    alert("¡Jornada actualizada correctamente!");

  } catch (error) {
    alert("Error al guardar la jornada: " + error.message);
  }
});

btnVolver.addEventListener("click", () => {
  window.location.href = "fichar.html";
});
