import { db, auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// Elementos del DOM
const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");
const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const regCompanySelect = document.getElementById("regCompanySelect");
const newCompanyGroup = document.getElementById("newCompanyGroup");

// --- INTERCAMBIO VISUAL LOGIN / REGISTRO ---
showRegister.addEventListener("click", () => {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
  cargarEmpresas();
});

showLogin.addEventListener("click", () => {
  registerView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

// Mostrar u ocultar input de nueva empresa
regCompanySelect.addEventListener("change", (e) => {
  if (e.target.value === "nueva") {
    newCompanyGroup.classList.remove("hidden");
  } else {
    newCompanyGroup.classList.add("hidden");
  }
});

// --- CARGAR EMPRESAS DESDE FIRESTORE ---
async function cargarEmpresas() {
  try {
    const querySnapshot = await getDocs(collection(db, "empresas"));
    regCompanySelect.innerHTML = '<option value="">Selecciona una empresa...</option>';

    querySnapshot.forEach((docSnap) => {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = docSnap.data().nombre;
      regCompanySelect.appendChild(opt);
    });

    const optNueva = document.createElement("option");
    optNueva.value = "nueva";
    optNueva.textContent = "➕ Añadir nueva empresa...";
    regCompanySelect.appendChild(optNueva);
  } catch (error) {
    console.error("Error al cargar empresas:", error);
  }
}

// --- GESTIÓN DE INICIO DE SESIÓN (LOGIN) ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, pass);
    await redirigirSegunRol(userCred.user.uid);
  } catch (error) {
    alert("Error al iniciar sesión: " + error.message);
  }
});

// --- GESTIÓN DE REGISTRO ---
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value;
  const pass = document.getElementById("regPassword").value;
  const confirmPass = document.getElementById("regConfirmPassword").value; // NUEVO
  const role = document.getElementById("regRole").value;
  let companyId = regCompanySelect.value;
  const newCompanyName = document.getElementById("regNewCompanyName").value.trim();

  try {
    // NUEVO: Comprobar que las contraseñas coinciden
    if (pass !== confirmPass) {
      alert("Las contraseñas no coinciden. Por favor, revísalas.");
      return;
    }

    if (!companyId) {
      alert("Por favor, selecciona o crea una empresa.");
      return;
    }

    // 1. Crear usuario en Firebase Auth
    const userCred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = userCred.user.uid;

    // 2. Si es una empresa nueva, crearla en Firestore
    if (companyId === "nueva") {
      if (!newCompanyName) {
        alert("Debes escribir el nombre de la nueva empresa.");
        return;
      }
      const nuevaEmpresaRef = await addDoc(collection(db, "empresas"), {
        nombre: newCompanyName,
        creadaPor: uid
      });
      companyId = nuevaEmpresaRef.id;

      // Crear configuración inicial predeterminada para esta empresa
      await setDoc(doc(db, "configuracion", companyId), {
        sueldoMinimoDia: 95.00,
        horasMinimasSueldo: 6.0,
        precioHoraNormal: 15.83,
        precioHoraExtra: 15.83,
        plusBuceo: 30.00
      });
    }

    // 3. Guardar el perfil en la colección 'usuarios'
    await setDoc(doc(db, "usuarios", uid), {
      nombre: name,
      email: email,
      rol: role,
      empresaId: companyId
    });

    alert("¡Cuenta creada correctamente!");
    await redirigirSegunRol(uid);

  } catch (error) {
    alert("Error en el registro: " + error.message);
  }
});

// --- REDIRECCIÓN INTELIGENTE SEGÚN ROL ---
async function redirigirSegunRol(uid) {
  const userDoc = await getDoc(doc(db, "usuarios", uid));
  if (userDoc.exists()) {
    const userData = userDoc.data();
    if (userData.rol === "empresario") {
      window.location.href = "empresario.html";
    } else {
      window.location.href = "fichar.html";
    }
  } else {
    alert("No se encontró el perfil del usuario en la base de datos.");
  }
}
