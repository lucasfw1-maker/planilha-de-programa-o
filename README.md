# Concresuper · Central de programação

Primeira versão funcional para **Cascavel – PR**, desenvolvida a partir da rotina da planilha de programação. Interface em português, verde/cinza/branco e navegação lateral alinhada ao sistema de obras fornecido em ZIP.

## Executar

Requer **Node.js 24 ou superior**, com libSQL. As dependências são instaladas com `npm ci`. O build verifica a aplicação; o frontend é estático, sem compilação adicional. O armazenamento usa libSQL, com arquivo SQLite local para desenvolvimento e banco Turso/libSQL remoto na Vercel.

```sh
cd /workspace/planilha-de-programa-o
npm ci
npm run check
npm test
npm start
```

Por padrão, o serviço escuta a porta 3000 na interface local. `PORT` e `HOST` podem ser configurados na hospedagem. A aplicação entrega frontend e API na mesma origem.

No primeiro acesso, cadastre a conta **Programador**. Em desenvolvimento local, o cadastro inicial não precisa de código. Antes de expor a aplicação publicamente, configure `ADMIN_SETUP_TOKEN` com um valor aleatório longo e use-o no campo “Código de configuração da hospedagem”. Em `NODE_ENV=production`, o código é obrigatório. Esse valor deve ficar no gerenciador seguro da hospedagem, nunca no código ou no chat.

Cadastre as bombas reais e os usuários em **Configurações**. Não há contas, senhas, obras ou volumes reais pré-cadastrados. O banco da aplicação começa vazio. Screenshots de revisão usam dados fictícios e um banco temporário separado.

## O que está implementado

- Agenda diária, semanal e mensal, incluindo datas futuras. Manhã/tarde são agrupamentos visuais; cada atendimento tem horário e duração próprios.
- Cadastro de obras com cliente, endereço, vendedor, data, início, duração, tipo de entrega, volume, brita, Fck, peça, observações e viagens previstas.
- Entregas com bomba e convencionais, sem bomba.
- Consulta de bombas disponíveis por data, início e duração; considera manutenção e intervalo entre obras. Uma consulta não efetua reserva.
- Bloqueio de conflitos na API. A margem inicial entre serviços da mesma bomba é 30 minutos, configurável pelo Programador. A mesma bomba pode ficar ocupada pela manhã e tarde, desde que a duração termine no mesmo dia.
- Edição de data, horário, duração, recurso e status pelo controlador, gerente e Programador. Não há arrastar/soltar nesta versão.
- Volume programado original preservado e volume realmente entregue editável, com auditoria. Volume entregue vazio é “Não informado”, não zero.
- Solicitações de vendedores, vinculadas automaticamente à conta autenticada; aprovação, recusa e proposta de ajuste com resposta.
- Notificações em pop-up para pedidos novos e respostas, consultadas a cada 15 segundos enquanto a página estiver aberta. Pedidos pendentes persistem e voltam a aparecer no próximo login. Não há notificação push fora do navegador.
- Relatórios por data inicial/final, vendedor, tipo e status; atalhos de período. Resumos por vendedor e detalhamento por obra.
- Agenda de amanhã com concreto, peça, vendedor, observações e viagens. Exportação genérica CSV e impressão/PDF via navegador. **O arquivo não é uma integração já homologada com o sistema de carregamentos.**

## Perfis e login

O fluxo reproduz o padrão do sistema de obras enviado: usuário e senha, mostrar/ocultar senha, solicitação pública de cadastro, aprovação pelo Programador, senha temporária no cadastro administrativo e troca obrigatória antes de acessar qualquer módulo. O Programador pode redefinir senhas confirmando a própria senha; isso encerra sessões antigas. Há troca de senha pessoal.

| Perfil | Permissões |
| --- | --- |
| Vendedor | Disponibilidade sem nomes/dados de clientes de outros vendedores, solicitar reserva, acompanhar seus pedidos, adicionar códigos comerciais nas próprias obras e consultar seu relatório |
| Controlador de logística | Agendamentos, solicitações, consulta/bloqueio por manutenção, volume entregue e relatórios da filial |
| Gerente | Operação e relatórios, mais o módulo Gerência para cadastrar bombas, ajustar frota e metas |
| Programador | Tudo, cadastros, aprovação/bloqueio de usuários, redefinição de senha, parâmetros e auditoria |

Somente a primeira conta recebe o perfil Programador; a API impede atribuí-lo às demais. Sua identificação usa a mesma **coroa de contorno** do sistema de obras, acompanhando a cor e o tamanho do nome. O símbolo da marca também é usado como favicon.

**As contas são independentes das contas do sistema de obras.** Nenhum usuário, senha, sessão, Redis ou planilha daquele sistema foi importado ou alterado. Login único entre os dois exige uma integração futura com o provedor de identidade, sem copiar senhas.

Senhas usam scrypt com sal aleatório; sessões usam cookies HttpOnly/SameSite, tokens aleatórios e armazenamento do hash do token. Permissões são verificadas no servidor. Auditoria não guarda senhas.

## Dados e hospedagem

**A aplicação está preparada para um novo projeto na Vercel, separado do sistema de obras.** Siga [o guia de publicação](docs/PUBLICACAO.md). A Vercel serve `public/` e executa a API Node em `api/index.mjs`; o banco remoto é Turso/libSQL, com `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` exclusivos deste projeto. Sem essas variáveis na Vercel, a API retorna um erro de configuração e não usa armazenamento efêmero.

Em desenvolvimento, sem URL remota, o SQLite persiste em `.data/cascavel.sqlite` (fora do Git). `DB_PATH` permite outro caminho. Faça backups consistentes, incluindo o estado WAL quando aplicável; não copie somente o arquivo principal durante gravações.

Para a primeira conta em produção, configure `ADMIN_SETUP_TOKEN` aleatório com pelo menos 32 caracteres e use-o na tela HTTPS. O token deve ser exclusivo da concreteira. Depois do cadastro, remova-o da hospedagem. Cookies são Secure automaticamente na Vercel; `APP_ORIGIN` permite restringir a origem HTTPS exata. Previews devem usar um banco separado da produção.

O projeto inclui `.env.example` sem valores secretos. O Node não o carrega automaticamente: use as variáveis da hospedagem ou `node --env-file=.env server.mjs` no desenvolvimento. Não use nem altere as credenciais, planilhas ou o Redis do sistema de obras.

Login compartilhado, MFA, recuperação por e-mail e observabilidade de produção ainda não estão implementados. A validação em uma instância real da Vercel e no banco remoto depende dos acessos da hospedagem; nenhum deploy remoto deve ser considerado concluído apenas pelo build local.

A filial está fixa em Cascavel nesta primeira versão. Inclusão de outras filiais e escopo de bombas compartilhadas exigirá ampliar o modelo de dados e os filtros de permissão antes de liberar acesso a outras unidades.

## Contagens e relatórios

“Viagens previstas” é uma estimativa automática: volume ÷ capacidade de 8, 9 ou 10 m³, arredondada para cima. A média de 9 m³ é o padrão para planejamento de frota mista; não há limite de “obra grande” presumido. A distribuição de veículos individuais ainda não está incluída.

Os relatórios usam a **data programada da obra**, inclusive para o volume entregue associado àquela obra; não são relatórios fiscais por data real de cada carga. Cancelados ficam excluídos por padrão, mas podem ser filtrados separadamente. Quando existe obra sem volume entregue, a diferença total daquele vendedor é exibida como aguardando informações.

Solicitações pendentes não contam no volume confirmado. A aprovação revalida o conflito em uma transação antes de reservar a bomba. Entregas convencionais não bloqueiam bombas; ainda não há controle de capacidade da central ou conflitos por caminhão.

## Marca e referências

O ZIP `Sistema--main.zip` foi consultado apenas como referência. Reutilizou-se o componente de mostrar senha e a coroa de contorno, adaptando os perfis para a concreteira. O símbolo em `public/favicon.svg` é uma reconstrução vetorial provisória. Os relatórios usam `public/logo-concresuper.png`, versão com transparência preparada a partir da imagem da marca enviada pelo usuário. O nome é exibido em texto, sem depender de fontes externas.

As consultas aos sites de referência foram bloqueadas com HTTP 403 pelo proxy do ambiente. O código do ZIP e as imagens permitiram prosseguir. Não foram publicadas alterações nos sites existentes.

## Verificação

`npm test` executa testes reais de API com servidor HTTP e banco temporário, incluindo autenticação, perfis, conflitos, pedidos, entrega, relatórios, aprovação/bloqueio e redefinição de senha. `npm run check` verifica a sintaxe do servidor e frontend.

Também foi realizada verificação com Chromium/Playwright em ambiente temporário: cadastro inicial, login, navegação dia/semana/mês, registro do entregue, filtros e CSV, tela de celular, favicon, coroa exclusiva do Programador, troca obrigatória de senha e envio de solicitação pelo vendedor. Nenhuma conta real foi criada.

Para repetir a verificação visual, execute `npm run test:browser`. Requer Chromium instalado no sistema (detecta `/usr/bin/chromium`) ou um navegador instalado por `npx playwright install chromium`. `BROWSER_EXECUTABLE` permite indicar o caminho. O teste cria e remove seu próprio banco, sem usar os dados reais. As imagens geradas em `.data/review/` contêm apenas exemplos fictícios.

Após a adaptação para Vercel, os testes também cobrem a entrada serverless, ausência de fallback para disco efêmero, exigência de TLS, cadastro inicial protegido, limitação de tentativas persistente entre reinícios e reservas concorrentes. O limite de tentativas agora fica no banco, para valer entre instâncias. A conexão com um banco remoto real permanece pendente até configuração das credenciais.

## Cancelamentos, remarcações e clientes

Clique em uma obra na agenda para acessar **Remarcar agendamento**, **Cancelar agendamento** e **Histórico**. Cancelamentos e mudanças de data, horário, duração ou recurso exigem motivo. O cancelamento libera o horário e preserva a bomba anteriormente utilizada. A remarcação confere conflitos novamente antes de gravar; alterações concorrentes feitas a partir de uma tela desatualizada são recusadas. Uma obra cancelada pode ser reativada pelo botão Remarcar, com motivo e nova conferência de disponibilidade.

Em **Relatórios → Cancelamentos e remarcações**, filtre por período, cliente (sem diferenciar acentos), vendedor e ocorrência. A referência de data pode ser a data da alteração, a data anterior da obra ou a nova data. Há indicadores, gráficos por período, ranking de clientes, volumes por vendedor, detalhes de motivo/responsável e programação anterior/nova. CSV e impressão/PDF do navegador respeitam os filtros.

As contagens são de **ocorrências**, não de vendas novas. Uma obra remarcada duas vezes produz dois registros. O volume movimentado soma o volume por ocorrência; o número de obras distintas aparece separado. O relatório mostra também a situação atual da obra, pois um cancelamento antigo pode ter sido seguido por uma reativação.

A atualização cria tabelas e índices de forma aditiva. Uma migração idempotente recupera os cancelamentos e remarcações que já estavam na auditoria. Motivos antigos ausentes são identificados como não registrados. Cancelamentos sem auditoria não recebem uma data inventada; podem ser incluídos no relatório pela opção de registros sem data. Datas recuperadas da auditoria são convertidas de UTC para America/Sao_Paulo.

A aba **Clientes** guarda automaticamente a última configuração usada por cliente e vendedor, ao salvar uma agenda ou solicitação. No novo formulário, escolha **Preencher com cliente cadastrado** para recuperar obra, volume, brita, Fck, peça, observações, duração, tipo e viagens. **Data, horário e bomba não são reutilizados.** Revise sempre as especificações: o último pedido não garante que o próximo tenha o mesmo concreto ou aditivo. A mudança nos padrões do cliente não altera as agendas históricas.

Vendedores consultam somente seus clientes, suas ocorrências e seus históricos. Gerente, controlador e Programador consultam os dados da filial. Cadastros já presentes em agendas e solicitações são recuperados pela migração inicial sem excluir ou alterar os registros originais. Por enquanto, o cadastro é por nome normalizado e vendedor; CPF/CNPJ, contatos e múltiplos padrões por obra não foram adicionados.

Os formulários de criação, edição, remarcação, aprovação e disponibilidade usam **horas** para a duração: `2` para duas horas, `1,5` para uma hora e meia. Aceitam vírgula ou ponto e preservam os agendamentos existentes. Internamente, a API continua trabalhando em minutos inteiros; frações são arredondadas ao minuto mais próximo. Durações nos CSVs do histórico são identificadas em horas.


## Frota, produção e metas mensais

A agenda mostra a produção prevista por CB (volume programado ÷ caminhões disponíveis) e o volume entregue informado por CB. A frota inicial é 17. **Gerente e Programador** podem ajustar a quantidade em uma data específica, definir um novo padrão a partir de uma data ou remover um ajuste diário para usar o padrão. O padrão anterior às mudanças é preservado; ajustes específicos têm prioridade. Controlador consulta os indicadores, sem editar frota ou meta. Vendedor não acessa esses totais da filial.

Na visão de dia, a unidade é m³/CB. Na semana e no mês, é uma média de m³/CB/dia: soma dos volumes ÷ soma dos caminhões disponíveis em cada dia do período (CBs-dia), incluindo os dias do calendário selecionado. Frota zero não causa divisão por zero; obras em dia sem frota geram aviso. Não há distribuição por placa nem bloqueio de agendas pela quantidade de CBs nesta versão.

Viagens são calculadas no servidor, inclusive se alguém adulterar o campo somente leitura da tela. O cadastro, a edição, as solicitações e a aprovação permitem escolher 8, 9 ou 10 m³ para a estimativa. Padrões de cliente guardam a capacidade utilizada. A migração recalcula com média de 9 m³ apenas agendamentos futuros ativos e pedidos futuros pendentes; viagens antigas, entregas concluídas e cancelamentos antigos são preservados como previsões legadas.

A meta é configurada por mês. O volume programado usa a data atual da agenda, inclui obras confirmadas/em atendimento/concluídas e exclui canceladas e pedidos pendentes. Remarcar para outro mês transfere o volume entre os meses automaticamente. A tela mostra meta, programado, percentual atingido, saldo em m³ e percentual restante; acima da meta, o saldo fica em zero e o excedente é identificado.

Em **Relatórios → Produção e metas**, há comparação do programado com o entregue informado, gráficos diários/acumulados e produção por CB. A projeção separa o saldo a programar do saldo a entregar e divide cada um pelos dias de operação restantes, contando a data de referência inclusive. É possível escolher segunda a sábado (padrão), segunda a sexta ou todos os dias. Feriados/paralisações não são inferidos. Mês encerrado sem dias restantes não produz valores infinitos. Sem meta, a necessidade diária não é inventada.

A data de referência altera os dias restantes; os volumes são os registros atuais, não uma reconstrução de como estava o banco em uma data passada. Entregas continuam atribuídas à data agendada da obra; ainda não há registro individual da data de cada carga. Obras sem volume entregue ficam sinalizadas. CSV inclui um resumo e as linhas diárias; a impressão/PDF inclui os gráficos e o cabeçalho com a logo Concresuper transparente, sem marcas do consórcio/DER.

No relatório de produção, o volume programado exclui cancelamentos, mas entregas já informadas são preservadas mesmo se o restante da obra for cancelado. Isso evita apagar uma produção que já ocorreu.


## Módulo Gerência e períodos de manutenção

**Gerência** reúne bombas, quantidade de CBs e metas mensais. Gerente e Programador acessam o módulo e cadastram bombas. Configurações mantém usuários, permissões e parâmetros administrativos. Controlador pode consultar os indicadores e operar a agenda, sem cadastrar bombas ou editar frota/meta.

O botão **Bomba em manutenção** fica no topo da agenda, antes de Consultar disponibilidade. Gerente, Controlador e Programador escolhem a bomba, início/fim (inclusive horários e períodos de vários dias) e motivo obrigatório. O bloqueio é aplicado somente aos serviços que sobrepõem o intervalo, em horários locais de Cascavel. No fim do período, a bomba volta a estar disponível sem depender de um processo agendado. A consulta de disponibilidade e a criação/remarcação verificam os mesmos períodos.

Manutenções que coincidam com obras existentes são registradas e apresentam essas obras para revisão; não cancelam nem removem os agendamentos. Registrar o volume entregue de uma obra existente continua permitido. O cancelamento de um período exige motivo e fica na auditoria. Bloqueios antigos sem datas continuam ativos até serem liberados explicitamente no painel, sem apagar períodos cadastrados. Vendedores veem o bloqueio de disponibilidade, sem os motivos internos de manutenção.


A agenda exibe os indicadores mensais em anéis no topo, acima dos botões: meta, programado, entregue informado e saldo a programar. Produção prevista por CB e frota disponível ficam no mesmo grupo e se referem à data/período da agenda; o arco da produção por CB mostra o entregue em relação ao previsto, e o da frota compara a disponibilidade com o padrão vigente. Valores acima de 100% permanecem nos textos e dados; o arco para em uma volta completa. Sem meta ou denominador disponível, nenhum percentual é inventado.

O relatório Produção e metas também compara o programado e o entregue por vendedor, em gráfico e tabela, respeitando o mesmo mês e as mesmas regras dos totais. Vendedores sem movimento ficam em zero, e entregas não informadas são sinalizadas. A exportação CSV inclui as linhas por vendedor. A barra de rolagem do menu permanece funcional, com trilho transparente e indicador fino.

### Informações comerciais e foto de perfil

Na agenda, **Adicionar informações** permite preencher código do cliente, pedido e item. O vendedor altera somente suas próprias obras; obras de outros vendedores mostram apenas ocupação. Programador, gerente e controlador podem alterar qualquer agendamento. O código do cliente é reutilizado em novas agendas da mesma carteira; pedido e item pertencem exclusivamente à obra. A agenda de amanhã apresenta, por exemplo, **Dallo 5310/2020-1**, inclusive na exportação.

Clique na foto ou nas iniciais no rodapé do menu para escolher ou remover sua foto. O navegador recorta a imagem centralmente e reduz para JPEG de 192 × 192; o banco persistente guarda a foto, inclusive na Vercel. Cada pessoa troca apenas a própria foto. Fotos circulares aparecem nas identificações dos vendedores em relatórios e abaixo dos nomes no gráfico de volumes, inclusive na impressão/PDF. Sem foto, aparecem as iniciais.
