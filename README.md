# Gabriele XV

Convite digital estático para a festa de 15 anos da Gabriele.

## Visualizar

Sirva esta pasta com um servidor local. No PowerShell:

```powershell
python -m http.server 8080
```

Depois abra `http://localhost:8080/`.

Para verificar a camada de dados:

```powershell
node --test tests/data.test.js tests/mobile-contract.test.js
```

## Páginas

- `index.html`: convite, contagem regressiva, informações, mapa e RSVP.
- `convidados.html`: métricas, busca, filtros, remoção e exportação CSV.
- `assets/convite-gabriele-15-anos.jpg`: cópia otimizada da arte original.
- `assets/convite-gabriele-480w.jpg` e `assets/convite-gabriele-720w.jpg`: versões responsivas para celulares e tablets.
- `assets/fonts/`: Bodoni Moda e Manrope servidas localmente para evitar dependência externa e reduzir mudanças de layout.

## Persistência desta base

Esta versão salva as respostas em `localStorage`, portanto os dados existem apenas no navegador em que foram cadastrados. Isso é adequado para demonstração e aprovação visual.

Antes da publicação real, conecte o formulário a um banco (por exemplo, Supabase/Firebase ou uma API própria), acrescente proteção administrativa à página de convidados, validação no servidor, antispam e política de privacidade. Nunca coloque uma chave administrativa no JavaScript do navegador.
