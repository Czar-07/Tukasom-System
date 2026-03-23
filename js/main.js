import {
  garantirEquipamento,
  salvarEquipamento,
  escutarEquipamentos
} from "./equipamentos.js";

import {
  registrarMovimento,
  escutarHistorico
} from "./movimentacoes.js";

import { escutarEventos } from "./eventos.js";
import { iniciarScanner } from "./scanner.js";
import { auth, ADMIN_EMAILS } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================================================
   ESTADO GLOBAL
========================================================= */
window.isAdmin = false;

let authInicializado = false;
let ultimoUid = null;

/* =========================================================
   UTILITÁRIOS
========================================================= */
function $(id) {
  return document.getElementById(id);
}

function usuarioEhAdmin() {
  return window.isAdmin === true;
}

/* =========================================================
   LOGIN / MODAL
========================================================= */
function abrirModalLogin() {
  const modal = $("modalLogin");
  if (modal) modal.style.display = "flex";
}

function fecharModalLogin() {
  const modal = $("modalLogin");
  if (modal) modal.style.display = "none";
}

function mostrarErroLogin(mensagem) {
  const el = $("loginErro");
  if (!el) return;
  el.style.display = "block";
  el.textContent = mensagem;
}

function limparErroLogin() {
  const el = $("loginErro");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */
function abrirModalConfiguracoes() {
  if (!usuarioEhAdmin()) return;

  const modal = $("modalConfiguracoes");
  if (modal) modal.style.display = "flex";

  carregarConfiguracoesUI();
}

function carregarConfiguracoesUI() {
  const empresa = localStorage.getItem("config_empresa") || "Tukasom";
  const horasAtraso = localStorage.getItem("config_horas_atraso") || "24";
  const tema = localStorage.getItem("config_tema_padrao") || "light";
  const sidebar = localStorage.getItem("config_sidebar_modo") || "default";

  if ($("configEmpresa")) $("configEmpresa").value = empresa;
  if ($("configHorasAtraso")) $("configHorasAtraso").value = horasAtraso;
  if ($("configTema")) $("configTema").value = tema;
  if ($("configModoSidebar")) $("configModoSidebar").value = sidebar;
}

function salvarConfiguracoesSistema() {
  if (!usuarioEhAdmin()) return;

  const empresa = $("configEmpresa")?.value.trim() || "Tukasom";
  const horasAtraso = $("configHorasAtraso")?.value.trim() || "24";
  const tema = $("configTema")?.value || "light";
  const sidebar = $("configModoSidebar")?.value || "default";

  localStorage.setItem("config_empresa", empresa);
  localStorage.setItem("config_horas_atraso", horasAtraso);
  localStorage.setItem("config_tema_padrao", tema);
  localStorage.setItem("config_sidebar_modo", sidebar);

  document.title = `${empresa} Controle`;

  const logoTitulo = document.querySelector(".sidebar h2");
  if (logoTitulo) logoTitulo.textContent = empresa;

  document.body.classList.toggle("sidebar-compact", sidebar === "compact");

  if (tema === "light") {
    document.body.classList.add("light");
    if ($("toggleTheme")) $("toggleTheme").innerText = "☀️";
    localStorage.setItem("theme", "light");
  } else {
    document.body.classList.remove("light");
    if ($("toggleTheme")) $("toggleTheme").innerText = "🌙";
    localStorage.setItem("theme", "dark");
  }

  atualizarLogo();

  const feedback = $("settingsFeedback");
  if (feedback) {
    feedback.style.display = "block";
    feedback.textContent = "Configurações salvas com sucesso.";
  }
}

/* =========================================================
   TEMA / LOGO
========================================================= */
function atualizarLogo() {
  const logo = $("logo");
  if (!logo) return;

  const temaClaroAtivo = document.body.classList.contains("light");

  logo.src = temaClaroAtivo
    ? "assets/logo-TUKASOM-AUDIOSYSTEMS-2.svg"
    : "assets/logo-TUKASOM-AUDIOSYSTEMS-positivo-2.svg";
}

function aplicarTemaSalvo() {
  const btnTheme = $("toggleTheme");
  if (!btnTheme) return;

  const temaSalvo = localStorage.getItem("theme");

  if (!temaSalvo || temaSalvo === "light") {
    document.body.classList.add("light");
    btnTheme.innerText = "☀️";
  } else {
    document.body.classList.remove("light");
    btnTheme.innerText = "🌙";
  }

  const empresaSalva = localStorage.getItem("config_empresa");
  if (empresaSalva) {
    document.title = `${empresaSalva} Controle`;
    const logoTitulo = document.querySelector(".sidebar h2");
    if (logoTitulo) logoTitulo.textContent = empresaSalva;
  }

  const sidebarModoSalvo = localStorage.getItem("config_sidebar_modo");
  document.body.classList.toggle("sidebar-compact", sidebarModoSalvo === "compact");

  atualizarLogo();
}

function configurarTema() {
  const btnTheme = $("toggleTheme");
  if (!btnTheme) return;

  btnTheme.onclick = () => {
    document.body.classList.toggle("light");

    const temaClaroAtivo = document.body.classList.contains("light");

    btnTheme.innerText = temaClaroAtivo ? "☀️" : "🌙";
    localStorage.setItem("theme", temaClaroAtivo ? "light" : "dark");

    atualizarLogo();
  };
}

/* =========================================================
   PERMISSÕES / UI
========================================================= */
function aplicarPermissoes(user) {
  const btnOpenLogin = $("btnOpenLogin");
  const userInfo = $("userInfo");
  const userEmail = $("userEmail");
  const userRoleBadge = $("userRoleBadge");
  const barcodeInput = $("barcodeInput");
  const btnSettings = $("btnOpenSettings");

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email);
  window.isAdmin = isAdmin;

  if (isAdmin) {
    document.body.classList.remove("modo-visitante");

    if (btnOpenLogin) btnOpenLogin.style.display = "none";
    if (userInfo) userInfo.style.display = "flex";
    if (userEmail) userEmail.textContent = user.email || "";

    if (userRoleBadge) {
      userRoleBadge.textContent = "Administrador";
      userRoleBadge.className = "role-badge admin";
    }

    if (barcodeInput) {
      barcodeInput.disabled = false;
      barcodeInput.placeholder = "Escaneie o código";
      barcodeInput.style.display = "block";
    }

    if (btnSettings) btnSettings.style.display = "flex";
    return;
  }

  document.body.classList.add("modo-visitante");

  if (btnOpenLogin) btnOpenLogin.style.display = "inline-flex";
  if (userInfo) userInfo.style.display = "none";
  if (userEmail) userEmail.textContent = "";

  if (userRoleBadge) {
    userRoleBadge.textContent = "Visitante";
    userRoleBadge.className = "role-badge visitante";
  }

  if (barcodeInput) {
    barcodeInput.disabled = true;
    barcodeInput.placeholder = "Acesso restrito";
    barcodeInput.style.display = "none";
  }

  if (btnSettings) btnSettings.style.display = "none";
}

/* =========================================================
   PROCESSAMENTO DE EQUIPAMENTOS
========================================================= */
async function processarEquipamento(id) {
  if (!usuarioEhAdmin()) return;
  if (!id) return;

  const alerta = $("alerta");
  const existe = await garantirEquipamento(id);

  if (!existe) {
    if (alerta) alerta.innerText = "";
    return;
  }

  await registrarMovimento(id);

  if (alerta) {
    alerta.innerText = "Equipamento processado com sucesso!";
  }
}

/* =========================================================
   NAVEGAÇÃO / MODAIS GLOBAIS
========================================================= */
window.mostrarTela = function (id, el) {
  document.querySelectorAll(".tela").forEach((tela) => {
    tela.classList.remove("ativa");
    tela.style.display = "none";
  });

  const telaAtiva = $(id);
  if (telaAtiva) {
    telaAtiva.classList.add("ativa");
    telaAtiva.style.display = "block";
  }

  document.querySelectorAll(".sidebar li").forEach((li) => {
    li.classList.remove("ativo");
  });

  if (el) el.classList.add("ativo");

  if (id === "dash") {
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 100);
  }
};

window.fecharModal = function () {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
  });
};

/* =========================================================
   EVENTOS DE INTERFACE
========================================================= */
function configurarBotaoAbrirLogin() {
  const btnOpenLogin = $("btnOpenLogin");
  if (!btnOpenLogin) return;

  btnOpenLogin.onclick = abrirModalLogin;
}

function configurarBotaoAbrirConfiguracoes() {
  const btnOpenSettings = $("btnOpenSettings");
  if (!btnOpenSettings) return;

  btnOpenSettings.onclick = abrirModalConfiguracoes;
}

function configurarSalvarConfiguracoes() {
  const btnSalvarSettings = $("btnSalvarSettings");
  if (!btnSalvarSettings) return;

  btnSalvarSettings.onclick = salvarConfiguracoesSistema;
}

function configurarLogin() {
  const btnLogin = $("btnLogin");
  if (!btnLogin) return;

  btnLogin.onclick = async () => {
    const email = $("loginEmail")?.value.trim() || "";
    const senha = $("loginSenha")?.value.trim() || "";

    limparErroLogin();

    if (!email || !senha) {
      mostrarErroLogin("Preencha e-mail e senha.");
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);

      if (!ADMIN_EMAILS.includes(cred.user.email)) {
        await signOut(auth);
        mostrarErroLogin("Esta conta não tem permissão de administrador.");
        return;
      }

      fecharModalLogin();

      if ($("loginEmail")) $("loginEmail").value = "";
      if ($("loginSenha")) $("loginSenha").value = "";

      window.location.reload();
    } catch (error) {
      console.error("Erro Firebase Auth:", error.code, error.message);

      switch (error.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
        case "auth/invalid-email":
          mostrarErroLogin("E-mail ou senha inválidos.");
          break;

        case "auth/too-many-requests":
          mostrarErroLogin("Muitas tentativas. Tente novamente mais tarde.");
          break;

        case "auth/network-request-failed":
          mostrarErroLogin("Erro de conexão com a internet.");
          break;

        default:
          mostrarErroLogin(`Erro ao entrar: ${error.code}`);
      }
    }
  };
}

function configurarLogout() {
  const btnLogout = $("btnLogout");
  if (!btnLogout) return;

  btnLogout.onclick = async () => {
    await signOut(auth);
    window.location.reload();
  };
}

function configurarInputScanner() {
  const input = $("barcodeInput");
  if (!input) return;

  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const codigo = input.value.trim();
    input.value = "";

    await processarEquipamento(codigo);
  });
}

function configurarSalvarEquipamento() {
  const btnSalvar = $("salvarEquip");
  if (!btnSalvar) return;

  btnSalvar.onclick = async () => {
    if (!usuarioEhAdmin()) return;

    const id = $("modalID")?.value || "";
    const nome = $("modalNome")?.value.trim() || "";
    const categoria = $("modalCategoria")?.value || "";
    const status = $("modalStatus")?.value || "DISPONIVEL";

    if (!nome || !categoria) return;

    await salvarEquipamento(id, nome, categoria, status);
  };
}

/* =========================================================
   INICIALIZAÇÃO DA APLICAÇÃO
========================================================= */
function iniciarInterface() {
  aplicarTemaSalvo();
  configurarTema();

  configurarBotaoAbrirLogin();
  configurarBotaoAbrirConfiguracoes();
  configurarSalvarConfiguracoes();
  configurarLogin();
  configurarLogout();
  configurarInputScanner();
  configurarSalvarEquipamento();

  iniciarScanner(processarEquipamento);
}

function iniciarEscutas() {
  escutarEquipamentos();
  escutarHistorico();
  escutarEventos();
}

function configurarAutenticacao() {
  onAuthStateChanged(auth, (user) => {
    const uidAtual = user?.uid || null;
    const eraAdmin = window.isAdmin === true;

    aplicarPermissoes(user);

    const agoraAdmin = window.isAdmin === true;

    if (!authInicializado) {
      authInicializado = true;
      ultimoUid = uidAtual;
      return;
    }

    const mudouUsuario = ultimoUid !== uidAtual;
    const mudouPermissao = eraAdmin !== agoraAdmin;

    ultimoUid = uidAtual;

    if (mudouUsuario || mudouPermissao) {
      window.location.reload();
    }
  });
}

/* =========================================================
   BOOT
========================================================= */
window.addEventListener("DOMContentLoaded", () => {
  iniciarInterface();
  iniciarEscutas();
});

configurarAutenticacao();