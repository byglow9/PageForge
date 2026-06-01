## Nova página: Roteiro Grécia (`/grecia`)

Vou criar uma nova campanha em `src/components/campaigns/grecia/` + página `src/pages/Grecia.tsx`, registrando a rota em `src/App.tsx`. O conteúdo segue o template padrão (placeholders que você ajusta depois), mas a identidade visual é construída do zero a partir da imagem de referência.

### Direção estética (extraída da imagem)

- **Paleta:** teal profundo (`#0E5C66`/`#0B3D44`) como cor principal, branco puro para texto sobre foto, areia clara (`#F4EDE2`) como fundo de seções alternadas, acento coral suave (`#E8A87C`) para CTAs.
- **Tipografia:** display grande em peso black com versão *outline* (igual ao "DESTINATION" da referência) — usar **Archivo Black** + variação `-webkit-text-stroke` para o efeito contorno. Body em **Inter** leve.
- **Composição:** hero edge-to-edge com foto cinematográfica do mar Egeu, headline gigante sobreposta à esquerda, ícones sociais em coluna vertical à esquerda, padrão de pontos decorativos, e **trio de cards flutuantes à direita** entrando sobre a foto (replicando "Hidden Gems / Cultural / From Dreams" da referência).
- **Espaçamento:** generoso, minimalista, muito respiro. Sem bordas pesadas — cards com sombra suave e cantos levemente arredondados (`rounded-xl`).
- **Detalhes:** setas de navegação chevron empilhadas (`◄◄◄`), pontos decorativos em grid no canto, divisores finos.

### Estrutura da página (mesmas seções do template)

1. **Navbar** transparente sobre hero, vira sólida teal ao rolar.
2. **Hero** "EXPLORE GRÉCIA ANTIGA" com display outline + 3 mini-cards flutuantes (Ilhas, Cultura, Mediterrâneo).
3. **SobreViagem** — fundo areia, texto centrado, destaque para datas/cidades (placeholder).
4. **Inclusos** — grid de 6 itens (lista padrão de inclusões da memória do projeto), ícones lineares.
5. **Roteiro** — carrossel Embla no padrão da memória `itinerary-carousel-standard`, com cards bilingues; dias placeholder Atenas → Delfos → Meteora → Santorini → Mykonos.
6. **PorQueRenova** — 4 motivos em grid assimétrico.
7. **Depoimentos** — `GoogleReviewsCard` acima + 3 depoimentos placeholder.
8. **InscrevaSe** — formulário leva ao WhatsApp em nova aba (contato Guilherme +55 19 99201-6125 como padrão; trocamos depois se quiser).
9. **Footer** compartilhado.

### Detalhes técnicos

- Tokens novos adicionados em `src/index.css` sob um escopo `.theme-grecia { --primary: ...; --secondary: ...; --accent: ...; }` aplicado no wrapper da página — não afeta o resto do site.
- Fontes Archivo Black + Inter importadas em `index.css`.
- Imagens: usar `imagegen` para gerar 6–8 fotos (hero Santorini, Partenon, Meteora, Mykonos, Delfos, mar Egeu, embarque, retorno) salvas em `src/assets/grecia/`.
- Visibilidade no hub controlada por `src/data/campaigns.ts` (campanha começa **oculta** por padrão conforme memória `campaign-visibility`; você habilita quando quiser).
- SEO via `<Seo>` com title/description em pt-BR e JSON-LD `TouristTrip`.
- Analytics GA4 reaproveitando o ID já usado na Turquia.
- WhatsApp e estrutura de form seguem `form-submission-logic`.

### Arquivos a criar

- `src/components/campaigns/grecia/{Navbar,Hero,SobreViagem,Inclusos,Roteiro,PorQueRenova,Depoimentos,InscrevaSe}.tsx`
- `src/pages/Grecia.tsx`
- `src/assets/grecia/*.jpg` (geradas)
- Edits: `src/App.tsx` (rota `/grecia`), `src/index.css` (tokens + fonts), `src/data/campaigns.ts` (entrada oculta).

Posso seguir?