import { db } from "./firebase.js";
import {
    collection,
    onSnapshot,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   UTILITÁRIOS
========================================================= */
function usuarioEhAdmin() {
    return window.isAdmin === true;
}

function normalizarIdEvento(nome) {
    return String(nome || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function formatarDataBR(valor) {
    if (!valor) return "-";

    const data = valor?.toDate ? valor.toDate() : new Date(valor);
    if (isNaN(data)) return "-";

    return data.toLocaleString("pt-BR");
}

function escaparTexto(texto) {
    return String(texto || "").replace(/'/g, "\\'");
}

function criarEstruturaEvento(nomeEvento) {
    return {
        nome: nomeEvento,
        emUso: 0,
        ultimaMovimentacao: null,
        pessoas: new Set(),
        equipamentos: new Set()
    };
}

function garantirEventoNoMapa(mapaEventos, nomeEvento) {
    if (!mapaEventos[nomeEvento]) {
        mapaEventos[nomeEvento] = criarEstruturaEvento(nomeEvento);
    }

    return mapaEventos[nomeEvento];
}

/* =========================================================
   MODAIS E AÇÕES GLOBAIS
========================================================= */
window.prepararArquivarEvento = function (nomeEvento) {
    if (!usuarioEhAdmin()) return;

    const modal = document.getElementById("modalArquivarEvento");
    const nome = document.getElementById("nomeEventoArquivar");
    const input = document.getElementById("idEventoArquivar");

    if (modal) modal.style.display = "flex";
    if (nome) nome.innerText = nomeEvento;
    if (input) input.value = nomeEvento;
};

window.restaurarEvento = async function (nomeEvento) {
    if (!usuarioEhAdmin()) return;

    const id = normalizarIdEvento(nomeEvento);

    await setDoc(doc(db, "eventos", id), {
        nome: nomeEvento,
        arquivado: false,
        atualizadoEm: new Date()
    }, { merge: true });
};

function configurarBotaoArquivarEvento() {
    const btnArquivarEvento = document.getElementById("confirmarArquivarEventoBtn");
    if (!btnArquivarEvento) return;

    btnArquivarEvento.onclick = async () => {
        if (!usuarioEhAdmin()) return;

        const input = document.getElementById("idEventoArquivar");
        const modal = document.getElementById("modalArquivarEvento");
        const nomeEvento = input?.value;

        if (!nomeEvento) return;

        const id = normalizarIdEvento(nomeEvento);

        await setDoc(doc(db, "eventos", id), {
            nome: nomeEvento,
            arquivado: true,
            arquivadoEm: new Date(),
            atualizadoEm: new Date()
        }, { merge: true });

        if (modal) modal.style.display = "none";
    };
}

/* =========================================================
   PROCESSAMENTO DE DADOS
========================================================= */
function processarEquipamentos(equipamentos, mapaEventos) {
    equipamentos.forEach((eq) => {
        const nomeEvento = String(eq.evento || "").trim();
        const pessoa = String(eq.pessoa || "").trim() || "—";
        const nomeEquip = String(eq.nome || "").trim() || "—";

        if (eq.status !== "EM USO" || !nomeEvento || nomeEvento === "—") {
            return;
        }

        const evento = garantirEventoNoMapa(mapaEventos, nomeEvento);

        evento.emUso++;
        evento.pessoas.add(pessoa);
        evento.equipamentos.add(nomeEquip);
    });
}

function processarMovimentacoes(movimentacoes, mapaEventos) {
    movimentacoes.forEach((mov) => {
        const nomeEvento = String(mov.evento || "").trim();
        if (!nomeEvento || nomeEvento === "—") return;

        const evento = garantirEventoNoMapa(mapaEventos, nomeEvento);

        const pessoa = String(mov.pessoa || "").trim() || "—";
        const nomeEquip = String(mov.nome || "").trim() || "—";

        if (pessoa !== "—") evento.pessoas.add(pessoa);
        if (nomeEquip !== "—") evento.equipamentos.add(nomeEquip);

        const dataMov = mov.data?.toDate ? mov.data.toDate() : new Date(mov.data);

        if (!isNaN(dataMov)) {
            if (!evento.ultimaMovimentacao || dataMov > evento.ultimaMovimentacao) {
                evento.ultimaMovimentacao = dataMov;
            }
        }
    });
}

function montarListaEventos(mapaEventos) {
    return Object.values(mapaEventos)
        .map((evento) => ({
            ...evento,
            pessoasTexto: Array.from(evento.pessoas).filter(Boolean).join(", ") || "—",
            equipamentosTexto: Array.from(evento.equipamentos).filter(Boolean).join(", ") || "—"
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function separarEventosAtivosEArquivados(eventosLista, metadadosEventos) {
    const ativos = [];
    const arquivados = [];

    eventosLista.forEach((evento) => {
        const meta = metadadosEventos[normalizarIdEvento(evento.nome)];
        const isArquivado = meta?.arquivado === true;

        const item = {
            ...evento,
            arquivadoEm: meta?.arquivadoEm || null
        };

        if (isArquivado) {
            arquivados.push(item);
        } else {
            ativos.push(item);
        }
    });

    return { ativos, arquivados };
}

/* =========================================================
   RENDERIZAÇÃO
========================================================= */
function renderizarLinhaEventoAtivo(evento) {
    return `
        <tr>
            <td><span class="event-badge">${evento.nome}</span></td>
            <td>${evento.emUso}</td>
            <td>${evento.pessoasTexto}</td>
            <td>${evento.equipamentosTexto}</td>
            <td>${formatarDataBR(evento.ultimaMovimentacao)}</td>
            <td>
                ${usuarioEhAdmin() ? `
                    <button
                        class="btn btn-warning"
                        onclick="prepararArquivarEvento('${escaparTexto(evento.nome)}')"
                    >
                        Arquivar
                    </button>
                ` : ""}
            </td>
        </tr>
    `;
}

function renderizarLinhaEventoArquivado(evento) {
    return `
        <tr>
            <td><span class="event-badge">${evento.nome}</span></td>
            <td>${evento.pessoasTexto}</td>
            <td>${evento.equipamentosTexto}</td>
            <td>${formatarDataBR(evento.arquivadoEm)}</td>
            <td>${formatarDataBR(evento.ultimaMovimentacao)}</td>
            <td>
                ${usuarioEhAdmin() ? `
                    <button
                        class="btn btn-success"
                        onclick="restaurarEvento('${escaparTexto(evento.nome)}')"
                    >
                        Restaurar
                    </button>
                ` : ""}
            </td>
        </tr>
    `;
}

function renderizarEstadoVazio(tbody, colspan, mensagem) {
    if (!tbody) return;

    if (tbody.innerHTML.trim() === "") {
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="empty-state">${mensagem}</td>
            </tr>
        `;
    }
}

/* =========================================================
   ESCUTA PRINCIPAL
========================================================= */
export function escutarEventos() {
    const tbodyEventos = document.getElementById("eventosTable");
    const tbodyEventosArquivados = document.getElementById("eventosArquivadosTable");

    let equipamentos = [];
    let movimentacoes = [];
    let metadadosEventos = {};

    function renderizar() {
        if (!tbodyEventos || !tbodyEventosArquivados) return;

        tbodyEventos.innerHTML = "";
        tbodyEventosArquivados.innerHTML = "";

        const mapaEventos = {};

        processarEquipamentos(equipamentos, mapaEventos);
        processarMovimentacoes(movimentacoes, mapaEventos);

        const eventosLista = montarListaEventos(mapaEventos);
        const { ativos, arquivados } = separarEventosAtivosEArquivados(
            eventosLista,
            metadadosEventos
        );

        ativos.forEach((evento) => {
            tbodyEventos.insertAdjacentHTML("beforeend", renderizarLinhaEventoAtivo(evento));
        });

        arquivados.forEach((evento) => {
            tbodyEventosArquivados.insertAdjacentHTML(
                "beforeend",
                renderizarLinhaEventoArquivado(evento)
            );
        });

        renderizarEstadoVazio(tbodyEventos, 6, "Nenhum evento ativo.");
        renderizarEstadoVazio(tbodyEventosArquivados, 6, "Nenhum evento arquivado.");
    }

    onSnapshot(collection(db, "equipamentos"), (snapshot) => {
        equipamentos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderizar();
    });

    onSnapshot(collection(db, "movimentacoes"), (snapshot) => {
        movimentacoes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderizar();
    });

    onSnapshot(collection(db, "eventos"), (snapshot) => {
        metadadosEventos = {};

        snapshot.docs.forEach((d) => {
            metadadosEventos[d.id] = d.data();
        });

        renderizar();
    });
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
configurarBotaoArquivarEvento();