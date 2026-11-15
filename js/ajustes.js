import { db, auth } from "./firebase-config.js";
import { doc, getDoc, setDoc, getDocs, collection, addDoc } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const inputEmail = document.getElementById("inputEmail");
const inputNombre = document.getElementById("inputNombre");
const ajustesCompanySelect = document.getElementById("ajustesCompanySelect");
const ajustesNewCompanyGroup = document.getElementById("ajustesNewCompanyGroup");
const ajustesNewCompanyName = document.getElementById("ajustesNewCompanyName");

const inputPrecioHora = document.getElementById("inputPrecioHora");
const inputPrecioHoraExtra = document.getElementById("inputPrecioHoraExtra");
const inputBaseHoras = document.getElementById("inputBaseHoras");
const inputPrecioBuceo = document.getElementById("inputPrecioBuceo");

// Elementos de la nueva tarjeta de código para empresario
const inputCodigoVinculacion = document.getElementById("inputCodigoVinculacion");
const btnCopiarCodigo = document.getElementById("btnCopiarCodigo");

const ajustesForm = document.getElementById("ajustesForm");
const btnVolver = document.getElementById("btnVolver");

let usuarioActual = null;

// Función para generar un código único legible (Ej: ABC-1234)
function generarCodigoAleatorio() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";
  let parteLetras = "";
  let parteNumeros = "";
  for (let i = 0; i < 3; i++) parteLetras += letras.charAt(Math.floor(Math.random() * letras.length));
  for (let i = 0; i < 4; i++) parteNumeros += numeros.charAt(Math.floor(Math.random() * numeros.length));
  return `${parteLetras}-${parteNumeros}`;
}

// Mostrar u ocultar input de nueva empresa según selección
ajustesCompanySelect.addEventListener("change", (e) => {
  if (e.target.value === "nueva") {
    ajustesNewCompanyGroup.classList.remove("hidden");
  } else {
    ajustesNewCompanyGroup.classList.add("hidden");
  }
});

// Cargar empresas desde Firestore y preseleccionar la actual
async function cargarEmpresasEnAjustes(empresaActualId) {
  try {
    const querySnapshot = await getDocs(collection(db, "empresas"));
    ajustesCompanySelect.innerHTML = '<option value="">Selecciona una empresa...</option>';

    querySnapshot.forEach((docSnap) => {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = docSnap.data().nombre;
      if (docSnap.id === empresaActualId) {
        opt.selected = true;
      }
      ajustesCompanySelect.appendChild(opt);
    });

    const optNueva = document.createElement("option");
    optNueva.value = "nueva";
    optNueva.textContent = "➕ Añadir nueva empresa...";
    ajustesCompanySelect.appendChild(optNueva);
  } catch (error) {
    console.error("Error al cargar empresas:", error);
  }
}

// Inicializar ajustes cargando perfil de Firestore
async function inicializarAjustes() {
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

    inputEmail.value = usuarioActual.email || "";

    const userDocRef = doc(db, "usuarios", usuarioActual.uid);
    const userDoc = await getDoc(userDocRef);

    let empresaIdGuardada = "";
    let codigoVinculacion = "";

    if (userDoc.exists()) {
      const data = userDoc.data();
      inputNombre.value = data.nombre || "";
      empresaIdGuardada = data.empresaId || "";
      codigoVinculacion = data.codigoVinculacion || "";

      // Cargar tarifas guardadas o valores por defecto
      inputPrecioHora.value = data.precioHora !== undefined ? data.precioHora : 15.83;
      inputPrecioHoraExtra.value = data.precioHoraExtra !== undefined ? data.precioHoraExtra : 15.83;
      inputBaseHoras.value = data.baseHoras !== undefined ? data.baseHoras : 6;
      inputPrecioBuceo.value = data.precioBuceo !== undefined ? data.precioBuceo : 30;
    } else {
      inputPrecioHora.value = 15.83;
      inputPrecioHoraExtra.value = 15.83;
      inputBaseHoras.value = 6;
      inputPrecioBuceo.value = 30;
    }

    // Si el usuario no tiene código de vinculación asignado, se lo generamos y guardamos al vuelo
    if (!codigoVinculacion) {
      codigoVinculacion = generarCodigoAleatorio();
      await setDoc(userDocRef, {
        codigoVinculacion: codigoVinculacion,
        rol: "trabajador"
      }, { merge: true });
    }

    // Mostrar el código en su respectivo input
    if (inputCodigoVinculacion) {
      inputCodigoVinculacion.value = codigoVinculacion;
    }

    // Cargar el desplegable de empresas seleccionando la del usuario
    await cargarEmpresasEnAjustes(empresaIdGuardada);

  } catch (error) {
    console.error("Error al cargar los ajustes:", error);
  }
}

inicializarAjustes();

// Copiar código de vinculación al portapapeles
if (btnCopiarCodigo) {
  btnCopiarCodigo.addEventListener("click", () => {
    if (!inputCodigoVinculacion.value || inputCodigoVinculacion.value === "Generando...") return;

    navigator.clipboard.writeText(inputCodigoVinculacion.value);
    const textoOriginal = btnCopiarCodigo.textContent;
    btnCopiarCodigo.textContent = "¡Copiado!";
    setTimeout(() => {
      btnCopiarCodigo.textContent = textoOriginal;
    }, 2000);
  });
}

// Guardar cambios en Firestore
ajustesForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioActual) return;

  let companyId = ajustesCompanySelect.value;
  const newCompanyName = ajustesNewCompanyName.value.trim();

  if (!companyId) {
    alert("Por favor, selecciona o crea una empresa.");
    return;
  }

  try {
    // Si seleccionó "nueva", crearla en la colección 'empresas' de Firestore
    if (companyId === "nueva") {
      if (!newCompanyName) {
        alert("Debes escribir el nombre de la nueva empresa.");
        return;
      }
      const nuevaEmpresaRef = await addDoc(collection(db, "empresas"), {
        nombre: newCompanyName,
        creadaPor: usuarioActual.uid
      });
      companyId = nuevaEmpresaRef.id;

      // Crear configuración inicial predeterminada para esta nueva empresa
      await setDoc(doc(db, "configuracion", companyId), {
        sueldoMinimoDia: 95.00,
        horasMinimasSueldo: 6.0,
        precioHoraNormal: parseFloat(inputPrecioHora.value) || 15.83,
        precioHoraExtra: parseFloat(inputPrecioHoraExtra.value) || 15.83,
        plusBuceo: parseFloat(inputPrecioBuceo.value) || 30.00
      });
    }

    const userDocRef = doc(db, "usuarios", usuarioActual.uid);

    const datosActualizados = {
      nombre: inputNombre.value.trim(),
      empresaId: companyId,
      precioHora: parseFloat(inputPrecioHora.value) || 15.83,
      precioHoraExtra: parseFloat(inputPrecioHoraExtra.value) || 15.83,
      baseHoras: parseInt(inputBaseHoras.value) || 6,
      precioBuceo: parseFloat(inputPrecioBuceo.value) || 30
    };

    await setDoc(userDocRef, datosActualizados, { merge: true });

    alert("¡Ajustes, empresa y tarifas guardados correctamente!");
  } catch (error) {
    alert("Error al guardar los cambios: " + error.message);
  }
});

// Botón de retorno al panel de fichaje
btnVolver.addEventListener("click", () => {
  window.location.href = "fichar.html";
});
