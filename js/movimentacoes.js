import { db } from "./firebase.js";
import {
    doc,
    updateDoc,
    addDoc,
    collection,
    onSnapshot,
    query,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   ESTADO GLOBAL
========================================================= */
let grafMaisUsados = null;
let grafDesempenho = null;

/* =========================================================
   UTILITÁRIOS
========================================================= */
function usuarioEhAdmin() {
    return window.isAdmin === true;
}

function formatarDataBR(valor) {
    if (!valor) return "-";

    const data = valor?.toDate ? valor.toDate() : new Date(valor);
    if (isNaN(data)) return "-";

    return data.toLocaleString("pt-BR");
}

function obterCorStatus(status) {
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
   MOVIMENTAÇÃO DE EQUIPAMENTOS
========================================================= */
export async function registrarMovimento(id) {
    if (!usuarioEhAdmin()) return;

    const ref = doc(db, "equipamentos", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();
    if (data.status === "DESATIVADO") return;

    const novoStatus = data.status === "DISPONIVEL" ? "EM USO" : "DISPONIVEL";
    const pessoa = novoStatus === "DISPONIVEL" ? "—" : (data.pessoa || "—");
    const evento = novoStatus === "DISPONIVEL" ? "—" : (data.evento || "—");

    await updateDoc(ref, {
        status: novoStatus,
        pessoa,
        evento,
        ultimaSaida: novoStatus === "EM USO" ? new Date() : null,
        ultimaAtualizacao: new Date()
    });

    await addDoc(collection(db, "movimentacoes"), {
        equipamentoID: id,
        nome: data.nome || "—",
        categoria: data.categoria || "Outros",
        status: novoStatus,
        pessoa,
        evento,
        data: new Date()
    });
}

/* =========================================================
   HISTÓRICO MANUAL
========================================================= */
export async function registrarHistoricoManual(id, nome, status, extras = {}) {
    const ref = doc(db, "equipamentos", id);
    const snap = await getDoc(ref);

    let categoria = "Outros";
    let pessoa = "—";
    let evento = "—";

    if (snap.exists()) {
        const dataEquip = snap.data();
        categoria = dataEquip.categoria || "Outros";
        pessoa = dataEquip.pessoa || "—";
        evento = dataEquip.evento || "—";
    }

    if (extras.pessoa !== undefined) {
        pessoa = extras.pessoa || "—";
    }

    if (extras.evento !== undefined) {
        evento = extras.evento || "—";
    }

    if (status === "MANUTENÇÃO") {
        pessoa = "LABORATÓRIO";
        evento = "—";
    }

    if (status === "DISPONIVEL" || status === "DESATIVADO") {
        pessoa = "—";
        evento = "—";
    }

    await addDoc(collection(db, "movimentacoes"), {
        equipamentoID: id,
        nome: nome || "—",
        categoria,
        status,
        pessoa,
        evento,
        data: new Date(),
        ...extras
    });
}

/* =========================================================
   ESCUTA E RENDERIZAÇÃO DO HISTÓRICO
========================================================= */
export function escutarHistorico() {
    const tbody = document.getElementById("historicoTable");
    const inputBusca = document.getElementById("searchHistorico");
    const selectStatus = document.getElementById("filterStatus");

    const consulta = query(
        collection(db, "movimentacoes"),
        orderBy("data", "asc")
    );

    let dadosProcessados = [];

    function renderTabela(lista) {
        if (!tbody) return;

        tbody.innerHTML = "";

        if (lista.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">Nenhum registro encontrado.</td>
                </tr>
            `;
            return;
        }

        lista.forEach((item) => {
            const corStatus = obterCorStatus(item.status);

            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.nome}</td>
                    <td style="color:#666; font-weight:bold;">${item.pessoa}</td>
                    <td style="color:#3b82f6; font-weight:bold;">${item.evento || "—"}</td>
                    <td>${item.saida}</td>
                    <td>${item.entrada}</td>
                    <td style="color:${corStatus}; font-weight:bold;">${item.status}</td>
                </tr>
            `);
        });
    }

    function aplicarFiltro() {
        const busca = (inputBusca?.value || "").toLowerCase().trim();
        const statusFiltro = selectStatus?.value || "";

        const filtrados = dadosProcessados.filter((item) => {
            const matchBusca =
                (item.nome || "").toLowerCase().includes(busca) ||
                (item.pessoa || "").toLowerCase().includes(busca) ||
                (item.evento || "").toLowerCase().includes(busca);

            const matchStatus = !statusFiltro || item.status === statusFiltro;

            return matchBusca && matchStatus;
        });

        renderTabela(filtrados);
    }

    if (!window.filtroHistoricoRegistrado) {
        inputBusca?.addEventListener("input", aplicarFiltro);
        selectStatus?.addEventListener("change", aplicarFiltro);
        window.filtroHistoricoRegistrado = true;
    }

    onSnapshot(consulta, (snapshot) => {
        const movimentacoes = snapshot.docs.map((docSnap) => ({
            firebaseId: docSnap.id,
            ...docSnap.data()
        }));

        movimentacoes.sort((a, b) => {
            const categoriaA = (a.categoria || "").toUpperCase();
            const categoriaB = (b.categoria || "").toUpperCase();

            if (categoriaA !== categoriaB) {
                return categoriaA.localeCompare(categoriaB, "pt-BR");
            }

            return (a.nome || "").toUpperCase().localeCompare(
                (b.nome || "").toUpperCase(),
                "pt-BR"
            );
        });

        const registrosPorEquipamento = {};
        dadosProcessados = [];

        movimentacoes.forEach((mov) => {
            const id = mov.equipamentoID || "—";

            if (!registrosPorEquipamento[id]) {
                registrosPorEquipamento[id] = [];
            }

            registrosPorEquipamento[id].push(mov);
        });

        Object.values(registrosPorEquipamento).forEach((lista) => {
            let saida = null;
            let pessoa = "—";
            let evento = "—";

            lista.forEach((mov) => {
                const dataFormatada = formatarDataBR(mov.data);

                if (mov.status === "MANUTENÇÃO") {
                    dadosProcessados.push({
                        id: mov.equipamentoID || "—",
                        nome: mov.nome || "—",
                        evento: "—",
                        pessoa: "LABORATÓRIO",
                        saida: dataFormatada,
                        entrada: "Em Manutenção",
                        status: "MANUTENÇÃO"
                    });

                    saida = null;
                    pessoa = "—";
                    evento = "—";
                    return;
                }

                if (mov.status === "DESATIVADO") {
                    dadosProcessados.push({
                        id: mov.equipamentoID || "—",
                        nome: mov.nome || "—",
                        evento: "—",
                        pessoa: "—",
                        saida: dataFormatada,
                        entrada: "Desativado",
                        status: "DESATIVADO"
                    });

                    saida = null;
                    pessoa = "—";
                    evento = "—";
                    return;
                }

                if (mov.status === "EM USO") {
                    saida = dataFormatada;
                    pessoa = mov.pessoa || "—";
                    evento = mov.evento || "—";
                    return;
                }

                if (mov.status === "DISPONIVEL" && saida) {
                    dadosProcessados.push({
                        id: mov.equipamentoID || "—",
                        nome: mov.nome || "—",
                        evento: evento || "—",
                        pessoa: pessoa || "—",
                        saida,
                        entrada: dataFormatada,
                        status: "DISPONIVEL"
                    });

                    saida = null;
                    pessoa = "—";
                    evento = "—";
                }
            });

            if (saida) {
                const ultimo = lista[lista.length - 1] || {};

                dadosProcessados.push({
                    id: ultimo.equipamentoID || "—",
                    nome: ultimo.nome || "—",
                    evento: evento || ultimo.evento || "—",
                    pessoa: pessoa || "—",
                    saida,
                    entrada: "-",
                    status: "EM USO"
                });
            }
        });

        renderTabela(dadosProcessados);
        renderizarGraficosMov(movimentacoes);
    });
}

/* =========================================================
   GRÁFICOS
========================================================= */
function renderizarGraficosMov(movimentacoes) {
    const ChartJS = window.Chart;
    if (!ChartJS) return;

    const canvasMaisUsados = document.getElementById("graficoMaisUsados");
    const canvasDesempenho = document.getElementById("graficoDesempenho");

    if (!canvasMaisUsados || !canvasDesempenho) return;

    const ctxMaisUsados = canvasMaisUsados.getContext("2d");
    const ctxDesempenho = canvasDesempenho.getContext("2d");

    if (!ctxMaisUsados || !ctxDesempenho) return;

    renderizarGraficoMaisUsados(ChartJS, ctxMaisUsados, movimentacoes);
    renderizarGraficoDesempenho(ChartJS, ctxDesempenho, movimentacoes);
}

function renderizarGraficoMaisUsados(ChartJS, ctx, movimentacoes) {
    const contagem = {};

    movimentacoes.forEach((mov) => {
        if (mov.nome) {
            contagem[mov.nome] = (contagem[mov.nome] || 0) + 1;
        }
    });

    let top5 = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (top5.length === 0) {
        top5 = [["Sem dados", 0]];
    }

    if (grafMaisUsados) grafMaisUsados.destroy();

    grafMaisUsados = new ChartJS(ctx, {
        type: "bar",
        data: {
            labels: top5.map((item) => item[0]),
            datasets: [{
                label: "Usos",
                data: top5.map((item) => item[1])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderizarGraficoDesempenho(ChartJS, ctx, movimentacoes) {
    const hoje = new Date();
    const dias = {};

    for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setHours(0, 0, 0, 0);
        data.setDate(hoje.getDate() - i);

        dias[data.toLocaleDateString("pt-BR")] = 0;
    }

    movimentacoes.forEach((mov) => {
        if (!mov.data) return;

        const dataMov = mov.data?.toDate ? mov.data.toDate() : new Date(mov.data);
        if (isNaN(dataMov)) return;

        const chave = dataMov.toLocaleDateString("pt-BR");

        if (dias[chave] !== undefined) {
            dias[chave]++;
        }
    });

    if (grafDesempenho) grafDesempenho.destroy();

    grafDesempenho = new ChartJS(ctx, {
        type: "line",
        data: {
            labels: Object.keys(dias),
            datasets: [{
                label: "Movimentações",
                data: Object.values(dias),
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}