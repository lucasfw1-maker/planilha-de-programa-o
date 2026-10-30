# Desempenho, hospedagem e proposta comercial

Avaliação de 30/10/2026. Cenário inicial informado: até 10 usuários simultâneos. Preço pretendido por empresa: R$ 5.000 de implantação/treinamento e R$ 650 mensais.

## Recomendação

Começar mantendo a arquitetura gerenciada atual (Vercel + Turso/libSQL), com plano que permita uso comercial, aplicação e banco próximos geograficamente, monitoramento e backup com restauração testada. Evitar uma migração de banco ou um servidor grande antes de medir produção. Para clientes em Cascavel, avaliar São Paulo para a API **se o banco também estiver próximo**. Apenas mover a API sem verificar onde está o banco pode piorar o tempo.

O projeto não fixa região em `vercel.json`. A região efetiva, o plano, a localização do banco, os limites e as métricas das contas não estão disponíveis neste ambiente. Não foi contratado nem alterado serviço pago. As páginas oficiais dos provedores recusaram consulta pela rede deste ambiente (403); portanto este documento não apresenta preços vigentes como confirmados.

## Melhorias implementadas sem alteração de layout

- Inicialização de banco já atualizado: assinatura do schema e das funções de migração permite uma verificação única, em vez de repetir schema e todas as migrações a cada nova instância. Novas versões refazem as verificações; uma falha nunca grava conclusão. Não muda a persistência nem elimina migrações necessárias.
- Resumos de chamados, manutenção e alterações de pedidos reunidos em uma API. A autorização continua sendo a dos módulos originais; cada perfil recebe somente os resumos permitidos. As APIs individuais permanecem disponíveis.
- GETs idênticos simultâneos na mesma aba compartilham a chamada em andamento. A resposta não fica em cache; operações de escrita invalidam o agrupamento e os resultados compartilhados são independentes.
- Índices de busca por data, vendedor/data e bomba/data reduzem a necessidade de varrer todo o histórico de agendamentos. Os planos de consulta foram conferidos nos testes.
- Consultas independentes de disponibilidade da frota em paralelo no banco remoto. Transações e a fila do SQLite local continuam preservadas.
- Respostas JSON passam a informar `Server-Timing` com tempo de inicialização e processamento. Os arquivos estáticos não aguardam o banco no handler local.

Atualizações continuam a cada 15 segundos. Regras de manutenção, escalas, permissões, concorrência, histórico e exportações foram preservadas. Não foi usado cache persistente de agendamentos ou de disponibilidade.

Manutenção futura: `database-startup.mjs` calcula a assinatura a partir do schema e do corpo das migrações. Ao mudar uma dependência externa de uma migração que altere seu comportamento sem mudar seu corpo/schema, atualizar a constante `revision` daquele módulo.

## Evidências e limites

Os testes usam dados fictícios e bancos temporários, sem acessar produção. O teste de carga cria 10 sessões de gestores, 560 agendamentos e 5 rodadas de consultas concorrentes. São lotes de APIs em rede local, e não 10 navegadores humanos nem uma simulação completa de uso, gravações concorrentes, PDFs, uploads e internet móvel.

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Requisições nos 50 lotes de agenda | 600 | 500 |
| Erros HTTP | 0 | 0 |
| Mediana do lote de APIs | 157 ms | 148 ms |
| Percentil 95 do lote de APIs | 258 ms | 294 ms |
| Inicialização de processo com banco existente | 138 ms | 112 ms |

O percentil 95 é o tempo abaixo do qual ficaram 95% dos lotes. O resultado local **não demonstra melhora uniforme de latência**: a mediana caiu, mas a cauda aumentou e o tempo de inicialização de processo caiu nesta execução. A redução de chamadas é determinística; timings variam neste ambiente compartilhado e com SQLite local. Não se deve prometer um percentual de aceleração em produção com esses números.

Na inicialização de um banco existente, o caminho antigo fez 61 operações de banco; o novo fez 1. Um ensaio separado, com **10 ms artificiais de espera por operação**, mediu 627 ms contra 10 ms. Isso demonstra o efeito das viagens de rede nesse trecho; não mede o banco remoto, a API inteira nem o tempo final do usuário. A criação inicial de um banco e a primeira execução de novas migrações continuam fazendo o trabalho necessário.

Para um gestor com acesso aos três resumos, o tráfego de notificações passa de 3 para 1 chamada por ciclo. Num cenário teórico de 10 gestores ativos por 8 h/dia, 22 dias/mês, somente esses resumos passariam de 1.267.200 para 422.400 requisições/mês. Agenda, presença, consultas e gravações continuam consumindo recursos e não estão incluídas nesse total. Vendedores e outros perfis já tinham menos resumos.

Reprodução:

```sh
npm test
npm run build
npm run test:browser
npm run test:appointment-changes-browser
npm run test:shifts-browser
node scripts/benchmark-performance.mjs
node scripts/benchmark-startup.mjs
```

O benchmark aceita como argumento um checkout anterior com dependências instaladas. Artefatos desta medição estão em `docs/performance/`.

## O que medir antes de investir

1. Nos horários de uso, registrar tempos de abertura da agenda, clientes, escalas e salvamento. Separar primeira requisição após inatividade das seguintes.
2. Cruzar Network/Server-Timing do navegador com logs da Vercel: tempo da API, erros, memória/CPU e reinicializações. Medir a latência do banco a partir da região real da API.
3. Conferir plano, região e consumo nas duas contas. Não registrar senhas, tokens, nomes de clientes ou conteúdo dos pedidos nas métricas.
4. Repetir carga numa homologação com banco remoto e 10 usuários, incluindo aprovações, gravações concorrentes e emissão de relatórios. Nunca bombardear o banco de produção.
5. Como objetivos iniciais de avaliação, buscar respostas comuns abaixo de 500 ms no percentil 95 em servidor aquecido e navegação usual perto de 1–2 s em conexão adequada. São metas de engenharia, não garantia contratual. Relatórios grandes e PDFs têm carga diferente.

## Comparação das opções

| Opção | Quando faz sentido | Ganho esperado e custo operacional |
| --- | --- | --- |
| Vercel + Turso/libSQL, bem localizados, plano comercial | Primeiro cliente, até 10 usuários, equipe pequena | Menor mudança e manutenção. Região/latência e limites importam mais que apenas pagar um plano superior. Não elimina toda inicialização nem promete tempo constante. |
| Serviço Node sempre ligado + banco gerenciado próximo | Medição aponta inicializações frequentes ou latência variável mesmo após otimização | Pode reduzir a oscilação de início e oferece recursos reservados. Exige implantação, monitoramento e teste de concorrência/backup. Avaliar um serviço pequeno e ampliar por métricas. |
| VPS em São Paulo, ponto de partida de teste 2 vCPU/4 GB + SSD persistente | Há responsável por operação e o custo total justifica | Pode diminuir viagens ao banco se estiver no mesmo local. Tamanho é hipótese de teste, não dimensionamento comprovado. Atualizações, segurança, backup externo, restauração e indisponibilidade passam a exigir trabalho próprio. Um VPS isolado não oferece alta disponibilidade. |
| Cluster, Kubernetes, Redis ou migração imediata para PostgreSQL | Gargalos específicos comprovados ou crescimento relevante | Complexidade e custos sem benefício demonstrado neste cenário inicial. Não recomendados agora apenas pelo número de usuários. |

Pagar hospedagem melhor pode trazer ganho grande **se** o limite atual ou a inicialização forem o gargalo. Se a maior espera estiver nas viagens ao banco, aumentar CPU sozinho pode trazer pouco. Não existe promessa responsável de “zero lag”; há orçamento de desempenho, monitoramento e correção de gargalos.

## Faz sentido R$ 5.000 + R$ 650/mês?

Pode fazer sentido como proposta B2B para uma concreteira que use os módulos e receba acompanhamento. Não há pesquisa de concorrentes nem validação de disposição a pagar neste estudo. Recomenda-se vender **implantação e treinamento + assinatura, suporte e manutenção**, explicitando as entregas.

A implantação deve definir configuração inicial, quantidade de importações, treinamento, usuários participantes e aceite. Se consumir 20 horas, R$ 5.000 correspondem a R$ 250/h bruto; viagens, impostos, preparação e retrabalho ainda saem desse valor. Novos módulos e personalizações relevantes precisam de orçamento próprio.

A mensalidade deve indicar unidade/empresa atendida, limite inicial de até 10 usuários simultâneos, armazenamento, suporte em horário comercial, franquia de atendimento e política de backup. Se houver mais usuários cadastrados que simultâneos, diferenciar esses limites. Não incluir desenvolvimento ilimitado ou atendimento 24 h sem precificar.

**Exemplo para planejamento, não cotação nem estimativa tributária:** de R$ 650, separar R$ 150 para infraestrutura, R$ 65 para tributos/taxas e R$ 150 para atendimento deixa R$ 285 antes de desenvolvimento, vendas, administração e lucro. Substituir pelos custos reais e pela orientação contábil. Se a infraestrutura custar R$ 300 e o atendimento R$ 250, com os mesmos R$ 65 de taxas restam R$ 35: o preço perde sustentabilidade. O primeiro cliente pode suportar custo fixo proporcionalmente maior.

Como limite interno de orçamento inicial, tentar manter infraestrutura e serviços básicos perto de R$ 100–200/mês por operação, **sujeito à cotação, câmbio, tráfego, armazenamento, backups e tributos**. Isso é um teto desejado para testar a viabilidade da proposta, não preço confirmado de fornecedor. Se ultrapassar, ajustar margem, escopo ou mensalidade. O investimento de R$ 5.000 não deve mascarar um prejuízo mensal recorrente.

## Ao vender para outras empresas

O sistema atual trabalha com uma operação empresarial; usuários e filiais não equivalem a isolamento entre clientes comerciais. Para o início, cada empresa deve ter banco, segredos e implantação próprios, com backups identificados, evitando misturar dados no mesmo banco. Uma arquitetura compartilhada para várias empresas exigiria implementar e testar isolamento por empresa em consultas, arquivos, relatórios e permissões antes de oferecê-la. Dez usuários de uma empresa são um cenário diferente de dez empresas com dez usuários cada.

## Próximo investimento recomendado

Primeiro, aplicar estas otimizações e medir produção. Para operação comercial, confirmar o enquadramento do plano da Vercel, a região efetiva, localização do Turso, retenção/restauração de backups e monitoramento. Escolher o menor plano comercial que cubra o uso medido. Só então aumentar recursos ou testar Node sempre ligado se os indicadores mostrarem necessidade. Não houve mudança de região, plano, banco ou cobrança neste trabalho.

Fontes oficiais a conferir na contratação (preços e regras atuais não puderam ser consultados daqui):

- https://vercel.com/pricing
- https://vercel.com/docs/plans/hobby — verificar restrições de uso comercial.
- https://vercel.com/docs/functions/configuring-functions/region
- https://turso.tech/pricing
- https://fly.io/docs/about/pricing/
