# PageForge — Retrospective

## Milestone: v2.0 — Suporte a LPs do Lovable

**Shipped:** 2026-06-24
**Phases:** 3 (Fases 6–8) | **Plans:** 10

### What Was Built
Segundo tipo de template ao lado do LIQUID: projetos React/Vite do Lovable ingeridos como **VITE_SPA** (upload do `dist/` pré-buildado). Ingestão validada/escaneada e isolada por workspace (Fase 6); serving em origem cross-origin + preview sandboxed (Fase 7); geração de LP por rota, brand theming via CSS var `--primary`, e export ZIP — coexistindo com o LIQUID (Fase 8).

### What Worked
- **Decisão load-bearing (D1-A): aceitar só o `dist/` pré-buildado** removeu toda a superfície de RCE de `npm install`/`vite build` do milestone — escopo de segurança ficou tratável (servir, não buildar).
- **Simetria de boundary de tipo** (`renderLp()` rejeita VITE_SPA / `assertViteSpaKind()` rejeita LIQUID) deu uma separação limpa e testável entre os dois caminhos.
- Reuso do `injectBrandStyle` no serve e no export garantiu **preview == export** sem divergência.

### What Was Inefficient
- **Drift de documentação:** PROJECT.md (PRJ-04..12) e a traceability ficaram desatualizados enquanto as Fases 7–8 eram concluídas; só foram reconciliados no fechamento do milestone. As Fases 7–8 também não geraram `VERIFICATION.md` formal (verificadas via UAT+SECURITY).
- **Falso positivo de UAT no Bloco B:** o "preview branco" (origem opaca CORS-bloqueando o módulo ESM do Vite) passou como PASS interpretando um `SecurityError` como prova de isolamento. Custou um ciclo de debug + reabertura de UAT.

### Patterns Established
- Templates de projeto opacos (VITE_SPA) recebem customização **apenas via injeção no `index.html`** (CSS vars) — o conteúdo compilado é imutável sem rebuild.
- Isolamento de SPA de terceiros: **subdomínio cross-origin + cookies host-only + CSP `frame-ancestors`**, e `sandbox="allow-scripts allow-same-origin"` (origem opaca quebra módulos ESM/localStorage).

### Key Lessons
- "Editabilidade grátis" via brand CSS var é real, mas a edição de **conteúdo** do SPA exige um mecanismo à parte (override em runtime) — motivou o milestone v2.1.
- Marcar requisito/checkbox no fim de cada fase (não só no fechamento) evita o drift que tivemos.
- UAT de isolamento precisa verificar o **resultado visível** (SPA monta?), não só ausência/presença de erros de console.

---
