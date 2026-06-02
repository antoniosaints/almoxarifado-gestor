import {
  ArrowRight,
  Bot,
  ClipboardList,
  HelpCircle,
  MapPinned,
  MessageCircle,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type HelpTopic = {
  category: string;
  id: string;
  keywords: string[];
  route: string;
  steps: string[];
  summary: string;
  title: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const helpTopics: HelpTopic[] = [
  {
    category: "Cadastros",
    id: "units",
    keywords: ["unidade", "medida", "sigla", "abreviacao", "unidades de medida"],
    route: "/units",
    steps: [
      "Abra Unidades no menu lateral.",
      "Clique em Nova unidade e informe nome, abreviação e status.",
      "Salve e use a unidade no cadastro de produtos ou nas conversões.",
    ],
    summary: "Crie unidades como unidade, caixa, pacote, litro ou metro para padronizar produtos.",
    title: "Criar unidades de medida",
  },
  {
    category: "Cadastros",
    id: "categories",
    keywords: ["categoria", "categorias", "almoxarifado", "grupo", "classificacao"],
    route: "/categories",
    steps: [
      "Abra Categorias no menu lateral.",
      "Cadastre o nome da categoria que será usada nos produtos e almoxarifados.",
      "Edite ou desative categorias antigas quando não forem mais usadas.",
    ],
    summary: "Organize produtos e almoxarifados por grupos como expediente, limpeza ou saúde.",
    title: "Criar categorias de almoxarifado",
  },
  {
    category: "Produtos",
    id: "products",
    keywords: ["produto", "produtos", "cadastrar produto", "catalogo", "estoque minimo"],
    route: "/products",
    steps: [
      "Abra Produtos e clique em Novo produto.",
      "Informe código, nome, categoria, unidade padrão e estoque mínimo.",
      "Salve e confira se o produto aparece na tabela para movimentações e solicitações.",
    ],
    summary: "Cadastre itens do catálogo antes de movimentar estoque ou importar notas.",
    title: "Cadastrar produtos",
  },
  {
    category: "Produtos",
    id: "conversions",
    keywords: ["conversao", "conversões", "unidade alternativa", "caixa", "pacote"],
    route: "/products",
    steps: [
      "Abra Produtos e localize o item desejado.",
      "Clique no botão de régua na linha do produto.",
      "Cadastre a unidade alternativa e o fator: por exemplo, 1 caixa equivale a 12 unidades.",
    ],
    summary: "Use conversões para lançar entrada ou saída em uma unidade diferente da unidade base do produto.",
    title: "Conversões de unidades de medida",
  },
  {
    category: "Almoxarifado",
    id: "warehouses",
    keywords: ["almoxarifado", "almoxarifados", "deposito", "secretaria", "criar almoxarifado"],
    route: "/warehouses",
    steps: [
      "Abra Almoxarifados no menu lateral.",
      "Clique em Novo almoxarifado, informe nome, categoria e marque se ele é geral quando aplicável.",
      "Entre no almoxarifado para registrar entradas e acompanhar o saldo.",
    ],
    summary: "Crie locais de estoque para separar saldos por secretaria, setor ou depósito central.",
    title: "Criar almoxarifados",
  },
  {
    category: "Solicitações",
    id: "entry-requests",
    keywords: ["solicitar", "solicitacao", "requisição", "pedido", "entrada"],
    route: "/requests",
    steps: [
      "Abra Solicitações e escolha o tipo de solicitação necessário.",
      "Informe almoxarifado, produto, quantidade e observação quando houver.",
      "Acompanhe a situação na própria tela até aprovação, rejeição ou recebimento.",
    ],
    summary: "Registre pedidos para que entradas, saídas e recebimentos tenham análise e histórico.",
    title: "Solicitar material",
  },
  {
    category: "Movimentações",
    id: "transfers",
    keywords: ["transferir", "transferencia", "receber", "movimentar", "almoxarifado destino"],
    route: "/requests",
    steps: [
      "Abra Solicitações e inicie uma transferência entre almoxarifados.",
      "Escolha origem, destino, produto e quantidade.",
      "O destino confirma o recebimento para finalizar a transferência e atualizar os saldos.",
    ],
    summary: "Use transferência para mover saldo entre almoxarifados sem perder rastreabilidade.",
    title: "Transferir entre almoxarifados",
  },
  {
    category: "Solicitações",
    id: "office-letter",
    keywords: ["oficio", "ofício", "documento", "ver oficio", "imprimir"],
    route: "/requests",
    steps: [
      "Abra Solicitações e localize a solicitação desejada.",
      "Use a ação de ofício para visualizar o documento gerado.",
      "Revise dados, itens e responsável antes de imprimir ou salvar.",
    ],
    summary: "Consulte o ofício vinculado à solicitação para conferência ou impressão.",
    title: "Ver ofício",
  },
  {
    category: "Notas fiscais",
    id: "invoice-import",
    keywords: ["nota", "notas", "xml", "importar nota", "nota fiscal", "nf"],
    route: "/invoices",
    steps: [
      "Abra Notas fiscais e clique em Importar XML.",
      "Selecione o arquivo XML da nota, almoxarifado e categoria padrão para novos produtos.",
      "Revise a prévia, ajuste mapeamentos de produtos se necessário e confirme a importação.",
    ],
    summary: "Importe XML de nota fiscal para criar a nota e atualizar estoque com conferência prévia.",
    title: "Importar nota fiscal",
  },
  {
    category: "Notas fiscais",
    id: "suppliers",
    keywords: ["fornecedor", "fornecedores", "cadastrar fornecedor", "empresa", "cnpj"],
    route: "/invoices",
    steps: [
      "Abra Notas fiscais e clique em Fornecedores.",
      "Use Novo fornecedor para abrir o formulário próprio de cadastro.",
      "Informe razão social, CNPJ e contatos; administradores também podem editar fornecedores existentes.",
    ],
    summary: "Cadastre fornecedores para vincular notas fiscais e relatórios por empresa.",
    title: "Cadastrar fornecedor",
  },
  {
    category: "Relatórios",
    id: "reports",
    keywords: ["relatorio", "relatórios", "exportar", "pdf", "prestacao", "baixar"],
    route: "/reports",
    steps: [
      "Abra Relatórios no menu lateral.",
      "Escolha filtros como período, fornecedor ou almoxarifado, conforme o relatório.",
      "Clique em exportar para gerar o arquivo e conferir os dados antes de compartilhar.",
    ],
    summary: "Exporte relatórios filtrados para conferência, prestação de contas e acompanhamento.",
    title: "Exportar relatórios",
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function topicAnswer(topic: HelpTopic) {
  return `${topic.summary}\n\nPasso a passo:\n${topic.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n")}`;
}

const stopWords = new Set([
  "abrir",
  "como",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "fazer",
  "o",
  "onde",
  "para",
  "por",
  "preciso",
  "qual",
  "quais",
  "que",
  "quero",
  "uma",
  "um",
]);

function bestTopicForQuery(query: string) {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));

  if (!terms.length) {
    return null;
  }

  const scoredTopics = helpTopics.map((topic) => {
    const title = normalize(topic.title);
    const keywords = normalize(topic.keywords.join(" "));
    const summary = normalize(topic.summary);
    const steps = normalize(topic.steps.join(" "));

    const score = terms.reduce((total, term) => {
      if (title.includes(term)) {
        total += 5;
      }
      if (keywords.includes(term)) {
        total += 4;
      }
      if (summary.includes(term)) {
        total += 2;
      }
      if (steps.includes(term)) {
        total += 1;
      }
      return total;
    }, 0);

    return { score, topic };
  });

  const best = scoredTopics.sort((left, right) => right.score - left.score)[0];

  return best && best.score > 0 ? best.topic : null;
}

export function HelpAssistant({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(helpTopics[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Digite o que você quer fazer ou escolha uma resposta rápida. Eu mostro o passo a passo e posso abrir a tela correta.",
    },
  ]);

  const selectedTopic = useMemo(
    () => helpTopics.find((topic) => topic.id === selectedTopicId) ?? helpTopics[0],
    [selectedTopicId],
  );

  function answerTopic(topic: HelpTopic, userText = topic.title) {
    setSelectedTopicId(topic.id);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: userText,
      },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: topicAnswer(topic),
      },
    ]);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    const topic = bestTopicForQuery(trimmedQuery);
    setQuery("");

    if (topic) {
      answerTopic(topic, trimmedQuery);
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmedQuery,
      },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: "Ainda não tenho uma resposta pronta para isso. Tente termos como fornecedor, produto, nota fiscal, transferência, ofício, unidade, categoria, almoxarifado ou relatório.",
      },
    ]);
  }

  function openSelectedRoute() {
    if (!selectedTopic) {
      return;
    }

    onNavigate(selectedTopic.route);
    setOpen(false);
  }

  return (
    <>
      <Button
        aria-label="Abrir central de ajuda"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full border-0 bg-primary shadow-2xl shadow-primary/30 hover:bg-primary/90 md:bottom-6 md:right-6"
        onClick={() => setOpen(true)}
        size="icon"
        type="button"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <div className="border-b bg-gradient-to-r from-primary/12 via-accent/50 to-card p-5">
            <DialogHeader>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Ajuda rápida do almoxarifado
              </div>
              <DialogTitle>Central de ajuda</DialogTitle>
              <DialogDescription>
                Tutoriais curtos, respostas rápidas e atalhos para as principais rotinas.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[calc(92vh-7rem)] overflow-hidden md:grid-cols-[18rem_1fr]">
            <aside className="border-b bg-muted/35 p-4 md:border-b-0 md:border-r">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4" />
                Respostas rápidas
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1 md:max-h-[calc(92vh-12rem)]">
                {helpTopics.map((topic) => (
                  <button
                    className={cn(
                      "w-full rounded-lg border bg-card px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-accent/50",
                      selectedTopic?.id === topic.id && "border-primary bg-accent/60",
                    )}
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    type="button"
                  >
                    <span className="block font-medium">{topic.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {topic.category}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="grid min-h-0 gap-0 md:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="min-h-0 overflow-y-auto p-5">
                {selectedTopic ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Badge>{selectedTopic.category}</Badge>
                        <h3 className="mt-3 text-xl font-semibold">{selectedTopic.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {selectedTopic.summary}
                        </p>
                      </div>
                      <Button className="shrink-0" onClick={openSelectedRoute} type="button">
                        Abrir tela
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="rounded-xl border bg-card p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <MapPinned className="h-4 w-4 text-primary" />
                        Tutorial guiado
                      </div>
                      <ol className="space-y-3">
                        {selectedTopic.steps.map((step, index) => (
                          <li className="flex gap-3" key={step}>
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {index + 1}
                            </span>
                            <p className="pt-1 text-sm text-foreground/85">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                      Dica: os tutoriais são locais e não enviam perguntas para serviços externos.
                      Use o chat ao lado para encontrar o roteiro por palavra-chave.
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="flex min-h-0 flex-col border-t bg-card md:border-l md:border-t-0">
                <div className="border-b p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Chat rápido
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pergunte por rotina: fornecedor, nota, produto, relatório...
                  </p>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                  {messages.map((message) => (
                    <div
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm",
                        message.role === "assistant"
                          ? "bg-muted text-foreground"
                          : "ml-8 bg-primary text-primary-foreground",
                      )}
                      key={message.id}
                    >
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold opacity-80">
                        {message.role === "assistant" ? <Bot className="h-3 w-3" /> : null}
                        {message.role === "assistant" ? "Ajuda" : "Você"}
                      </div>
                      <p className="whitespace-pre-line">{message.text}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {helpTopics.slice(0, 4).map((topic) => (
                      <Button
                        className="h-8 rounded-full"
                        key={topic.id}
                        onClick={() => answerTopic(topic)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {topic.title.replace("Criar ", "").replace("Cadastrar ", "")}
                      </Button>
                    ))}
                  </div>
                  <form className="flex gap-2" onSubmit={submitQuestion}>
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label="Perguntar à ajuda rápida"
                        className="pl-9"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Ex.: importar nota"
                        value={query}
                      />
                    </div>
                    <Button aria-label="Enviar pergunta" size="icon" type="submit">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
