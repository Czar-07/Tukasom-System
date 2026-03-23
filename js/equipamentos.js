import { db } from "./firebase.js";
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    collection
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   ESTADO GLOBAL
========================================================= */
let grafCat = null;
let grafUtil = null;

const HORAS_ATRASO = 24;

/* =========================================================
   UTILITÁRIOS
========================================================= */
function usuarioEhAdmin() {
    return window.isAdmin === true;
}

function escaparTexto(texto) {
    return String(texto ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, " ");
}

function fecharModalPorId(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
}

function corCategoria(categoria) {
    switch (String(categoria).toUpperCase()) {
        case "ÁUDIO":
            return "#3498db";
        case "VÍDEO":
            return "#e74c3c";
        case "LUZ":
            return "#f1c40f";
        default:
            return "#95a5a6";
    }
}

function formatarDataBR(valor) {
    if (!valor) return "-";

    const data = valor?.toDate ? valor.toDate() : new Date(valor);
    if (isNaN(data)) return "-";

    return data.toLocaleString("pt-BR");
}

function calcularAtraso(ultimaSaida) {
    if (!ultimaSaida) return null;

    const data = ultimaSaida?.toDate ? ultimaSaida.toDate() : new Date(ultimaSaida);
    if (isNaN(data)) return null;

    const agora = new Date();
    const diffMs = agora - data;
    const diffHoras = diffMs / (1000 * 60 * 60);

    if (diffHoras < HORAS_ATRASO) return null;

    if (diffHoras < 48) return `${Math.floor(diffHoras)}h`;
    return `${Math.floor(diffHoras / 24)} dia(s)`;
}

function statusColor(status) {
    switch (status) {
        case "DISPONIVEL":
            return "green";
        case "MANUTENÇÃO":
            return "orange";
        case "DESATIVADO":
            return "#64748b";
        default:
            return "red";
    }
}

/* =========================================================
   MODAL DE CADASTRO / EDIÇÃO
========================================================= */
export function abrirModal(id) {
    if (!usuarioEhAdmin()) return;

    const modal = document.getElementById("modalCadastro");
    if (!modal) return;

    modal.style.display = "flex";

    const inputId = document.getElementById("modalID");
    const inputNome = document.getElementById("modalNome");

    if (inputId) inputId.value = id || "";
    inputNome?.focus();
}

window.prepararEdicao = function (id, nome, categoria, status, pessoa, evento) {
    if (!usuarioEhAdmin()) return;

    abrirModal(id);

    const modalNome = document.getElementById("modalNome");
    const modalCategoria = document.getElementById("modalCategoria");
    const modalStatus = document.getElementById("modalStatus");
    const modalPessoa = document.getElementById("modalPessoa");
    const modalEvento = document.getElementById("modalEvento");

    if (modalNome) modalNome.value = nome || "";
    if (modalCategoria) modalCategoria.value = categoria || "Outros";
    if (modalStatus) modalStatus.value = status || "DISPONIVEL";
    if (modalPessoa) modalPessoa.value = pessoa && pessoa !== "—" ? pessoa : "";
    if (modalEvento) modalEvento.value = evento && evento !== "—" ? evento : "";
};

/* =========================================================
   MODAIS DE STATUS
========================================================= */
window.prepararManutencao = function (id, nome) {
    if (!usuarioEhAdmin()) return;

    const modal = document.getElementById("modalManutencao");
    const campoId = document.getElementById("idEquipManut");
    const campoNome = document.getElementById("nomeEquipManut");

    if (modal) modal.style.display = "flex";
    if (campoId) campoId.value = id;
    if (campoNome) campoNome.innerText = nome || "";
};

window.prepararRetiradaManut = function (id, nome) {
    if (!usuarioEhAdmin()) return;

    const modal = document.getElementById("modalRetirarManut");
    const campoId = document.getElementById("idEquipRetirar");
    const campoNome = document.getElementById("nomeEquipRetirar");

    if (modal) modal.style.display = "flex";
    if (campoId) campoId.value = id;
    if (campoNome) campoNome.innerText = nome || "";
};

window.prepararDesativacao = function (id, nome) {
    if (!usuarioEhAdmin()) return;

    const modal = document.getElementById("modalDesativacao");
    const campoId = document.getElementById("idEquipDesativar");
    const campoNome = document.getElementById("nomeEquipDesativar");
    const motivo = document.getElementById("motivoDesativacao");
    const observacao = document.getElementById("observacaoDesativacao");

    if (modal) modal.style.display = "flex";
    if (campoId) campoId.value = id;
    if (campoNome) campoNome.innerText = nome || "";
    if (motivo) motivo.value = "DEFEITO";
    if (observacao) observacao.value = "";
};

/* =========================================================
   ACESSO AO BANCO
========================================================= */
export async function garantirEquipamento(id) {
    const ref = doc(db, "equipamentos", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        if (usuarioEhAdmin()) abrirModal(id);
        return false;
    }

    return true;
}

export async function salvarEquipamento(id, nome, categoria, status) {
    if (!usuarioEhAdmin()) return;

    const ref = doc(db, "equipamentos", id);
    const snap = await getDoc(ref);

    const atual = snap.exists() ? snap.data() : {};
    const ehNovo = !snap.exists();
    const statusAntigo = atual.status || null;

    const pessoaInput = document.getElementById("modalPessoa")?.value?.trim() || "";
    const eventoInput = document.getElementById("modalEvento")?.value?.trim() || "";

    let pessoa = pessoaInput || atual.pessoa || "—";
    let evento = eventoInput || atual.evento || "—";

    if (status === "DISPONIVEL" || status === "DESATIVADO") {
        pessoa = "—";
        evento = "—";
    }

    if (status === "MANUTENÇÃO") {
        pessoa = "LABORATÓRIO";
        evento = "—";
    }

    const payload = {
        equipamentoID: id,
        nome,
        categoria,
        status: status || "DISPONIVEL",
        pessoa,
        evento,
        ultimaAtualizacao: new Date()
    };

    if (status === "EM USO" && !atual.ultimaSaida) {
        payload.ultimaSaida = new Date();
    }

    if (
        status === "DISPONIVEL" ||
        status === "MANUTENÇÃO" ||
        status === "DESATIVADO"
    ) {
        payload.ultimaSaida = null;
    }

    await setDoc(ref, payload, { merge: true });

    const { registrarHistoricoManual } = await import("./movimentacoes.js");

    if (ehNovo) {
        await registrarHistoricoManual(id, nome, payload.status, {
            pessoa: payload.pessoa,
            evento: payload.evento
        });
    } else if (statusAntigo && statusAntigo !== payload.status) {
        await registrarHistoricoManual(id, nome, payload.status, {
            pessoa: payload.pessoa,
            evento: payload.evento
        });
    }

    fecharModalPorId("modalCadastro");
}

/* =========================================================
   AÇÕES DOS BOTÕES
========================================================= */
function configurarBotaoManutencao() {
    const btn = document.getElementById("confirmarManutBtn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!usuarioEhAdmin()) return;

        const id = document.getElementById("idEquipManut")?.value;
        const nome = document.getElementById("nomeEquipManut")?.innerText || "";
        const ref = doc(db, "equipamentos", id);

        await setDoc(ref, {
            status: "MANUTENÇÃO",
            pessoa: "LABORATÓRIO",
            evento: "—",
            ultimaSaida: null,
            ultimaAtualizacao: new Date()
        }, { merge: true });

        const { registrarHistoricoManual } = await import("./movimentacoes.js");
        await registrarHistoricoManual(id, nome, "MANUTENÇÃO", {
            pessoa: "LABORATÓRIO",
            evento: "—"
        });

        fecharModalPorId("modalManutencao");
    };
}

function configurarBotaoRetiradaManutencao() {
    const btn = document.getElementById("confirmarRetiradaBtn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!usuarioEhAdmin()) return;

        const id = document.getElementById("idEquipRetirar")?.value;
        const nome = document.getElementById("nomeEquipRetirar")?.innerText || "";
        const ref = doc(db, "equipamentos", id);

        await setDoc(ref, {
            status: "DISPONIVEL",
            pessoa: "—",
            evento: "—",
            ultimaSaida: null,
            ultimaAtualizacao: new Date()
        }, { merge: true });

        const { registrarHistoricoManual } = await import("./movimentacoes.js");
        await registrarHistoricoManual(id, nome, "DISPONIVEL", {
            pessoa: "—",
            evento: "—"
        });

        fecharModalPorId("modalRetirarManut");
    };
}

function configurarBotaoDesativacao() {
    const btn = document.getElementById("confirmarDesativacaoBtn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!usuarioEhAdmin()) return;

        const id = document.getElementById("idEquipDesativar")?.value;
        const nome = document.getElementById("nomeEquipDesativar")?.innerText || "";
        const motivo = document.getElementById("motivoDesativacao")?.value || "DEFEITO";
        const observacao =
            document.getElementById("observacaoDesativacao")?.value?.trim() || "—";

        const ref = doc(db, "equipamentos", id);

        await setDoc(ref, {
            status: "DESATIVADO",
            pessoa: "—",
            evento: "—",
            ultimaSaida: null,
            motivoDesativacao: motivo,
            observacaoDesativacao: observacao,
            desativadoEm: new Date(),
            ultimaAtualizacao: new Date()
        }, { merge: true });

        const { registrarHistoricoManual } = await import("./movimentacoes.js");
        await registrarHistoricoManual(id, nome, "DESATIVADO", {
            motivoDesativacao: motivo,
            observacaoDesativacao: observacao,
            pessoa: "—",
            evento: "—"
        });

        fecharModalPorId("modalDesativacao");
    };
}

/* =========================================================
   RENDERIZAÇÃO DE AÇÕES
========================================================= */
function renderizarAcoesEquipamento(id, data, categoria, status) {
    if (!usuarioEhAdmin()) return "";

    const nome = escaparTexto(data.nome);
    const pessoa = escaparTexto(data.pessoa || "");
    const evento = escaparTexto(data.evento || "");
    const categoriaSegura = escaparTexto(categoria);
    const statusSeguro = escaparTexto(status);

    return `
        <button
            class="btn btn-icon btn-primary"
            onclick="prepararEdicao('${id}', '${nome}', '${categoriaSegura}', '${statusSeguro}', '${pessoa}', '${evento}')"
        >
            ✏️
        </button>

        ${status !== "MANUTENÇÃO" && status !== "DESATIVADO" ? `
            <button
                class="btn btn-icon btn-warning"
                onclick="prepararManutencao('${id}', '${nome}')"
            >
                🛠️
            </button>
        ` : ""}

        ${status !== "DESATIVADO" ? `
            <button
                class="btn btn-icon btn-danger"
                onclick="prepararDesativacao('${id}', '${nome}')"
            >
                ⛔
            </button>
        ` : ""}
    `;
}

function renderizarAcaoManutencao(id, nome) {
    if (!usuarioEhAdmin()) return "";

    return `
        <button
            class="btn btn-success"
            onclick="prepararRetiradaManut('${id}', '${escaparTexto(nome)}')"
        >
            ✔ Concluir
        </button>
    `;
}

/* =========================================================
   RENDERIZAÇÃO PRINCIPAL
========================================================= */
export function escutarEquipamentos() {
    const tbodyEquip = document.getElementById("equipTable");
    const tbodyManut = document.getElementById("manutTable");
    const tbodyDesativados = document.getElementById("desativadosTable");
    const tbodyAtrasos = document.getElementById("listaAtrasos");

    onSnapshot(collection(db, "equipamentos"), (snapshot) => {
        if (tbodyEquip) tbodyEquip.innerHTML = "";
        if (tbodyManut) tbodyManut.innerHTML = "";
        if (tbodyDesativados) tbodyDesativados.innerHTML = "";
        if (tbodyAtrasos) tbodyAtrasos.innerHTML = "";

        let total = 0;
        let disponivel = 0;
        let uso = 0;
        let manut = 0;
        let desativado = 0;
        let atrasados = 0;

        const categoriasContagem = {};

        const docsOrdenados = snapshot.docs.sort((a, b) => {
            const dadosA = a.data();
            const dadosB = b.data();

            const categoriaA = (dadosA.categoria || "").toLowerCase();
            const categoriaB = (dadosB.categoria || "").toLowerCase();
            const nomeA = (dadosA.nome || "").toLowerCase();
            const nomeB = (dadosB.nome || "").toLowerCase();

            if (categoriaA !== categoriaB) {
                return categoriaA.localeCompare(categoriaB, "pt-BR");
            }

            return nomeA.localeCompare(nomeB, "pt-BR");
        });

        docsOrdenados.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            const status = data.status || "DISPONIVEL";
            const categoria = data.categoria || "Outros";
            const pessoaAtual = String(data.pessoa || "").trim() || "—";
            const eventoAtual = String(data.evento || "").trim() || "—";

            total++;

            if (status === "DISPONIVEL") disponivel++;
            else if (status === "EM USO") uso++;
            else if (status === "MANUTENÇÃO") manut++;
            else if (status === "DESATIVADO") desativado++;

            categoriasContagem[categoria] = (categoriasContagem[categoria] || 0) + 1;

            if (status === "MANUTENÇÃO" && tbodyManut) {
                tbodyManut.insertAdjacentHTML("beforeend", `
                    <tr>
                        <td>${data.equipamentoID || id}</td>
                        <td>${data.nome || "—"}</td>
                        <td style="color:${corCategoria(categoria)}; font-weight:bold;">${categoria}</td>
                        <td>${pessoaAtual === "—" ? "LABORATÓRIO" : pessoaAtual}</td>
                        <td>
                            <span class="status manut">${status}</span>
                            ${renderizarAcaoManutencao(id, data.nome)}
                        </td>
                    </tr>
                `);
            }

            if (status === "DESATIVADO" && tbodyDesativados) {
                tbodyDesativados.insertAdjacentHTML("beforeend", `
                    <tr>
                        <td>${data.equipamentoID || id}</td>
                        <td>${data.nome || "—"}</td>
                        <td style="color:${corCategoria(categoria)}; font-weight:bold;">${categoria}</td>
                        <td>${data.motivoDesativacao || "—"}</td>
                        <td>${data.observacaoDesativacao || "—"}</td>
                        <td>${formatarDataBR(data.desativadoEm)}</td>
                    </tr>
                `);
            }

            if (status === "EM USO") {
                const atraso = calcularAtraso(data.ultimaSaida);

                if (atraso) {
                    atrasados++;

                    if (tbodyAtrasos) {
                        tbodyAtrasos.insertAdjacentHTML("beforeend", `
                            <tr>
                                <td>${data.equipamentoID || id}</td>
                                <td>${data.nome || "—"}</td>
                                <td>${pessoaAtual}</td>
                                <td>${eventoAtual}</td>
                                <td>${formatarDataBR(data.ultimaSaida)}</td>
                                <td><span class="atraso-tag">${atraso}</span></td>
                            </tr>
                        `);
                    }
                }
            }

            if (tbodyEquip) {
                tbodyEquip.insertAdjacentHTML("beforeend", `
                    <tr>
                        <td>${data.equipamentoID || id}</td>
                        <td>${data.nome || "—"}</td>
                        <td style="color:${corCategoria(categoria)}; font-weight:bold;">${categoria}</td>
                        <td style="color:${statusColor(status)}; font-weight:bold;">${status}</td>
                        <td>${pessoaAtual}</td>
                        <td style="color:#3b82f6; font-weight:bold;">${eventoAtual}</td>
                        <td>${renderizarAcoesEquipamento(id, data, categoria, status)}</td>
                    </tr>
                `);
            }
        });

        atualizarCardsDashboard({
            total,
            disponivel,
            uso,
            manut,
            atrasados
        });

        preencherEstadosVazios({
            tbodyAtrasos,
            tbodyDesativados,
            tbodyManut
        });

        renderizarGraficosEstado(
            categoriasContagem,
            disponivel,
            uso,
            manut,
            atrasados,
            desativado
        );
    });
}

function atualizarCardsDashboard({ total, disponivel, uso, manut, atrasados }) {
    const elTotal = document.getElementById("totalEquip");
    const elDisp = document.getElementById("dispEquip");
    const elUso = document.getElementById("usoEquip");
    const elManut = document.getElementById("manutEquip");
    const elAtraso = document.getElementById("atrasoEquip");

    if (elTotal) elTotal.innerText = total;
    if (elDisp) elDisp.innerText = disponivel;
    if (elUso) elUso.innerText = uso;
    if (elManut) elManut.innerText = manut;
    if (elAtraso) elAtraso.innerText = atrasados;
}

function preencherEstadosVazios({ tbodyAtrasos, tbodyDesativados, tbodyManut }) {
    if (tbodyAtrasos && tbodyAtrasos.innerHTML.trim() === "") {
        tbodyAtrasos.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">Nenhum equipamento em atraso.</td>
            </tr>
        `;
    }

    if (tbodyDesativados && tbodyDesativados.innerHTML.trim() === "") {
        tbodyDesativados.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">Nenhum equipamento desativado.</td>
            </tr>
        `;
    }

    if (tbodyManut && tbodyManut.innerHTML.trim() === "") {
        tbodyManut.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">Nenhum equipamento em manutenção.</td>
            </tr>
        `;
    }
}

/* =========================================================
   GRÁFICOS
========================================================= */
function renderizarGraficosEstado(categorias, disponivel, uso, manut, atrasados, desativado) {
    const canvasCategoria = document.getElementById("graficoCategoria");
    const canvasUtilizacao = document.getElementById("graficoUtilizacao");

    if (!canvasCategoria || !canvasUtilizacao || !window.Chart) return;

    const ChartJS = window.Chart;

    if (grafCat) grafCat.destroy();
    grafCat = new ChartJS(canvasCategoria.getContext("2d"), {
        type: "bar",
        data: {
            labels: Object.keys(categorias),
            datasets: [{
                label: "Quantidade",
                data: Object.values(categorias),
                backgroundColor: "#3498db"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    if (grafUtil) grafUtil.destroy();
    grafUtil = new ChartJS(canvasUtilizacao.getContext("2d"), {
        type: "doughnut",
        data: {
            labels: ["Disponível", "Em Uso", "Manutenção", "Atrasados", "Desativados"],
            datasets: [{
                data: [disponivel, uso, manut, atrasados, desativado],
                backgroundColor: ["#22c55e", "#ef4444", "#f59e0b", "#06b6d4", "#64748b"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
configurarBotaoManutencao();
configurarBotaoRetiradaManutencao();
configurarBotaoDesativacao();