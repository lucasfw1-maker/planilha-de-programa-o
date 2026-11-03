# Minuta — privacidade e tratamento de dados ConcretLog

**Documento proposto, ainda não publicado e não aceito pelos clientes.** Não declara que processos ainda pendentes já estejam implementados. Preencher a identificação e validar os controles de `pendencias-antes-de-usar.md` antes de usar esta política ou anexá-la a contratos.

## 1. Identificação e contato

Fornecedor: **[NOME CIVIL COMPLETO]**, pessoa física, CPF **[PREENCHER PRIVADAMENTE]**, endereço **[PREENCHER]**, que atua sob a marca ConcretLog. Atualizar a identificação ao constituir pessoa jurídica, com comunicação aos contratantes.

Contato de privacidade, direitos e segurança: **comercial@concretlog.com.br**. Esse canal não representa, por si só, nomeação formal de encarregado de dados. Verificar com assessoria as obrigações aplicáveis ao porte e à atividade.

## 2. Papéis e responsabilidades

A concreteira é, em regra, **controladora** dos dados que decide cadastrar de clientes, contatos, funcionários, motoristas, equipes e demais pessoas relacionadas à sua operação. Cabe à concreteira definir finalidades e bases legais, fornecer avisos aos titulares, manter dados adequados e orientar seus usuários.

A ConcretLog é, em regra, **operadora** desses dados ao hospedar, armazenar, consultar, exportar, corrigir ou excluir informações por instruções documentadas e lícitas da contratante. A ConcretLog também poderá atuar como controladora dos dados necessários ao próprio relacionamento comercial, cobrança, segurança e cumprimento de obrigações, com finalidades e bases legais próprias e limitadas. A definição de papéis depende do tratamento efetivo, não apenas do nome no contrato.

A ConcretLog não usará os registros das concreteiras para publicidade de terceiros, venda de cadastros ou treinamento de modelos de IA sem nova avaliação jurídica e fundamento válido. Contas de empresas diferentes devem ter ambientes, bancos e credenciais próprios na arquitetura atual.

## 3. Categorias e finalidades

| Categoria | Exemplos | Finalidade |
| --- | --- | --- |
| Conta e identificação | Nome, login, perfil, foto opcional, senha protegida por hash | Autenticar, identificar responsáveis e controlar permissões |
| Operação da concreteira | Nomes e contatos de clientes, endereços de obras, contratos, agendas, equipes, motoristas, placas | Executar as funcionalidades contratadas |
| Atendimento e documentos | Mensagens, imagens, PDFs, laudos e registros de alterações | Dar continuidade aos atendimentos e manter rastreabilidade |
| Segurança e suporte | Eventos de acesso, sessões, registros técnicos e ações autorizadas de suporte | Prevenir incidentes, solucionar falhas e comprovar ações |
| Relacionamento com a ConcretLog | Contatos comerciais, mensagens, dados contratuais e fiscais | Responder solicitações, administrar contrato e cumprir obrigações |

Evitar inserir senhas, dados bancários, documentos pessoais completos ou dados sensíveis nos campos livres e anexos, salvo necessidade demonstrada e procedimento específico acordado. O acesso a fotos é condicionado às permissões do sistema; não se presume tratamento biométrico para identificação automática.

Bases legais devem ser avaliadas por finalidade. A execução contratual poderá se aplicar a dados necessários ao contrato com o próprio titular; obrigações legais e legítimo interesse podem se aplicar quando cabíveis e avaliados. Não usar execução do contrato entre empresas como justificativa automática para todo dado pessoal de terceiros, nem exigir consentimento genérico para qualquer tratamento.

## 4. Acesso de suporte

O acesso a dados de produção será limitado a pessoas autorizadas, com dever de confidencialidade, contas identificadas e menor privilégio necessário. O diagnóstico deve preferir dados fictícios ou anonimizados.

Quando uma intervenção em produção for necessária, registrar solicitação/autorização, finalidade, responsável, período e ações realizadas. Em emergência de segurança ou continuidade, pode ser necessária ação estritamente limitada para conter o problema, com justificativa e comunicação posterior sem demora injustificada. Não há autorização permanente e irrestrita para consultar todos os dados.

Nunca solicitar a senha pessoal do usuário por e-mail, mensagem ou telefone. Não encaminhar bases reais para ferramentas de IA, repositórios públicos ou ambientes de demonstração. Exportações de diagnóstico devem ter acesso limitado e exclusão após a finalidade.

## 5. Fornecedores e compartilhamento

A arquitetura prevista usa Vercel para aplicação/site, Turso/libSQL para banco e serviço SMTP de e-mail documentado para Locaweb. O fornecedor efetivo, plano, finalidade, localização e contatos contratuais devem ser confirmados antes da ativação. O repositório de código não deve conter bases de clientes ou segredos.

A participação de provedores não dispensa verificar confidencialidade, segurança, subprocessadores e condições contratuais. Se houver transferência internacional, identificar as regiões e adotar os mecanismos legais aplicáveis; esta minuta não presume armazenamento exclusivo no Brasil nem usa aceite genérico como autorização suficiente para qualquer transferência.

Não compartilhar informações entre clientes. Acessos por determinação legal ou autoridade competente devem ser avaliados, limitados ao necessário e registrados.

## 6. Retenção, exportação e exclusão

Durante o contrato, manter os dados operacionais necessários ao serviço e às instruções da controladora, com revisão de necessidade e correção de excessos.

Após a **data efetiva do encerramento**, a contratante terá **30 dias corridos** para solicitar e receber exportação de seus dados operacionais, com entrega segura e validação do solicitante. O formato deve ser definido no contrato/implantação: formatos estruturados adequados e documentos/anexos originais quando aplicável. Não incluir senhas, hashes de senha, tokens, segredos ou dados de outras empresas. A exportação completa ainda depende de procedimento operacional validado; não confundi-la com exportar apenas os relatórios visíveis.

A janela de exportação não renova automaticamente a assinatura nem garante continuidade irrestrita de cadastros e alterações. O acesso no período pode ser restrito à consulta/exportação, conforme procedimento acordado.

Ao concluir os 30 dias, iniciar a exclusão/anonimização programada dos dados operacionais na base principal. O procedimento precisa abranger também anexos, versões, snapshots, históricos e cópias auxiliares que contenham os mesmos dados. Informar ao cliente o resultado e as exceções justificadas.

Podem permanecer dados estritamente necessários a obrigações legais/regulatórias, exercício regular de direitos ou outras hipóteses legalmente admitidas. Documentar categoria, fundamento, acesso restrito e prazo aplicável; não usar a ressalva para guardar todo o banco indefinidamente.

**Backups:** informar no contrato o ciclo, localização e prazo máximo de expiração das cópias, de acordo com os serviços efetivamente contratados: **[PRAZO E PROCEDIMENTO A CONFIRMAR]**. Dados excluídos não devem retornar ao uso normal após uma restauração; manter procedimento para reaplicar exclusões. Não anunciar eliminação instantânea de cópias históricas quando isso não ocorrer tecnicamente.

Registros de segurança e auditoria devem ter finalidade e prazo documentados: **[PRAZO A DEFINIR COM ASSESSORIA E PLANO TÉCNICO]**. A auditoria atual pode conter dados operacionais em antes/depois; sua retenção não pode ser tratada como um arquivo técnico anônimo por padrão.

## 7. Direitos dos titulares

Pedidos de informação, confirmação, acesso, correção, oposição, revogação de consentimento quando aplicável e exclusão podem ser enviados ao contato de privacidade. Verificar identidade sem coletar dados excessivos e atender nos prazos e limites legais.

Quando o pedido se referir aos registros tratados em nome de uma concreteira, encaminhá-lo à controladora e auxiliá-la, sem decidir unilateralmente sobre exclusões que dependam da instrução e do fundamento jurídico. Para dados próprios da ConcretLog, responder diretamente. A inadimplência contratual não elimina os direitos dos titulares.

## 8. Segurança e incidentes

Medidas previstas incluem proteção de senhas, sessões e permissões, comunicação criptografada, segregação de empresas, cópias de segurança, revisão de acessos e atualização de dependências. Confirmar a implantação de cada controle antes de descrevê-lo como efetivo.

A ConcretLog, quando operadora, comunicará à controladora incidentes relevantes sem demora injustificada após ciência, fornecendo as informações disponíveis, medidas de contenção e atualizações. A controladora avaliará as comunicações à ANPD e aos titulares conforme os requisitos e prazos legais; a ConcretLog prestará assistência. Não esperar a conclusão de toda investigação para comunicar o que já é conhecido quando a lei ou o risco exigirem ação anterior.

O horário regular de suporte não afasta obrigações legais relativas a incidentes. Antes de comercializar, deve existir responsável e procedimento de escalonamento para esse cenário, ainda que não haja plantão comercial 24 horas.

## 9. Site institucional

O formulário do site coleta e-mail, telefone, assunto e mensagem para responder ao contato e encaminha os dados ao e-mail comercial pelos serviços de hospedagem e SMTP. A aplicação do site não mantém hoje um banco de leads próprio; a mensagem fica na caixa de e-mail e pode existir em registros/cópias do provedor. Definir retenção da caixa e procedimento de exclusão antes de publicar prazos.

Na versão analisada, não há ferramenta de publicidade ou análise de audiência integrada. Existem recursos de sessão e segurança no sistema e registros técnicos dos provedores. Links para Instagram levam a serviço de terceiro com suas próprias condições; não representam autorização para transferir a ele os registros das concreteiras.

## 10. Alterações e validade

Atualizações materiais da política serão comunicadas de forma adequada. Não alterar retroativamente a finalidade do tratamento ou retirar direitos por simples mudança unilateral de texto. Preencher versão, data de vigência e identificação antes de publicar, após revisão jurídica.
