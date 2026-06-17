---
status: complete
phase: 05-catalog-grecia-acceptance
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-06-16T00:00:00Z
updated: 2026-06-17T00:00:00Z
mode: mvp
user_story: "As a membro do workspace, I want to organizar e buscar LPs no catálogo, so that encontro e reutilizo LPs rapidamente."
---

## Current Test

[testing complete — 18/18 pass after gap-closure 05-04/05/06 + round-2.1 refinements]

## Tests

### 1. Cold Start Smoke Test
expected: Servidor sobe do zero sem erros; schema (folder/tag/lp_tag + folder_id) presente no DB; catálogo carrega dados ao vivo.
result: pass
note: "Banco resetado e recriado (drop schema + migrate deploy 0001-0004 + db push). App sobe, signup + criação de workspace funcionam, dashboard renderiza role 'Owner' ao vivo. Cosmético separado registrado em Gaps (padding do dashboard placeholder)."

### 2. Catálogo — layout de dois painéis
expected: Em /w/{slug}/lps a página mostra a FolderTree à esquerda (com raiz "All LPs") e a grade de LPs à direita; header com separador acima dos dois painéis.
result: pass
reported: "tem dois botões de gerar lp na tela e também a barra de search está colada na linha de cima"
note: "RESOLVIDO por 05-05. Re-teste 2026-06-17 (imagem 3): um único 'Generate LP' no header; CTA do empty state removido; search bar com respiro (pt-4). Layout de dois painéis OK."

### 3. Criar e aninhar pastas
expected: Pelo menu da pasta (kebab) "New subfolder" / botão de criar, criar uma pasta e uma subpastas dentro dela; a árvore mostra indentação de 16px/nível e chevrons de expandir/colapsar.
result: pass
note: "Criou pasta 'portugal' + subpasta 'portugal marav...' indentada sob ela; chevron de expandir/colapsar presente."

### 4. Mover LP para uma pasta
expected: No card da LP, kebab → "Move to folder…" abre dialog com lista de pastas (Root = All LPs); ao mover, o badge da pasta aparece no card e a LP aparece dentro da pasta na árvore.
result: pass
reported: "RE-TESTE round-2.1: navegação de pastas ficou ótima — filtro exato (LP da subpasta não aparece no pai), card de subpasta em formato de pasta + breadcrumb aprovados pelo usuário."
note: "Resolvido em camadas: 05-04 (kebab/move + clipping) → exact-folder filter (608dc78) + subfolder cards + breadcrumb → folder-shaped card. Move to folder, badge e árvore OK."

### 5. Aplicar tags a uma LP
expected: No card, kebab → "Edit tags…" abre input de chips; adicionar tags (Enter/vírgula) mostra chips; remover é instantâneo; limite de 10 tags desabilita o input com aviso "Maximum 10 tags reached.".
result: pass
reported: "RE-TESTE round-2.1: criar/remover tags OK; dialog re-hidrata as tags atribuídas (re-key on open); seção 'Existing tags' lista o vocabulário do workspace para reaproveitar."
note: "Resolvido: re-key do TagInput no open (00c4750) + sugestões 'Existing tags' threadando workspaceTags → TagInput (608dc78). O chip 'portugal' que parecia tag era o badge da PASTA (mesmo estilo visual)."

### 6. Buscar por nome
expected: Digitar na barra de busca filtra a grade instantaneamente (case-insensitive, sem recarregar); busca sem resultado mostra "No landing pages match your search.".
result: pass

### 7. Filtrar por pill de tag
expected: A CatalogFilterBar mostra pill "All" + uma pill por tag do workspace; selecionar uma tag filtra a grade para LPs com aquela tag (single-select, aria-pressed alterna).
result: pass
note: "RE-TESTE pós-05-04: com tags criáveis, a CatalogFilterBar mostra pill 'All' + pill por tag do workspace ('sabedor') e o filtro opera (imagem 6). Destravado pelo fix do kebab."

### 8. Menu de contexto da pasta (DropdownMenu acessível)
expected: O kebab da pasta abre via DropdownMenu (shadcn/Base UI); navegável por teclado (setas, Enter, Esc); item "Delete folder" em vermelho/destructive.
result: pass

### 9. Grécia — autorar o template
expected: Colar tests/fixtures/grecia-authored-template.html em /w/{slug}/templates/new; o painel de schema mostra os campos das 8 seções (hero, destaques, info cards, inclusos, roteiro, diferenciais, depoimentos, CTA/footer) com badges de tipo; salva sem erro.
result: pass
reported: "RE-TESTE pós-05-05: abri o template, cliquei em Save e NÃO duplicou."
note: "RESOLVIDO por 05-05: após criar, redireciona para /edit → saves seguintes atualizam (sem duplicata). Save Template único (botão do footer). Parse Grécia OK (48 fields · 6 repeaters). O design do toast permanece como gap separado (cosmetic, round 2)."

### 10. Grécia — gerar LP pelo formulário
expected: Selecionar o template Grécia em /w/{slug}/lps/new; o formulário dinâmico renderiza todos os tipos de campo (text, richtext, image upload, color, button, repeater); adicionar/remover itens de repeater funciona; upload de imagem vai pro MinIO; Generate LP redireciona ao preview.
result: pass
reported: "após fix inline do _lpName, Generate LP funcionou e redirecionou ao preview"
note: "BLOQUEADOR corrigido inline durante o UAT (LpForm.tsx — nome lido de getValues + guard). Geração agora funciona: generateLpAction rodou com name='gracia novo' e redirecionou ao preview. Upload de imagem OK. Formulário renderiza todos os tipos de campo + repeaters add/remove OK. Gaps de UI (selector cuid, keys, auth-404, save dup) permanecem para gap-closure; o próprio fix do _lpName precisa de commit/review formal."

### 11. Grécia — preview fiel (sem tokens literais, botões com URL real)
expected: O preview renderiza o layout fielmente; NÃO há tokens literais `{{ }}` no HTML; campos button (CTA, WhatsApp) renderizam a URL real no href — NÃO "[object Object]"; globais de brand (cores, logo, contatos) resolvidos.
result: pass
reported: "após fix inline do resolveImageUrl, as imagens apareceram; layout fiel"
note: "Layout/texto/richtext/repeaters/imagens renderizam com fidelidade e sem tokens {{ }} literais — aceitação Grécia ponta-a-ponta OK. Imagens corrigidas via fix inline (renderer.ts resolveImageUrl). Brand globals vazios porque Brand Settings não foi configurado (esperado, não bug). Gap das imagens permanece para commit/review formal."

### 12. Grécia — editar LP
expected: Abrir edição da LP recarrega os valores preenchidos no formulário; alterar e salvar regenera o preview com os novos valores, mantendo a fidelidade de layout.
result: pass
reported: "sim recarregou tudo"
note: "Campos recarregam pré-preenchidos. OBSERVAÇÃO ORIGINAL (dropzone vazio ao editar) RESOLVIDA por 05-06: re-teste 2026-06-17 (imagem 10) mostra o campo hero_imagem com thumbnail + 'Uploaded' ao editar a LP 'Copy of gracia novo 2222'. Cosmético menor: exibe 'Uploaded · 0 B' (size 0 porque hidratado do valor salvo, sem re-upload). Banner 'Template updated to v3 / Apply new version' = reconciliação de schema esperada."

### 13. Grécia — duplicar LP
expected: Duplicar a LP cria uma nova instância independente (mesmo conteúdo, novo registro) que aparece no catálogo; editar a cópia não afeta a original.
result: pass

### 14. Grécia — exportar ZIP
expected: Export ZIP baixa um arquivo; ao descompactar, index.html abre standalone no browser com layout fiel ao preview; imagens carregam de ./assets/ (paths relativos); <head> contém meta CSP com default-src 'none'.
result: pass
note: "ZIP (420KB) com index.html + assets/ (4 imagens). Verificado por inspeção: src relativos ./assets/, nenhuma URL MinIO, meta CSP default-src 'none' presente, sem tokens {{}} literais, sem [object Object]. Fix de imagens propagou pro export. (src='' apenas na logo do brand não configurado — esperado.)"

### 15. [Técnico] Isolamento por workspace nas ações de catálogo
expected: As Server Actions de catálogo (folders/tags/move) operam apenas sobre dados do workspace da sessão; tentar mover/taggear uma LP de outro workspace é rejeitado (validação em db.lp.findById com filtro workspaceId).
result: pass
category: code_review
note: "Verificado por code review (não testável manualmente sem 2 workspaces). lib/catalog/actions.ts: workspaceId sempre de requireWorkspaceRole/requireWorkspace (sessão, nunca cliente); todas as mutações dentro de withTenantDb({workspaceId}) com contexto RLS; moveLpAction valida lpId E folderId via findById (filtra workspaceId → null cross-workspace); setTagsForLpAction confirma LP no workspace; deleteFolderAction usa set_config('app.current_workspace_id') + WHERE workspace_id explícito no SQL raw. Isolamento em duas camadas (RLS + filtro findById)."

### 16. [Técnico] Delete de pasta não-destrutivo
expected: Excluir uma pasta com LPs e subpastas re-parenteia tudo para a raiz (não apaga LPs); a confirmação avisa que LPs e subpastas vão para a raiz.
result: pass
reported: "RE-TESTE pós-05-04: excluiu a pasta sem erro (toast 'Folder deleted.') e as LPs que estavam dentro voltaram para All LPs (imagem 8). Dois feedbacks novos: (a) não gostei do design do toast; (b) consegui excluir pasta com LPs dentro — deveria ter uma confirmação extra antes."
note: "Requisito original (delete não-destrutivo + re-parenteamento) ATENDIDO — bug do SQL snake_case resolvido por 05-04. Feedbacks (toast design global; confirmação extra p/ pasta não-vazia) registrados como novos gaps abaixo."

### 17. [Técnico] Sanitização de URL em campos button
expected: URLs com esquema perigoso (javascript:, data:) em campos button são bloqueadas por sanitizeUrl no render; corpus de segurança (118 testes unitários) passa.
result: pass
note: "Corpus de segurança do engine verde (118/118 confirmado durante o fix inline do resolveImageUrl, teste 11)."

### 18. [Cobertura] "encontro e reutilizo LPs rapidamente"
expected: O outcome da user story é observável: organizar (pastas) + classificar (tags) + buscar (nome) + filtrar (tag) + reutilizar (duplicar) — todos funcionam ponta-a-ponta no catálogo.
result: pass
reported: "RE-TESTE round-2.1: cobertura completa — organizar (pastas + navegação por subpasta + breadcrumb), classificar (tags + Existing tags), buscar (nome), filtrar (tag) e reutilizar (duplicar) funcionam ponta-a-ponta."
note: "User story plenamente coberta após gap-closure 05-04/05/06 + round-2.1. 5/5 capacidades observáveis."

## Summary

total: 18
passed: 18
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "O card da LP no catálogo deve oferecer 'Move to folder…' e 'Edit tags…' no kebab, com o menu abrindo completo (sem corte)"
  status: failed
  reason: "User reported: kebab da LP só mostra Duplicate / Export ZIP / Delete (Testes 4 e 5) e o menu sobe até o topo do card e corta"
  severity: major
  test: 4
  root_cause: "DIAGNOSTICADO (gsd-debugger): defeito único, não dois. O LpCatalogCard JÁ renderiza 'Move to folder…' (LpCatalogCard.tsx:336) e 'Edit tags…' (LpCatalogCard.tsx:347) — componente correto (CatalogGrid usa LpCatalogCard; LpCard é dead code). O menu é um <div> absolute que abre PARA CIMA (className 'absolute right-0 bottom-full mb-1 z-20', LpCatalogCard.tsx:326) e não é portalizado; ele vive dentro de <Card>, cujo root tem 'overflow-hidden' (ui/card.tsx:15). Resultado: o topo do menu — exatamente os itens 'Move to folder…' e 'Edit tags…' (linhas 328–348) — é recortado na borda superior do card, sobrando só os 3 de baixo (Duplicate/Export/Delete, linhas 351–384). O screenshot bater com o LpCard antigo é coincidência do recorte."
  artifacts:
    - path: "apps/web/src/components/catalog/LpCatalogCard.tsx"
      issue: "kebab é <div> absolute bottom-full não-portalizado (linha 326); itens Move/Edit tags nas linhas 336/347 ficam cortados"
    - path: "apps/web/src/components/ui/card.tsx"
      issue: "Card root tem overflow-hidden (linha 15) que recorta o menu"
  missing:
    - "Portalizar o kebab: migrar para o shadcn/Base UI DropdownMenu (já instalado) cujo content portaliza p/ document.body, escapando o overflow-hidden — alinhado ao design da Phase 5"
    - "Alternativa rápida: forçar overflow-visible no <Card> do LpCatalogCard (não confiar só em flip p/ top-full, que ainda recortaria embaixo)"
  note: "Fix único resolve Testes 4 (mover LP), 5 (tags + clipping), destrava 7 (filtro por tag) e 18 (cobertura)."

- truth: "Conteúdo das páginas do shell de workspace deve ter padding em relação às bordas do <main>"
  status: failed
  reason: "User reported: elementos do topo da aba ficam colados nas laterais no dashboard /w/[slug]"
  severity: cosmetic
  test: 1
  root_cause: "layout.tsx:91 <main className='flex-1 overflow-auto'> não tem padding; a página dashboard /w/[slug]/page.tsx envolve o conteúdo num <div> sem padding. Conteúdo encosta no topo/lateral. Páginas que definem o próprio padding (ex.: /lps com px-6) não são afetadas."
  artifacts:
    - path: "apps/web/src/app/w/[slug]/layout.tsx"
      issue: "<main> sem padding (linha 91)"
    - path: "apps/web/src/app/w/[slug]/page.tsx"
      issue: "wrapper raiz sem padding (linha 23)"
  missing:
    - "Adicionar padding ao <main> no layout (ex.: p-6) OU padding no wrapper das páginas do shell"
  note: "Página dashboard é placeholder ('Coming in Phase 3/4') — fora do escopo da Fase 5, mas o padding do <main> no layout afeta todo o shell. Cosmético, não bloqueia."

- truth: "Quando o workspace está vazio não deve haver dois CTAs 'Generate LP' competindo na mesma tela"
  status: failed
  reason: "User reported: tem dois botões de gerar lp na tela"
  severity: minor
  test: 2
  root_cause: "page.tsx:65 renderiza um CTA 'Generate LP' no header (sempre visível) e CatalogGrid.tsx:199 renderiza outro CTA 'Generate LP' no empty state 'No landing pages yet'. Com workspace vazio os dois aparecem simultaneamente. Padrão header-action + empty-state-CTA, redundante quando vazio."
  artifacts:
    - path: "apps/web/src/app/w/[slug]/lps/page.tsx"
      issue: "CTA Generate LP no header (linha ~63-65)"
    - path: "apps/web/src/components/catalog/CatalogGrid.tsx"
      issue: "CTA Generate LP no empty state (linha ~197-199)"
  missing:
    - "Decidir o padrão: ocultar o CTA do empty state quando o header já tem o botão, OU ocultar o do header no estado vazio. Manter um único CTA primário por estado."

- truth: "A barra de busca deve ter respiro vertical em relação ao separador do header"
  status: failed
  reason: "User reported: a barra de search está colada na linha de cima"
  severity: cosmetic
  test: 2
  root_cause: "Painel direito da CatalogGrid é 'flex-1 px-6 py-0' (sem padding vertical) e o wrapper da SearchBar é 'pt-0 pb-2' (CatalogGrid.tsx:165,167). O pt-0 cola a barra logo abaixo do border-b do header."
  artifacts:
    - path: "apps/web/src/components/catalog/CatalogGrid.tsx"
      issue: "painel direito py-0 (linha 165) + search wrapper pt-0 (linha 167)"
  missing:
    - "Adicionar respiro acima da SearchBar (ex.: pt-4 no wrapper ou py no painel direito)"

- truth: "Salvar um template novo não deve criar duplicatas em cliques repetidos"
  status: failed
  reason: "User reported: cliquei duas vezes pra salvar e gerou 2 templates"
  severity: major
  test: 9
  root_cause: "TemplateEditor.tsx handleSave roda em mode='create' e chama createTemplateAction (insere novo cuid a cada chamada). disabled={isPending} só evita submit concorrente durante a requisição; após o primeiro save bem-sucedido o editor permanece em mode='create' (não redireciona para /templates/{id}/edit nem troca para mode='edit'), então um segundo clique cria um SEGUNDO template em vez de atualizar o primeiro."
  artifacts:
    - path: "apps/web/src/components/templates/TemplateEditor.tsx"
      issue: "handleSave (linha 115-147): após create bem-sucedido não redireciona nem muda mode; createTemplateAction sempre insere"
  missing:
    - "Após createTemplateAction.ok, redirecionar para /w/{slug}/templates/{result.data.id}/edit (padrão) OU mudar mode para 'edit' e guardar o id para que saves seguintes chamem updateTemplateAction"
    - "Opcional: idempotência/dedup no servidor (ex.: unique [workspaceId,name] ou checagem de submit em andamento)"

- truth: "Deve haver um único CTA primário 'Save Template' por estado da tela"
  status: failed
  reason: "User reported: tem dois botões de save template"
  severity: minor
  test: 9
  root_cause: "TemplateEditor.tsx renderiza Save Template no header (linha 166) e no footer (linha 334). Mesmo padrão redundante do 'Generate LP' (gap do teste 2)."
  artifacts:
    - path: "apps/web/src/components/templates/TemplateEditor.tsx"
      issue: "dois botões Save Template (linhas 166 e 334)"
  missing:
    - "Definir padrão consistente de CTA primário único (alinhado com a decisão do Generate LP duplicado)"

- truth: "O toast de confirmação de save deve agradar / seguir o design pretendido"
  status: failed
  reason: "User reported: esse toast de template save não gostei"
  severity: cosmetic
  test: 9
  root_cause: "Feedback subjetivo sobre o toast 'Template saved — schema v{n}'. Precisa de clarificação do usuário sobre o que especificamente incomoda (estilo, posição, texto, duração)."
  artifacts:
    - path: "apps/web/src/components/templates/TemplateEditor.tsx"
      issue: "toast.success em handleSave (linha 142)"
  missing:
    - "Clarificar com o usuário o que ajustar no toast antes de planejar fix"

- truth: "Clicar em Generate LP deve gerar a LP e redirecionar ao preview"
  status: failed
  reason: "User reported: preenchi tudo e cliquei em generate e nada acontece"
  severity: blocker
  test: 10
  root_cause: "LpForm.tsx onSubmit (linha 251-253) faz `const name = (_lpName as string).trim()`, mas `data._lpName` chega undefined → TypeError. Causa: o campo _lpName é registrado (register('_lpName'), linha 349) e tem default (linha 169), porém o schema Zod derivado por deriveZodSchema (schema-derive.ts:142 `z.object(shape)`) inclui APENAS os campos do template — não inclui _lpName. z.object() do Zod descarta chaves desconhecidas por padrão, então o zodResolver remove _lpName do payload parseado passado ao onSubmit. Erro vira unhandledRejection e a geração falha silenciosamente. Nunca foi pego porque o UAT da Fase 4 era todo human_needed (não executado)."
  artifacts:
    - path: "apps/web/src/components/lps/LpForm.tsx"
      issue: "onSubmit assume data._lpName definido (linha 252-253); zodResolver o descarta"
    - path: "apps/web/src/lib/lps/schema-derive.ts"
      issue: "z.object(shape) sem _lpName e sem .passthrough() → strip de chaves desconhecidas (linha 142)"
  missing:
    - "Ler o nome de getValues('_lpName') ou do prop lpName em vez do data parseado pelo resolver, OU adicionar _lpName: z.string().min(1) ao schema derivado, OU usar .passthrough()"
    - "Adicionar guard: se name vazio, toast de erro em vez de crash"
  fix_status: "APLICADO INLINE no working tree (LpForm.tsx onSubmit: lê getValues('_lpName') + guard). Pendente: commit + review formal."

- truth: "Campos image devem renderizar a URL pública da imagem, não [object Object]"
  status: failed
  reason: "Preview: todas as imagens quebradas; backend log GET .../[object Object] 404"
  severity: major
  test: 11
  root_cause: "src/engine/renderer.ts trata campos type='image' com sanitizeUrl(String(fieldValue)) nas linhas 70 (repeater), 136 (top-level) e 157 (brand). Mas o valor de um campo image é objeto {publicUrl, s3Key} (do upload), então String({...}) = '[object Object]' → src inválido. O fix do 05-03 criou resolveButtonUrl para button {label,url} mas NÃO criou o equivalente para image {publicUrl,s3Key}."
  artifacts:
    - path: "src/engine/renderer.ts"
      issue: "image type usa String(value) em vez de extrair .publicUrl (linhas 70, 136, 157)"
  missing:
    - "Adicionar helper resolveImageUrl(value) que extrai .publicUrl de {publicUrl,s3Key} (e passa strings adiante p/ compat), aplicado nos 3 pontos (repeater, top-level, brand) antes do sanitizeUrl"
    - "Re-rodar corpus de testes do engine após o fix"
  fix_status: "APLICADO INLINE no working tree (renderer.ts: helper resolveImageUrl + aplicado em repeater/top-level/brand). 118/118 testes passam. Pendente: commit + review formal."

- truth: "Ao editar uma LP, campos image devem re-exibir a imagem já enviada"
  status: failed
  reason: "Edit form mostra hero_imagem como dropzone vazio mesmo a LP tendo imagem de hero"
  severity: minor
  test: 12
  root_cause: "ImageUploadField não hidrata o preview a partir do valor inicial ({publicUrl,s3Key}) em modo edit — mostra o dropzone vazio. Valor pode continuar no estado do form (a confirmar), mas a UX sugere que não há imagem. Risco de perda da imagem se salvar sem reenviar."
  artifacts:
    - path: "apps/web/src/components/lps/ImageUploadField.tsx"
      issue: "não renderiza preview do valor inicial em edit mode"
  missing:
    - "Hidratar o ImageUploadField com a imagem existente (publicUrl) quando há valor inicial"
    - "Confirmar que salvar sem reenviar preserva o valor da imagem (senão é data-loss = major)"

- truth: "Campos de repeaters com nomes repetidos não devem gerar keys React duplicadas"
  status: failed
  reason: "Console: Encountered two children with the same key, `titulo` / `texto`"
  severity: major
  test: 10
  root_cause: "RepeaterBlock.tsx renderiza cada campo com key={field.name} (linhas 175/200/230/255). O template Grécia reusa nomes (titulo, texto) em vários repeaters/seções, e onde a lista de campos compartilha esses nomes as keys colidem. Keys não-únicas podem duplicar/omitir campos e corromper o estado do form."
  artifacts:
    - path: "apps/web/src/components/lps/RepeaterBlock.tsx"
      issue: "key={field.name} (não composto) nas linhas 175,200,230,255"
  missing:
    - "Usar key composta única (ex.: `${repeaterName}.${index}.${field.name}` ou field id) ao renderizar campos"

- truth: "O seletor de template deve mostrar o nome do template, não o cuid, sem seletor sobreposto"
  status: failed
  reason: "User reported: selecionei o template e no campo ficou esse nome estranho (cuid); popup de seleção em cima do seletor estranho"
  severity: minor
  test: 10
  root_cause: "TemplatePickerForm.tsx usa shadcn Select com SelectItem value={template.id} e label '{name} (schema v{n})'. O trigger estilizado mostra o nome, mas há um <select> nativo subjacente exibindo o value (cuid) — integração do componente Select renderiza dois controles sobrepostos. Funcionalmente o id correto é selozenado (geração usou o templateId certo)."
  artifacts:
    - path: "apps/web/src/app/w/[slug]/lps/new/TemplatePickerForm.tsx"
      issue: "Select estilizado + nativo sobrepostos; nativo mostra cuid (linhas 80-93)"
  missing:
    - "Corrigir a integração do Select (garantir um único controle visível mostrando o nome)"

- truth: "Excluir uma pasta deve re-parentear LPs/subpastas para a raiz e remover a pasta (delete não-destrutivo)"
  status: failed
  reason: "User reported: diálogo correto, mas ao clicar 'Delete folder' aparece toast 'Failed to delete folder. Try again.' — exclusão falha"
  severity: major
  test: 16
  root_cause: "DIAGNOSTICADO (gsd-debugger): os dois UPDATE raw em deleteFolderAction usam colunas snake_case (folder_id, parent_id, workspace_id) que NÃO existem no Postgres — as colunas físicas são camelCase ('folderId', 'parentId', 'workspaceId'), pois o schema Prisma só aplica @@map em tabelas, sem @map de coluna. Postgres lança 'column \"folder_id\" does not exist', engolido pelo catch genérico → toast. O set_config/RLS (linha 189) e o tx.folder.delete (field names Prisma) estão corretos; só os 2 raw UPDATEs estão errados."
  artifacts:
    - path: "apps/web/src/lib/catalog/actions.ts"
      issue: "linhas 200-205 (re-parent LPs: UPDATE landing_page SET folder_id=NULL WHERE workspace_id=... AND folder_id=...) e 208-213 (re-parent subpastas: UPDATE folder SET parent_id=NULL WHERE workspace_id=... AND parent_id=...) — 3 colunas inexistentes em cada"
  missing:
    - "Trocar os 2 raw UPDATEs por Prisma updateMany (field names): tx.landingPage.updateMany({where:{workspaceId,folderId},data:{folderId:null}}) e tx.folder.updateMany({where:{workspaceId,parentId:folderId},data:{parentId:null}}) — evita o trap de naming. Alternativa: aspas camelCase no SQL raw."
    - "Verificar que existe migration commitada das tabelas folder/landing_page do catálogo (migrations param em 0004; UAT usou db push) — gerar a migration Phase 5 se faltar, senão o mesmo statement falha com 'relation does not exist' em ambientes limpos."
  note: "Copy/aviso do AlertDialog está correto — só a operação de delete falha, por nomes de coluna errados no SQL raw."

- truth: "O cliente better-auth não deve disparar 404 contínuo em /auth/organizations"
  status: failed
  reason: "Backend log: OPTIONS /auth/organizations 404 repetido continuamente"
  severity: minor
  test: 10
  root_cause: "Cliente better-auth/organization batendo em /auth/organizations (404) — provável baseURL/endpoint incorreto (deveria ser /api/auth/...). Spam de log e possível degradação ao resolver a organização ativa. Pertence à Fase 2 (auth)."
  artifacts:
    - path: "apps/web/src/lib/auth"
      issue: "endpoint/baseURL do cliente de organização aparentemente incorreto"
  missing:
    - "Investigar config do cliente better-auth (organization plugin) e corrigir o path do endpoint"

# --- NOVOS GAPS (re-teste pós gap-closure 05-04/05/06, 2026-06-17) ---

- truth: "Ao abrir uma pasta, a grade deve mostrar só as LPs DIRETAS dela + acesso às subpastas; LPs de subpastas só aparecem ao entrar na subpasta"
  status: failed
  reason: "User reported: movi uma LP só para a subpasta 'portugal maravilhoso', mas ao abrir a pasta pai 'portugal' a LP também aparece (imagens 4 e 5)"
  severity: major
  test: 4
  round: 2
  root_cause: "A confirmar. Hipótese: o filtro de pasta na CatalogGrid inclui LPs de pastas descendentes (recursivo) em vez de filhos diretos; e a grade não renderiza cards/atalhos de subpasta para navegação hierárquica."
  artifacts: []
  missing:
    - "Filtrar a grade por folderId EXATO da pasta selecionada (filhos diretos), não por descendência"
    - "Renderizar as subpastas da pasta atual como itens navegáveis na grade (ou confiar só na FolderTree) — definir o padrão de navegação"

- truth: "O dialog 'Edit tags' deve pré-carregar as tags já atribuídas à LP"
  status: failed
  reason: "User reported: consegui criar tag, mas ao abrir 'Edit tags' de outro card a tag já atribuída não aparece — input vem vazio (imagem 7)"
  severity: major
  test: 5
  round: 2
  root_cause: "A confirmar. Hipótese: o componente de Edit tags (TagInput) não inicializa o estado com as tags atuais da LP (listTagsForLpAction / lpTags já carregadas na CatalogGrid) — começa vazio, com risco de sobrescrever/limpar tags ao salvar."
  artifacts: []
  missing:
    - "Hidratar o TagInput/dialog com as tags atuais da LP ao abrir (passar lpTags do card ou buscar via listTagsForLpAction)"
    - "Confirmar que salvar preserva tags não alteradas (não fazer set destrutivo a partir de estado vazio)"

- truth: "Os toasts devem seguir um design agradável e consistente"
  status: failed
  reason: "User reported (recorrente): não gostei do design do toast — citado no 'Template saved' (Teste 9) e no 'Folder deleted.' (Teste 16)"
  severity: cosmetic
  test: 9
  round: 2
  root_cause: "Feedback de design global sobre os toasts (sonner/shadcn)."
  decision: "User (2026-06-17): MANTER a posição atual (canto inferior), deixar o toast mais SIMPLES."
  artifacts: []
  missing:
    - "Simplificar o visual do toast globalmente (config sonner/Toaster) mantendo a posição atual — estilo mais limpo/minimalista"

- truth: "Excluir uma pasta NÃO-VAZIA (com LPs/subpastas) deve exigir confirmação extra"
  status: failed
  reason: "User reported: consegui excluir uma pasta que tinha LPs dentro sem salvaguarda adicional; deveria ter uma confirmação extra antes"
  severity: minor
  test: 16
  round: 2
  root_cause: "Hoje há um único AlertDialog de confirmação; para pasta não-vazia o usuário quer um aviso/confirmação reforçado (ex.: mostrar quantas LPs/subpastas serão movidas e exigir confirmação explícita)."
  artifacts: []
  missing:
    - "No fluxo de delete, quando a pasta tem LPs/subpastas, reforçar a confirmação (contagem do que será re-parenteado + ação explícita)"

# --- RESOLUÇÃO ROUND 2 / 2.1 (2026-06-17) — todos verificados pelo usuário ---

- truth: "Pasta pai mostra só LPs diretas + card de subpasta + breadcrumb"
  status: resolved
  fix: "exact-folder filter (f86c5b4) + subfolder cards estilo pasta + breadcrumb (608dc78, 1943e94)"
  test: 4

- truth: "Edit tags hidrata tags atribuídas + sugere vocabulário do workspace"
  status: resolved
  fix: "re-key TagInput on open (00c4750) + seção 'Existing tags' threadando workspaceTags (608dc78)"
  test: 5

- truth: "Toast simples, canto inferior esquerdo, branco/verde/vermelho, compacto"
  status: resolved
  fix: "sonner: position bottom-left + richColors + width 16rem + menos arredondado (1943e94, narrower commits)"
  test: 9/16

- truth: "Confirmação extra (checkbox) antes de excluir pasta"
  status: resolved
  fix: "checkbox obrigatório gateando o botão Delete folder (20a1d74)"
  test: 16

- truth: "Preview não deve carregar o shell do app dentro do iframe ao clicar em links da LP"
  status: resolved
  reason: "User reported: cliquei no logo/Reservar no preview e o app inteiro (sidebar) carregou aninhado dentro do preview"
  severity: major
  found: round-2.1
  root_cause: "iframe srcDoc: hrefs vazios/relativos (ex.: brand.whatsapp não configurado → href='') resolvem contra a URL da página pai (rota de preview), navegando o iframe para o app."
  fix: "Injetar <base target=\"_blank\"> no srcDoc — cliques em links abrem em nova aba (bloqueados pelo sandbox), sem sequestrar o iframe. Imagens usam URLs absolutas, não afetadas."
