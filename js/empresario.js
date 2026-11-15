import { db, auth } from "./firebase-config.js";
import {
  doc, getDoc, getDocs, collection, query, where, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

const nombreEmpresarioEl = document.getElementById("nombreEmpresario");
const btnLogoutEmpresa = document.getElementById("btnLogoutEmpresa");
const vincularForm = document.getElementById("vincularForm");
const inputCodigoTrabajador = document.getElementById("inputCodigoTrabajador");
const listaTrabajadoresEl = document.getElementById("listaTrabajadores");

let usuarioActual = null;

// Inicialización segura del panel de empresario
async function inicializarEmpresario() {
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

    // Verificamos que el usuario tenga rol de empresario en su documento
    const userDocRef = doc(db, "usuarios", usuarioActual.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists() || userDoc.data().rol !== "empresario") {
      alert("Acceso no autorizado. Esta área es exclusiva para empresarios.");
      window.location.href = "fichar.html";
      return;
    }

    const dataEmpresa = userDoc.data();
    nombreEmpresarioEl.textContent = dataEmpresa.nombre || usuarioActual.email;

    // Cargamos los trabajadores que han dado consentimiento a este empresario
    await cargarTrabajadoresVinculados();

  } catch (error) {
    console.error("Error al inicializar el panel de empresario:", error);
  }
}

inicializarEmpresario();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  }
});

// Vincular nuevo trabajador mediante su código de acceso
vincularForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const codigoBuscado = inputCodigoTrabajador.value.trim().toUpperCase();
  if (!codigoBuscado) return;

  try {
    // Buscamos en la colección 'usuarios' qué trabajador tiene este código de vinculación
    const q = query(collection(db, "usuarios"), where("codigoVinculacion", "==", codigoBuscado));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("Código de vinculación no válido o trabajador no encontrado.");
      return;
    }

    let trabajadorDocRef = null;
    let trabajadorNombre = "";

    querySnapshot.forEach((docSnap) => {
      trabajadorDocRef = docSnap.ref;
      trabajadorNombre = docSnap.data().nombre || docSnap.data().email;
    });

    // Añadimos el UID del empresario actual al array 'empresariosAutorizados' del trabajador
    await updateDoc(trabajadorDocRef, {
      empresariosAutorizados: arrayUnion(usuarioActual.uid)
    });

    alert(`¡Trabajador "${trabajadorNombre}" vinculado con éxito!`);
    inputCodigoTrabajador.value = "";

    // Recargamos la lista
    await cargarTrabajadoresVinculados();

  } catch (error) {
    alert("Error al vincular al trabajador: " + error.message);
  }
});

// Función para obtener y listar los trabajadores que han autorizado a este empresario
async function cargarTrabajadoresVinculados() {
  try {
    const q = query(
      collection(db, "usuarios"),
      where("empresariosAutorizados", "array-contains", usuarioActual.uid)
    );

    const querySnapshot = await getDocs(q);
    listaTrabajadoresEl.innerHTML = "";

    if (querySnapshot.empty) {
      listaTrabajadoresEl.innerHTML = `
        <p style="color: var(--muted); font-size: 0.85rem; text-align: center; padding: 15px; background: rgba(255,255,255,0.02); border-radius: 8px;">
          No tienes ningún trabajador vinculado todavía. Introduce un código arriba para empezar.
        </p>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const trabajador = docSnap.data();
      const trabajadorId = docSnap.id;

      const tarjeta = document.createElement("div");
      tarjeta.style.cssText = "background: rgba(255,255,255,0.05); padding: 12px 15px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.1);";

      tarjeta.innerHTML = `
        <div style="flex: 1; min-width: 0; overflow: hidden;">
          <strong style="display: block; font-size: 0.95rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${trabajador.nombre || "Sin nombre"}</strong>
          <span style="font-size: 0.75rem; color: var(--muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${trabajador.email || ""}</span>
        </div>
        <button class="btnVerInforme" data-uid="${trabajadorId}" style="background: #1976d2; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: bold; flex-shrink: 0;">Ver Informe</button>
      `;

      listaTrabajadoresEl.appendChild(tarjeta);
    });

    // Añadir eventos a los botones de "Ver Informe" con redirección al informe pasando el UID
    document.querySelectorAll(".btnVerInforme").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const uidTrabajador = e.target.getAttribute("data-uid");
        window.location.href = `informe.html?uid=${uidTrabajador}`;
      });
    });

  } catch (error) {
    console.error("Error al cargar trabajadores vinculados:", error);
    listaTrabajadoresEl.innerHTML = `<p style="color: #ff5252; font-size: 0.85rem; text-align: center;">Error al cargar los datos autorizados.</p>`;
  }
}

// Botón de cerrar sesión
btnLogoutEmpresa.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
});
