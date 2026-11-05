import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { LexcoDB } from "@/lib/db";
import {
  convidarUsuario, registrarResposta, sincronizarComoDono, aceitarConvite, abrirBancoAmbiente,
  sincronizarComoConvidado, revogarAcesso, AcessoRevogadoError, opsPendentes, type DriveTroca,
} from "@/lib/compartilhamento/sync";
import { cifrar, decifrar, gerarChave } from "@/lib/compartilhamento/cripto";
import { PERMISSOES_TOTAIS, type Permissoes } from "@/lib/permissoes";
import type { Processo, User } from "@/types";

/** Drive em memória: cada "publicar" grava o texto; "ler" devolve o que está lá (como o link público). */
function driveFalso() {
  const arquivos = new Map<string, string>();
  const docs: Record<string, boolean> = {};
  let n = 0;
  const drive: DriveTroca = {
    async publicar(id, _nome, conteudo) {
      const fid = id && arquivos.has(id) ? id : `arquivo-${++n}-xxxxxxxx`;
      arquivos.set(fid, conteudo);
      return fid;
    },
    async ler(id) {
      if (!arquivos.has(id)) throw new Error("REMOVIDO");
      return arquivos.get(id)!;
    },
    async remover(id) { arquivos.delete(id); },
    async compartilharDocumentos(email, permitir) { docs[email] = permitir; },
  };
  return { drive, arquivos, docs };
}

const agora = "2026-11-05T10:00:00.000Z";
const processo = (over: Partial<Processo> = {}): Processo => ({
  id: "p1", titulo: "Regularização de imóvel", numero: "12345.000001/2026-11", status: "ativo", dataCadastro: agora,
  responsavelId: "admin", equipeIds: [], tags: [], modeloNomenclaturaId: "spu", labelPoloAtivo: "Manifestante",
  labelPoloPassivo: "Interessado", criadoPor: "admin", atualizadoEm: agora, atualizadoPor: "admin", ...over,
});
const usuario = (id: string, perfil: User["perfil"], permissoes?: Partial<Permissoes>): User => ({
  id, nome: id === "admin" ? "Dra. Admin" : "Bruno Convidado", email: `${id}@ex.com`, senha: "hash-secreto",
  cpf: "52998224725", perfil, status: "ativo", permissoes, preferencias: { tema: "light" }, criadoEm: agora, atualizadoEm: agora,
});
const dono = { nome: "Dra. Admin", email: "admin@gmail.com" };

let n = 0;
let dbDono: LexcoDB;
beforeEach(async () => {
  dbDono = new LexcoDB(`dono-${++n}`);
  localStorage.clear();
  await dbDono.users.bulkPut([
    usuario("admin", "admin"),
    usuario("bruno", "colaborador", { ...PERMISSOES_TOTAIS, editarSensiveis: false, verDadosPessoais: false, excluirProcessos: false }),
  ]);
  await dbDono.processos.put(processo());
  await dbDono.partes.put({
    id: "pt1", tipoPessoa: "Pessoa Física", nome: "Maria da Silva Souza", cpfCnpj: "529.982.247-25",
    telefone: "81 99999-0000", profissao: "Professora", status: "ativo", criadoPor: "admin", criadoEm: agora, atualizadoEm: agora,
  });
  await dbDono.vinculos.put({ id: "v1", processoId: "p1", parteId: "pt1", tipoEnvolvimento: "Manifestante" });
});

async function parear() {
  const { drive, arquivos, docs } = driveFalso();
  const convite = await convidarUsuario(dbDono, drive, "bruno", dono, "bruno@gmail.com");
  const { ambiente, codigoResposta } = await aceitarConvite(drive, "local-bruno", convite);
  await registrarResposta(dbDono, codigoResposta);
  const dbConv = abrirBancoAmbiente(ambiente);
  await sincronizarComoConvidado(dbConv, drive, ambiente);
  return { drive, arquivos, docs, ambiente, dbConv };
}

describe("criptografia", () => {
  it("só abre com a chave certa", async () => {
    const k = gerarChave();
    const t = await cifrar({ a: 1 }, k);
    expect(t).not.toContain('"a"');
    expect(await decifrar(t, k)).toEqual({ a: 1 });
    await expect(decifrar(t, gerarChave())).rejects.toThrow(/chave incorreta/);
  });
});

describe("ambiente compartilhado", () => {
  it("o arquivo no Drive é ilegível sem a chave e o convidado recebe só o permitido", async () => {
    const { arquivos, dbConv, docs } = await parear();
    for (const conteudo of arquivos.values()) {
      expect(conteudo).not.toContain("Maria");
      expect(conteudo).not.toContain("52998224725");
    }
    const parte = await dbConv.partes.get("pt1");
    expect(parte?.nome).toBe("Maria S.");
    expect(parte?.cpfCnpj).toBe("***.982.247-**");
    expect(parte?.telefone).toBeUndefined();
    expect(parte?.profissao).toBe("Professora");
    const users = await dbConv.users.toArray();
    expect(users.every((u) => u.senha === "" && u.email === "" && !u.cpf)).toBe(true);
    expect(docs["bruno@gmail.com"]).toBe(true);
  });

  it("convidado altera, administrador valida e aplica; histórico fica no nome dele", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.processos.update("p1", { titulo: "Regularização — fase 2" });
    await dbConv.historico.add({ id: "h1", entidadeId: "p1", entidadeTipo: "processo", acao: "edicao",
      descricao: "Título atualizado", usuarioId: "qualquer", usuarioNome: "Outro Nome", data: agora });
    expect(opsPendentes(ambiente.id)).toHaveLength(2);
    await sincronizarComoConvidado(dbConv, drive, ambiente); // envia
    const r = await sincronizarComoDono(dbDono, drive, dono);
    expect(r.aplicadas).toBe(2);
    expect((await dbDono.processos.get("p1"))?.titulo).toBe("Regularização — fase 2");
    expect((await dbDono.processos.get("p1"))?.atualizadoPor).toBe("bruno");
    const h = await dbDono.historico.get("h1");
    expect(h?.usuarioId).toBe("bruno");
    expect(h?.usuarioNome).toBe("Bruno Convidado");
    await sincronizarComoConvidado(dbConv, drive, ambiente); // recebe confirmação
    expect(opsPendentes(ambiente.id)).toHaveLength(0);
  });

  it("permissão vale nos dados: alteração de campo sensível e de dado pessoal é recusada", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.processos.update("p1", { numero: "99999.999999/2026-99", titulo: "Novo título" });
    await dbConv.partes.update("pt1", { cpfCnpj: "111.444.777-35", profissao: "Diretora" });
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    const p = await dbDono.processos.get("p1");
    expect(p?.numero).toBe("12345.000001/2026-11");
    expect(p?.titulo).toBe("Novo título");
    const parte = await dbDono.partes.get("pt1");
    expect(parte?.cpfCnpj).toBe("529.982.247-25");
    expect(parte?.nome).toBe("Maria da Silva Souza"); // o nome mascarado nunca volta para o banco
    expect(parte?.profissao).toBe("Diretora");
    const { recusadas } = await sincronizarComoConvidado(dbConv, drive, ambiente);
    expect(recusadas.map((x) => x.resultado.motivo).join(" ")).toMatch(/dado sensível|dado pessoal/);
    expect((await dbConv.processos.get("p1"))?.numero).toBe("12345.000001/2026-11"); // cópia local corrigida
  });

  it("não deixa excluir sem permissão e não mexe nas partes do processo", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.processos.delete("p1");
    await dbConv.vinculos.delete("v1");
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    expect(await dbDono.processos.get("p1")).toBeTruthy();
    expect(await dbDono.vinculos.get("v1")).toBeTruthy();
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    expect(await dbConv.processos.get("p1")).toBeTruthy(); // volta a aparecer para o convidado
  });

  it("processo cadastrado pelo convidado pode receber partes dele", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.processos.add(processo({ id: "p2", titulo: "Novo", numero: "1", criadoPor: "bruno" }));
    await dbConv.partes.add({ id: "pt2", tipoPessoa: "Pessoa Física", nome: "João", status: "ativo", criadoPor: "bruno", criadoEm: agora, atualizadoEm: agora });
    await dbConv.vinculos.add({ id: "v2", processoId: "p2", parteId: "pt2", tipoEnvolvimento: "Manifestante" });
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    expect(await dbDono.processos.get("p2")).toBeTruthy();
    expect(await dbDono.vinculos.get("v2")).toBeTruthy();
  });

  it("conflito: se o administrador mudou o mesmo campo, o valor dele é mantido", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbDono.processos.update("p1", { titulo: "Título do administrador" });
    await dbConv.processos.update("p1", { titulo: "Título do convidado" });
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    expect((await dbDono.processos.get("p1"))?.titulo).toBe("Título do administrador");
    const { recusadas } = await sincronizarComoConvidado(dbConv, drive, ambiente);
    expect(recusadas[0].resultado.motivo).toMatch(/alterado por outra pessoa/);
  });

  it("a mesma alteração nunca é aplicada duas vezes", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.prazos.add({ id: "pz1", titulo: "Prazo", processoId: "p1", dataLimite: "2026-12-01", status: "pendente", criadoPor: "bruno", criadoEm: agora, atualizadoEm: agora });
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    const segunda = await sincronizarComoDono(dbDono, drive, dono); // caixa ainda tem a op
    expect(segunda.aplicadas + segunda.rejeitadas).toBe(0);
    expect(await dbDono.prazos.count()).toBe(1);
  });

  it("revogar corta o acesso e retira a pasta de documentos", async () => {
    const { drive, ambiente, dbConv, docs } = await parear();
    await revogarAcesso(dbDono, drive, "bruno");
    expect(docs["bruno@gmail.com"]).toBe(false);
    await expect(sincronizarComoConvidado(dbConv, drive, ambiente)).rejects.toBeInstanceOf(AcessoRevogadoError);
    expect((await dbDono.users.get("bruno"))?.acessoRemoto).toBeUndefined();
  });

  it("usuário desativado perde o acesso no próximo ciclo", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbDono.users.update("bruno", { status: "inativo" });
    await sincronizarComoDono(dbDono, drive, dono);
    await expect(sincronizarComoConvidado(dbConv, drive, ambiente)).rejects.toBeInstanceOf(AcessoRevogadoError);
  });

  it("sem permissão de tarefas, elas não vão no pacote", async () => {
    await dbDono.users.update("bruno", { permissoes: { ...PERMISSOES_TOTAIS, tarefas: "nenhum" } });
    await dbDono.eventos.put({ id: "t1", titulo: "Tarefa", tipo: "tarefa", data: "2026-11-10", partesIds: [], responsaveisIds: [], status: "pendente", criadoPor: "admin", criadoEm: agora, atualizadoEm: agora });
    const { dbConv } = await parear();
    expect(await dbConv.eventos.get("t1")).toBeUndefined();
  });
});

describe("operações forjadas", () => {
  it("quem só mexe em tarefas não transforma tarefa em evento nem move prazo de processo", async () => {
    await dbDono.users.update("bruno", { permissoes: { ...PERMISSOES_TOTAIS, editarProcessos: false, cadastrarProcessos: false, tarefas: "editar" } });
    await dbDono.eventos.put({ id: "t1", titulo: "Tarefa", tipo: "tarefa", data: "2026-11-10", processoId: "p1", partesIds: [], responsaveisIds: [], status: "pendente", criadoPor: "admin", criadoEm: agora, atualizadoEm: agora });
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.eventos.update("t1", { tipo: "audiencia" });
    await dbConv.eventos.update("t1", { titulo: "Tarefa renomeada" }); // isto pode
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    const t = await dbDono.eventos.get("t1");
    expect(t?.tipo).toBe("tarefa");
    expect(t?.titulo).toBe("Tarefa renomeada");
  });
});

describe("revisão de segurança", () => {
  it("operação forjada com 'valores' falsos não engana a permissão", async () => {
    await dbDono.users.update("bruno", { permissoes: { ...PERMISSOES_TOTAIS, editarProcessos: false, cadastrarProcessos: true, editarSensiveis: false } });
    await dbDono.prazos.put({ id: "pz9", titulo: "Prazo do admin", processoId: "p1", dataLimite: "2026-12-01", status: "pendente", criadoPor: "admin", criadoEm: agora, atualizadoEm: agora });
    const { aplicarOperacao } = await import("@/lib/compartilhamento/operacoes");
    const conv = { id: "bruno", nome: "Bruno", permissoes: { ...PERMISSOES_TOTAIS, editarProcessos: false, cadastrarProcessos: true, editarSensiveis: false } };
    await dbDono.processos.put(processo({ id: "pb", criadoPor: "bruno" }));
    const r = await aplicarOperacao(dbDono, {
      id: "x", em: agora, tabela: "prazos", tipo: "alterar", chave: "pz9",
      valores: { processoId: "pb" }, // tentativa de se passar por "prazo do meu processo"
      campos: { titulo: { de: "Prazo do admin", para: "hackeado" } },
    }, conv);
    expect(r.status).toBe("rejeitada");
    expect((await dbDono.prazos.get("pz9"))?.titulo).toBe("Prazo do admin");
  });

  it("não exclui registro que o administrador atualizou depois", async () => {
    await dbDono.users.update("bruno", { permissoes: PERMISSOES_TOTAIS });
    const { drive, ambiente, dbConv } = await parear();
    await dbDono.processos.update("p1", { atualizadoEm: "2026-11-06T00:00:00.000Z", titulo: "Atualizado pelo admin" });
    await dbConv.processos.delete("p1");
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    expect(await dbDono.processos.get("p1")).toBeTruthy();
  });

  it("trocar PF→PJ sem acesso a dados pessoais é recusado (não revela o CPF)", async () => {
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.partes.update("pt1", { tipoPessoa: "Pessoa Jurídica" });
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    expect((await dbDono.partes.get("pt1"))?.tipoPessoa).toBe("Pessoa Física");
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    expect((await dbConv.partes.get("pt1"))?.cpfCnpj).toBe("***.982.247-**");
  });

  it("só remove documento que ele mesmo anexou", async () => {
    await dbDono.arquivos.put({ id: "a1", nome: "rg.pdf", categoria: "Documento Pessoal", entidadeId: "p1", entidadeTipo: "processo", responsavelId: "admin", criadoEm: agora });
    const { drive, ambiente, dbConv } = await parear();
    await dbConv.arquivos.delete("a1");
    await sincronizarComoConvidado(dbConv, drive, ambiente);
    await sincronizarComoDono(dbDono, drive, dono);
    expect(await dbDono.arquivos.get("a1")).toBeTruthy();
  });

  it("tirar a permissão de documentos retira a pasta do Drive no ciclo seguinte", async () => {
    const { drive, docs } = await parear();
    expect(docs["bruno@gmail.com"]).toBe(true);
    await dbDono.users.update("bruno", { permissoes: { ...PERMISSOES_TOTAIS, documentos: "nenhum" } });
    await sincronizarComoDono(dbDono, drive, dono);
    expect(docs["bruno@gmail.com"]).toBe(false);
  });

  it("histórico com dados ocultos não vai no pacote", async () => {
    await dbDono.historico.bulkPut([
      { id: "hp", entidadeId: "pt1", entidadeTipo: "parte", acao: "criacao", descricao: 'Parte "Maria da Silva Souza" cadastrada', usuarioId: "admin", usuarioNome: "Admin", data: agora },
      { id: "hv", entidadeId: "p1", entidadeTipo: "processo", acao: "parte_removida", descricao: 'Parte "Maria da Silva Souza" removida', usuarioId: "admin", usuarioNome: "Admin", data: agora },
      { id: "ok", entidadeId: "p1", entidadeTipo: "processo", acao: "andamento", descricao: "Encaminhado", usuarioId: "admin", usuarioNome: "Admin", data: agora },
    ]);
    const { dbConv, arquivos } = await parear();
    expect((await dbConv.historico.toArray()).map((h) => h.id)).toEqual(["ok"]);
    void arquivos;
  });
});
