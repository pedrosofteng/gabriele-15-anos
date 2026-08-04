# Gabriele XV

Convite digital para a festa de 15 anos da Gabriele, publicado no Cloudflare Pages com confirmações compartilhadas em um banco D1 próprio.

## Visualizar

Instale as dependências, prepare o D1 local e execute o Pages:

```powershell
npm install
npx wrangler d1 migrations apply gabriele-15-anos-rsvps --local
npm run dev
```

Depois abra `http://localhost:8788/`.

Para verificar o projeto:

```powershell
npm test
npm run check:functions
```

## Páginas

- `index.html`: convite, contagem regressiva, informações, mapa e RSVP.
- `convidados.html`: métricas, busca, filtros, remoção e exportação CSV.
- `assets/convite-gabriele-15-anos.jpg`: cópia otimizada da arte original.
- `assets/convite-gabriele-480w.jpg` e `assets/convite-gabriele-720w.jpg`: versões responsivas para celulares e tablets.
- `assets/fonts/`: Bodoni Moda e Manrope servidas localmente para evitar dependência externa e reduzir mudanças de layout.

## Persistência

As respostas são salvas no banco D1 `gabriele-15-anos-rsvps` pelo endpoint `/api/rsvps`. O formulário e o painel usam o mesmo banco, portanto a lista é compartilhada entre celulares e computadores.

O painel `/convidados` e as operações de remoção estão públicos por decisão do projeto. A API valida e limita os campos no servidor, mas não exige autenticação.

Para aplicar novas migrações na base de produção:

```powershell
npx wrangler d1 migrations apply gabriele-15-anos-rsvps --remote
```
