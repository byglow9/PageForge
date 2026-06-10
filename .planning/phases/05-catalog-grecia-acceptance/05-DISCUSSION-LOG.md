# Phase 5: Catalog & Grécia Acceptance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 5-Catalog & Grécia Acceptance
**Areas discussed:** Modelo de pastas, Tags vs categorias, Busca & escala, Aceite da Grécia

---

## Modelo de pastas

### Pertencimento — quantas pastas por LP?
| Option | Description | Selected |
|--------|-------------|----------|
| Exatamente uma | LP mora em uma pasta; folderId nulável; "mover" troca folderId | ✓ |
| Várias (junção) | LP em múltiplas pastas; tabela de junção LP↔Folder | |

### Aninhamento
| Option | Description | Selected |
|--------|-------------|----------|
| Ilimitada | Folder self-ref parentId nulável, sem teto; seguro contra ciclos no move | ✓ |
| Teto raso (2-3) | Limita profundidade; valida profundidade no move | |
| Plana | Sem aninhamento — não atende CAT-02 | |

### Deletar pasta com subpastas
| Option | Description | Selected |
|--------|-------------|----------|
| Sobem para a raiz | LPs e subpastas re-parentadas à raiz (não destrutivo) | ✓ |
| Sobem para a pasta-mãe | Conteúdo vai para o pai imediato | |
| Cascata | Apaga subpastas junto (destrutivo) | |

**User's choice:** Uma pasta por LP + aninhamento ilimitado + delete não-destrutivo (conteúdo à raiz).
**Notes:** Metáfora de sistema de arquivos. LP nasce na raiz por padrão (D-04, discrição). UI-SPEC delete-copy precisa mencionar subpastas além de LPs.

---

## Tags vs categorias

### Modelo de tag
| Option | Description | Selected |
|--------|-------------|----------|
| Tags livres compartilhadas | Texto livre; vocabulário do workspace deduplicado; casa com FilterBar | ✓ |
| Lista de categorias gerenciada | Conjunto fixo via dropdown + tela de gestão | |
| Ambos (categoria + tags) | Categoria gerenciada + tags livres | |

### Persistência
| Option | Description | Selected |
|--------|-------------|----------|
| Tabela Tag + junção | Tag(workspaceId,name unique) + LpTag; lista/rename/cleanup eficientes | ✓ |
| Array de strings na LP | tags String[] na LandingPage; varre LPs para derivar pills | |

### Regras de tag
| Option | Description | Selected |
|--------|-------------|----------|
| Normalizar + limitar | Trim, dedup case-insensitive, máx 32 chars, ~10/LP | ✓ |
| Texto cru | Sem normalização nem teto | |

**User's choice:** Tags livres compartilhadas, persistidas via Tag + LpTag, normalizadas e limitadas.
**Notes:** Vocabulário vivo do workspace; alinhado ao CatalogFilterBar do UI-SPEC.

---

## Busca & escala

### Mecanismo
| Option | Description | Selected |
|--------|-------------|----------|
| Client-side por pasta | Servidor carrega LPs do escopo; filtro nome+tags no cliente, instantâneo | ✓ |
| Server-side (DB) | ILIKE + join de tags + paginação | |

### Escopo da busca
| Option | Description | Selected |
|--------|-------------|----------|
| Nome + tags | Substring no nome (case-insensitive) E tag | ✓ |
| Nome + tags + nome de pasta | Inclui nome de pasta no match | |
| Só nome | Apenas nome da LP | |

### Alcance
| Option | Description | Selected |
|--------|-------------|----------|
| Dentro da pasta + descendentes | Filtra na pasta selecionada e subpastas; raiz = tudo | ✓ |
| Sempre o workspace inteiro | Ignora pasta atual; varre tudo | |

**User's choice:** Client-side, escopo nome+tags, dentro da pasta selecionada + descendentes.
**Notes:** Pills da FilterBar são o vocabulário global do workspace, mas filtram dentro do escopo da pasta atual — pode dar zero resultados (empty state cobre).

---

## Aceite da Grécia

### Barra de aceite
| Option | Description | Selected |
|--------|-------------|----------|
| Estruturalmente completo | Todas as seções autoráveis + pipeline inteiro; layout-faithful, não pixel-perfect | ✓ |
| Fiel visualmente ao original | HTML exportado pixel-a-pixel com o site original | |

### Entregável
| Option | Description | Selected |
|--------|-------------|----------|
| Sim — autorar + corrigir lacunas | Autorar a template real via UI da Fase 3 e corrigir gaps revelados | ✓ |
| Só verificar com fixture existente | Usar grecia-template.html só para verificação | |

### Verificação
| Option | Description | Selected |
|--------|-------------|----------|
| UAT manual + alguns E2E | Checklist humano + Playwright nos pontos críticos (gerar, export ZIP) | ✓ |
| E2E automatizado completo | Playwright cobrindo todo o fluxo | |
| Só UAT manual | Apenas checklist humano | |

**User's choice:** Estruturalmente completo + layout-faithful; autorar a template real e corrigir lacunas; UAT manual + alguns E2E.
**Notes:** A Grécia é o teste de fogo do v1 — fricção exposta vira bug a corrigir nesta fase.

---

## Claude's Discretion

- Shape exato dos models Prisma `Folder`/`Tag`/`LpTag` (tenant-owned, `@@map`, atrás de `withTenantDb`).
- Diálogo vs submenu inline para mover pasta/LP.
- Estratégia de fetch da árvore (adjacency list vs query recursiva) dado aninhamento ilimitado.
- Implementação da prevenção de ciclos no move.
- Ordenação padrão do catálogo (não discutida).
- Origem do markup/values reais da Grécia (fixtures são referência; D-12 exige caminho de autoria real).

## Deferred Ideas

- Permissões por pasta (v2 PERM-01).
- Busca server-side/paginada (se a escala crescer).
- Lista de categorias gerenciada / híbrido categoria+tags.
- Reprodução pixel-perfect da Grécia.
- Folder picker na geração da LP.
- E2E automatizado completo do fluxo de autoria→export.
