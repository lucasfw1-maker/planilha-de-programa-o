# Publicação na Vercel, separada do sistema de obras

Este projeto é exclusivo da **Concresuper — Cascavel PR**. Não altere o projeto, domínio, variáveis, Google Planilhas ou Redis do sistema de obras. O ZIP daquele sistema foi apenas uma referência de layout e fluxo de acesso.

## 1. Repositório

Use `lucasfw1-maker/planilha-de-programa-o`, com os arquivos desta aplicação. Não substitua o repositório `Sistema-` do consórcio. A branch de produção deve conter `vercel.json`, `api/index.mjs`, `storage.mjs`, `schema.mjs`, `server.mjs`, `public/` e os manifests de dependências.

## 2. Banco próprio

Crie um banco Turso/libSQL **novo e separado**, dedicado à concreteira, pela conta do provedor ou integração disponível na hospedagem. Não use o banco nem tokens do sistema de obras.

Copie para as configurações seguras do novo projeto na Vercel:

| Variável | Origem / finalidade |
| --- | --- |
| `TURSO_DATABASE_URL` | Endereço HTTPS ou libsql com TLS fornecido pelo novo banco |
| `TURSO_AUTH_TOKEN` | Token de acesso de leitura/escrita ao novo banco; mantenha como segredo |
| `ADMIN_SETUP_TOKEN` | Código inicial aleatório, exclusivo, com pelo menos 32 caracteres, para cadastrar o primeiro Programador |
| `APP_ORIGIN` | Opcional: endereço HTTPS exato do novo site, sem barra no final; por padrão usa o hostname da requisição na Vercel |

Cadastre as variáveis nos ambientes de implantação desejados. Não compartilhe produção com previews que possam receber testes de gravação: use um banco separado para preview/teste. Não envie tokens nem senhas pelo chat e não inclua seus valores no Git.

A aplicação cria seu esquema de forma aditiva no banco indicado. Essa inicialização **não importa dados do outro sistema e não cria usuários automaticamente**. Na Vercel, a aplicação recusa iniciar com banco local ou conexão remota sem TLS, em vez de guardar dados em disco efêmero.

## 3. Novo projeto na Vercel

Na mesma conta da Vercel:

1. Escolha **Add New → Project** e importe `lucasfw1-maker/planilha-de-programa-o`.
2. Use um nome próprio, por exemplo `concresuper-programacao`. Não selecione o projeto existente do sistema de obras.
3. Mantenha a raiz como `.` e o Framework Preset como **Other**.
4. Use Node.js **24.x**. O arquivo `vercel.json` configura instalação `npm ci`, build `npm run build`, frontend em `public` e API em `api/index.mjs`.
5. Configure as variáveis da seção anterior e faça o deploy.

O site e a API ficam na mesma origem. A Vercel deve resolver as funções Node e os rewrites do arquivo de configuração. O serviço local `npm start` não precisa ficar rodando para o site publicado funcionar.

## 4. Primeiro acesso e validação

1. Abra o **novo endereço** publicado e confira a marca da Concresuper e a unidade Cascavel.
2. Cadastre sua conta Programador pela tela inicial, usando o código definido em `ADMIN_SETUP_TOKEN`. Informe sua senha diretamente na tela HTTPS.
3. Cadastre uma bomba e um vendedor de teste. Confira a troca obrigatória da senha temporária.
4. Faça uma reserva, tente outra conflitante e confirme que o bloqueio funciona. Verifique também uma entrega convencional.
5. Envie uma solicitação com a conta do vendedor e confira o pop-up e a aprovação na conta da logística.
6. Registre o volume entregue e consulte o relatório, além da exportação da agenda de amanhã.
7. Recarregue a página e repita o login para conferir a persistência. Verifique as funções/logs da nova aplicação em caso de erro, sem expor credenciais.
8. Após criar o Programador, remova o código inicial das variáveis da hospedagem e faça o redeploy. Mantenha as credenciais do banco.

A coroa de contorno aparece somente para o único Programador cadastrado inicialmente. Gerente e controlador possuem os mesmos acessos operacionais; vendedor não pode confirmar reservas ou ver dados dos clientes de outros vendedores.

## Evidências e pendências

A entrada serverless e as regras de configuração são testadas localmente, assim como a persistência entre reinícios, os conflitos concorrentes e o fluxo no navegador. Isso **não equivale a uma implantação já feita na Vercel**: o banco remoto e a URL real precisam ser verificados após a conexão das contas e a publicação.

Sem acesso conectado ao projeto da Vercel e sem o endereço/token do banco próprio, não é possível efetuar ou validar a publicação remota. O projeto anterior permanece independente.
