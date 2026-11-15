import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const monthTitle = document.getElementById("monthTitle");
const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");
const btnVolver = document.getElementById("btnVolver");
const btnCompartir = document.getElementById("btnCompartir");

const repTrabajador = document.getElementById("repTrabajador");
const repDiasBuceo = document.getElementById("repDiasBuceo");
const repDineroBuceo = document.getElementById("repDineroBuceo");
const repDiasTrabajados = document.getElementById("repDiasTrabajados");
const repTotalHoras = document.getElementById("repTotalHoras");
const repDineroHoras = document.getElementById("repDineroHoras");
const repTotalHorasExtra = document.getElementById("repTotalHorasExtra");
const repDineroExtra = document.getElementById("repDineroExtra");
const repTotalDinero = document.getElementById("repTotalDinero");

let usuarioActual = null;
let fechaActualVisualizacion = new Date();
let nombreUsuario = "Trabajador";
let informeDatosActuales = {};

async function inicializarInforme() {
  try {
    if (auth.authStateReady) {
      await auth.authStateReady();
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const userAuth = auth.currentUser;
    if (!userAuth) {
      window.location.href = "index.html";
      return;
    }

    // Comprobamos si la URL trae un parámetro ?uid=... (caso del empresario viendo a un empleado)
    const urlParams = new URLSearchParams(window.location.search);
    const uidParam = urlParams.get("uid");

    if (uidParam) {
      // Si es un empresario consultando, asignamos temporalmente el ID del trabajador
      usuarioActual = { uid: uidParam };
    } else {
      // Si no, es el usuario normal viendo su propio informe
      usuarioActual = userAuth;
    }

    await cargarDatosUsuario();
    await calcularYRenderizarInforme();

  } catch (error) {
    console.error("Error al inicializar el informe:", error);
  }
}

inicializarInforme();

async function cargarDatosUsuario() {
  try {
    const userDocRef = doc(db, "usuarios", usuarioActual.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      nombreUsuario = data.nombre || usuarioActual.email;
      repTrabajador.textContent = nombreUsuario;
    } else {
      repTrabajador.textContent = usuarioActual.email;
    }
  } catch (error) {
    console.error("Error al cargar datos del usuario:", error);
  }
}

btnPrevMonth.addEventListener("click", async () => {
  fechaActualVisualizacion.setMonth(fechaActualVisualizacion.getMonth() - 1);
  await calcularYRenderizarInforme();
});

btnNextMonth.addEventListener("click", async () => {
  fechaActualVisualizacion.setMonth(fechaActualVisualizacion.getMonth() + 1);
  await calcularYRenderizarInforme();
});

async function calcularYRenderizarInforme() {
  const anio = fechaActualVisualizacion.getFullYear();
  const mes = fechaActualVisualizacion.getMonth();

  const opcionesMes = { month: 'long', year: 'numeric' };
  const mesNombre = fechaActualVisualizacion.toLocaleDateString('es-ES', opcionesMes);
  monthTitle.textContent = mesNombre;

  const jornadasMes = await obtenerJornadasDelMes(anio, mes);

  let diasBuceoCount = 0;
  let dineroBuceoTotal = 0;
  let totalHorasBaseAcumuladas = 0;
  let dineroHorasBaseTotal = 0;
  let totalHorasExtraAcumuladas = 0;
  let dineroExtraTotal = 0;

  // Agrupamos por fecha (YYYY-MM-DD) para garantizar que cada día se cuenta una única vez
  const jornadasPorFecha = new Map();

  jornadasMes.forEach((jornada) => {
    if (!jornada.fecha || !jornada.entrada) return;
    jornadasPorFecha.set(jornada.fecha, jornada);
  });

  // Obtener tarifas del usuario
  const userDocRef = doc(db, "usuarios", usuarioActual.uid);
  const userDoc = await getDoc(userDocRef);
  const dataUsr = userDoc.exists() ? userDoc.data() : {};
  const baseHoras = dataUsr.baseHoras !== undefined ? dataUsr.baseHoras : 6;
  const defPrecioHora = dataUsr.precioHora !== undefined ? dataUsr.precioHora : 15.83;
  const defPrecioExtra = dataUsr.precioHoraExtra !== undefined ? dataUsr.precioHoraExtra : 15.83;
  const defPrecioBuceo = dataUsr.precioBuceo !== undefined ? dataUsr.precioBuceo : 30.00;

  jornadasPorFecha.forEach((jornada) => {
    const entradaMs = jornada.entrada.toDate().getTime();
    let salidaMs = jornada.salida && jornada.salida.toDate ? jornada.salida.toDate().getTime() : new Date().getTime();

    const duracionMs = salidaMs - entradaMs;
    const horasTrabajadas = duracionMs > 0 ? duracionMs / (1000 * 60 * 60) : 0;

    const pHora = jornada.precioHora !== undefined ? jornada.precioHora : defPrecioHora;
    const pExtra = jornada.precioHoraExtra !== undefined ? jornada.precioHoraExtra : defPrecioExtra;
    const pBuceo = jornada.precioBuceo !== undefined ? jornada.precioBuceo : defPrecioBuceo;

    const horasBaseJornada = Math.min(horasTrabajadas, baseHoras);
    const horasExtraJornada = Math.max(0, horasTrabajadas - baseHoras);

    totalHorasBaseAcumuladas += horasBaseJornada;
    totalHorasExtraAcumuladas += horasExtraJornada;

    dineroHorasBaseTotal += (baseHoras * pHora);
    dineroExtraTotal += (horasExtraJornada * pExtra);

    if (jornada.plusBuceo) {
      diasBuceoCount++;
      dineroBuceoTotal += pBuceo;
    }
  });

  const diasTrabajadosCount = jornadasPorFecha.size;

  const dineroBuceoRedondeado = Math.round(dineroBuceoTotal);
  const dineroHorasRedondeado = Math.round(dineroHorasBaseTotal);
  const dineroExtraRedondeado = Math.round(dineroExtraTotal);
  const dineroTotalMensual = dineroBuceoRedondeado + dineroHorasRedondeado + dineroExtraRedondeado;

  // Guardar datos para compartir
  informeDatosActuales = {
    mes: mesNombre,
    trabajador: nombreUsuario,
    diasBuceo: diasBuceoCount,
    dineroBuceo: dineroBuceoRedondeado,
    diasTrabajados: diasTrabajadosCount,
    totalHoras: totalHorasBaseAcumuladas.toFixed(1),
    dineroHoras: dineroHorasRedondeado,
    totalHorasExtra: totalHorasExtraAcumuladas.toFixed(1),
    dineroExtra: dineroExtraRedondeado,
    totalDinero: dineroTotalMensual
  };

  // Renderizar en pantalla
  repDiasBuceo.textContent = diasBuceoCount;
  repDineroBuceo.textContent = `${dineroBuceoRedondeado} €`;
  repDiasTrabajados.textContent = diasTrabajadosCount;
  repTotalHoras.textContent = `${informeDatosActuales.totalHoras} h`;
  repDineroHoras.textContent = `${dineroHorasRedondeado} €`;
  repTotalHorasExtra.textContent = `${informeDatosActuales.totalHorasExtra} h`;
  repDineroExtra.textContent = `${dineroExtraRedondeado} €`;
  repTotalDinero.textContent = `${dineroTotalMensual} €`;
}

async function obtenerJornadasDelMes(anio, mes) {
  let jornadasArr = [];
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
          jornadasArr.push(data);
        }
      }
    });
  } catch (error) {
    console.error("Error al obtener jornadas para informe:", error);
  }
  return jornadasArr;
}

// Botón de Compartir y Exportar a PDF
btnCompartir.addEventListener("click", async () => {
  const textoInforme = `📊 Informe de Horas - ${informeDatosActuales.mes.toUpperCase()}
👤 Trabajador: ${informeDatosActuales.trabajador}
🤿 Días de buceo: ${informeDatosActuales.diasBuceo} (${informeDatosActuales.dineroBuceo} €)
📅 Días trabajados: ${informeDatosActuales.diasTrabajados}
⏱️ Total horas base: ${informeDatosActuales.totalHoras} h (${informeDatosActuales.dineroHoras} €)
⚡ Total horas extra: ${informeDatosActuales.totalHorasExtra} h (${informeDatosActuales.dineroExtra} €)
💰 TOTAL MENSUAL: ${informeDatosActuales.totalDinero} €`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Informe Mensual - ${informeDatosActuales.mes}`,
        text: textoInforme
      });
      return;
    } catch (err) {
      console.log("Compartir cancelado o no disponible por API nativa");
    }
  }

  const confirmarPdf = confirm("¿Deseas descargar/imprimir este informe en PDF?\n\n(También puedes copiar los datos al portapapeles)");
  if (confirmarPdf) {
    window.print();
  } else {
    navigator.clipboard.writeText(textoInforme);
    alert("¡Informe copiado al portapapeles!");
  }
});

btnVolver.addEventListener("click", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const uidTrabajadorParam = urlParams.get("uid");

  if (uidTrabajadorParam) {
    // Si hay un UID en la URL, significa que entró un empresario, por lo que volvemos al panel de gestión
    window.location.href = "empresario.html";
  } else {
    // Si no, es el propio trabajador volviendo a su panel de fichaje
    window.location.href = "fichar.html";
  }
});
