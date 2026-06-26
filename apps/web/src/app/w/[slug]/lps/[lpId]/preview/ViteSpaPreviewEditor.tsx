"use client";

/**
 * ViteSpaPreviewEditor — dashboard parent half of the cross-origin text editor.
 *
 * Architecture:
 * - Renders the preview toolbar, active-edit banner, and preview iframe.
 * - Communicates with the iframe via postMessage (origin-validated).
 * - Edit mode: changes iframeSrc to include ?edit=1&lpId= → iframe reloads with
 *   the edit script injected → IFRAME_READY handshake → EDIT_MODE_ENTER sent.
 * - Save: sends REQUEST_SAVE → iframe responds with PENDING_EDITS (full PfOverride[])
 *   → updateLpAction persists overrides → router.refresh() re-mints serve token.
 * - Discard: sends REQUEST_DISCARD → iframe restores original text, sends EDIT_DISCARDED.
 *
 * Security:
 * - canEdit derived server-side via can(ctx.role,'lp','update') in page.tsx RSC (UI gate).
 * - updateLpAction independently gates via requireWorkspaceRole (authoritative gate).
 * - All incoming postMessages validated against event.origin === serveOrigin (T-10-03-02).
 * - sendToIframe always uses serveOrigin as targetOrigin, never '*'.
 *
 * Phase 11 extensibility (D-04): toolbar has a reserved slot after 'Salvar alterações'
 * for a per-type control (image upload, link URL input) keyed off selectedPath type.
 */

import { useRef, useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PfOverride } from "@/lib/lps/schema";
import { updateLpAction } from "@/lib/lps/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViteSpaPreviewEditorProps {
  /** Landing page ID (used in iframeSrc for edit mode and in save action). */
  lpId: string;
  /** Human-readable LP name shown in the toolbar. */
  lpName: string;
  /** Workspace slug for navigation and Server Action routing. */
  slug: string;
  /** Isolated serving origin (e.g. http://tplId.serve.localhost:3000). */
  serveOrigin: string;
  /** Entry path for the SPA (e.g. '/' or '/grecia'). */
  entryPath: string;
  /** Short-lived HMAC serve token minted by the RSC. */
  token: string;
  /** Whether the current user may edit (can(role,'lp','update')). */
  canEdit: boolean;
}

// ---------------------------------------------------------------------------
// ViteSpaPreviewEditor
// ---------------------------------------------------------------------------

export function ViteSpaPreviewEditor({
  lpId,
  lpName,
  slug,
  serveOrigin,
  entryPath,
  token,
  canEdit,
}: ViteSpaPreviewEditorProps) {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Whether edit mode is active (drives iframeSrc change → reload). */
  const [isEditMode, setIsEditMode] = useState(false);

  /**
   * True after IFRAME_READY postMessage received.
   * Resets to false on iframe load (onLoad) and on entering edit mode (reload).
   * Pitfall 5 prevention: do NOT permanently disable 'Editar' on !iframeReady;
   * only disable during the edit-mode reload transition (isEditMode && !iframeReady).
   */
  const [iframeReady, setIframeReady] = useState(false);

  /**
   * Local copy of in-flight edits for dirty-count badge.
   * Source of truth for saves is the iframe's pendingMap (sent via PENDING_EDITS).
   * ELEMENT_CHANGED updates this for accurate dirty count between edits.
   */
  const [pendingEdits, setPendingEdits] = useState<PfOverride[]>([]);

  /** Path of currently selected element — drives banner copy swap. */
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  /** Save error from updateLpAction — shown as destructive Alert above iframe. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Controls the discard confirmation Dialog (opens only when pendingEdits.length > 0). */
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // -------------------------------------------------------------------------
  // Refs, router, transition
  // -------------------------------------------------------------------------

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  /**
   * Changing iframeSrc triggers iframe reload.
   * Edit mode URL includes ?edit=1&lpId= so the serve route injects the edit script.
   */
  const iframeSrc = isEditMode
    ? `${serveOrigin}${entryPath}?t=${token}&edit=1&lpId=${lpId}`
    : `${serveOrigin}${entryPath}?t=${token}`;

  // -------------------------------------------------------------------------
  // Send to iframe helper (gated on iframeReady)
  // -------------------------------------------------------------------------

  const sendToIframe = useCallback(
    (msg: object) => {
      if (iframeRef.current?.contentWindow && iframeReady) {
        iframeRef.current.contentWindow.postMessage(msg, serveOrigin);
      }
    },
    [serveOrigin, iframeReady]
  );

  // -------------------------------------------------------------------------
  // Save with edits (called from postMessage listener via stable ref)
  // -------------------------------------------------------------------------

  const handleSaveWithEdits = useCallback(
    (overrides: PfOverride[]) => {
      startTransition(async () => {
        setSaveError(null);
        const result = await updateLpAction(slug, { id: lpId, overrides });
        if (!result.ok) {
          setSaveError(
            result.error ??
              "Não foi possível salvar as alterações. Tente novamente."
          );
          return;
        }
        // On success: exit edit mode → iframeSrc reverts to non-edit URL → iframe reloads.
        setIsEditMode(false);
        setPendingEdits([]);
        setSelectedPath(null);
        setIframeReady(false);
        router.refresh(); // re-renders RSC → mintServeToken called again (Pitfall 6)
      });
    },
    [slug, lpId, router, startTransition]
  );

  /**
   * Stable ref always pointing to the latest handleSaveWithEdits.
   * Lets the message listener call it without being included in the listener's
   * dependency array (which would cause unnecessary re-registrations).
   */
  const handleSaveWithEditsRef = useRef(handleSaveWithEdits);
  handleSaveWithEditsRef.current = handleSaveWithEdits;

  // -------------------------------------------------------------------------
  // postMessage listener — validates event.origin before processing (T-10-03-02)
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Origin allowlist: only accept messages from the serve subdomain.
      // serveOrigin is computed server-side in the RSC and passed as a prop —
      // it is never user-supplied. (T-10-03-02)
      if (event.origin !== serveOrigin) return;

      const msg = event.data as { type: string; [k: string]: unknown };
      if (!msg?.type) return;

      switch (msg.type) {
        case "IFRAME_READY":
          setIframeReady(true);
          break;

        case "ELEMENT_SELECTED":
          setSelectedPath(msg.path as string);
          break;

        case "ELEMENT_CHANGED":
          // Update dirty count in parent (source of truth for save data is iframe's
          // pendingMap, sent in full via PENDING_EDITS when REQUEST_SAVE is received).
          setPendingEdits((prev) => {
            const next = prev.filter((e) => e.path !== (msg.path as string));
            next.push({
              path: msg.path as string,
              originalHash: "", // placeholder; correct hash sent via PENDING_EDITS on save
              type: "text",
              value: msg.newText as string,
            });
            return next;
          });
          break;

        case "PENDING_EDITS":
          // Iframe responds to REQUEST_SAVE with the full override array (correct hashes).
          // Call via ref so the listener doesn't need to re-register when handleSaveWithEdits changes.
          handleSaveWithEditsRef.current(msg.overrides as PfOverride[]);
          break;

        case "EDIT_DISCARDED":
          // Iframe completed discard; restore to view mode.
          setIsEditMode(false);
          setPendingEdits([]);
          setSelectedPath(null);
          setSaveError(null);
          break;

        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [serveOrigin]); // re-register only if serveOrigin changes (it won't in practice)

  // -------------------------------------------------------------------------
  // Send EDIT_MODE_ENTER once iframe is ready in edit mode
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (iframeReady && isEditMode) {
      sendToIframe({ type: "EDIT_MODE_ENTER", lpId });
    }
  }, [iframeReady, isEditMode, lpId, sendToIframe]);

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  /** Enter edit mode: changes iframeSrc → iframe reloads → IFRAME_READY arrives → EDIT_MODE_ENTER sent. */
  const handleEnterEdit = () => {
    setIsEditMode(true);
    setIframeReady(false); // will be set true by next IFRAME_READY postMessage
    setSaveError(null);
  };

  /** Request the iframe to send its current pending overrides (triggers PENDING_EDITS). */
  const handleSave = () => {
    sendToIframe({ type: "REQUEST_SAVE" });
  };

  /** Exit edit mode: sends REQUEST_DISCARD (no edits) or opens confirmation dialog (has edits). */
  const handleDiscard = () => {
    if (pendingEdits.length === 0) {
      sendToIframe({ type: "REQUEST_DISCARD" });
      return;
    }
    setShowDiscardDialog(true);
  };

  /** Confirmed discard from dialog. */
  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    sendToIframe({ type: "REQUEST_DISCARD" });
    // EDIT_DISCARDED handler will clear state when iframe responds.
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen">
        {/* ---------------------------------------------------------------- */}
        {/* Toolbar — h-12, sticky, border-b, bg-background                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="h-12 px-4 border-b border-border bg-background flex items-center gap-4 sticky top-0 shrink-0 z-10">
          {/* Back link */}
          <Link
            href={`/w/${slug}/lps`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>

          {/* LP name */}
          <span className="text-xl font-semibold text-foreground flex-1 truncate">
            {lpName}
          </span>

          {/* Vite SPA badge (always visible) */}
          <Badge variant="outline" className="text-xs font-semibold">
            Vite SPA
          </Badge>

          {/* Edit controls — only rendered for canEdit users (SC1: viewer sees none) */}
          {canEdit && (
            <>
              {!isEditMode ? (
                /* ------- View mode: show "Editar" button ------- */
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="default"
                        className="font-semibold"
                        disabled={isEditMode && !iframeReady}
                        onClick={handleEnterEdit}
                      />
                    }
                  >
                    Editar
                  </TooltipTrigger>
                  {!iframeReady && (
                    <TooltipContent>
                      Carregando a preview… aguarde para editar.
                    </TooltipContent>
                  )}
                </Tooltip>
              ) : pendingEdits.length === 0 ? (
                /* ------- Edit mode — clean: show "Concluir" ------- */
                <Button
                  variant="ghost"
                  className="font-semibold"
                  disabled={isPending}
                  onClick={handleDiscard}
                >
                  Concluir
                </Button>
              ) : (
                /* ------- Edit mode — dirty: badge + Descartar + Salvar ------- */
                <>
                  {/* Dirty count indicator (edit-mode blue tint, UI-SPEC Color) */}
                  <Badge className="bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] text-sm font-semibold">
                    {pendingEdits.length === 1
                      ? "1 alteração não salva"
                      : `${pendingEdits.length} alterações não salvas`}
                  </Badge>
                  <Button
                    variant="outline"
                    className="font-semibold"
                    disabled={isPending}
                    onClick={handleDiscard}
                  >
                    Descartar
                  </Button>
                  <Button
                    variant="default"
                    className="font-semibold"
                    disabled={isPending}
                    onClick={handleSave}
                  >
                    {isPending ? "Salvando…" : "Salvar alterações"}
                  </Button>
                  {/* D-04: reserved slot for Phase 11 per-type control (image/link) */}
                  <div />
                </>
              )}
            </>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Save error — destructive Alert above iframe, below toolbar         */}
        {/* ---------------------------------------------------------------- */}
        {saveError && (
          <Alert variant="destructive" className="mx-4 mt-2">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Active-edit banner — visible only in edit mode                    */}
        {/* h-8 (32px), blue tint (UI-SPEC Color), swaps copy on selection   */}
        {/* ---------------------------------------------------------------- */}
        {isEditMode && (
          <div className="bg-[#eff6ff] border-b border-[#bfdbfe] text-[#1d4ed8] text-sm h-8 px-4 py-1 flex items-center">
            {selectedPath
              ? "Editando texto — Enter para confirmar, Esc para cancelar"
              : "Modo de edição ativo — clique em um texto para editar"}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Preview iframe                                                     */}
        {/* sandbox="allow-scripts allow-same-origin" (T-08-03-03 revised)   */}
        {/* outline: 3px solid #2563eb in edit mode (UI-SPEC Color)           */}
        {/* onLoad resets iframeReady — wait for IFRAME_READY postMessage     */}
        {/* ---------------------------------------------------------------- */}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          className="w-full flex-1 border-0"
          style={{
            height: "calc(100vh - 3rem)",
            outline: isEditMode ? "3px solid #2563eb" : "none",
            outlineOffset: isEditMode ? "-3px" : undefined,
          }}
          title={`Preview: ${lpName}`}
          onLoad={() => setIframeReady(false)}
        />

        {/* ---------------------------------------------------------------- */}
        {/* Discard confirmation Dialog                                        */}
        {/* Triggered only when pendingEdits.length > 0 (handleDiscard gate)  */}
        {/* ---------------------------------------------------------------- */}
        <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Descartar alterações?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              As {pendingEdits.length} alterações não salvas serão perdidas e o
              texto original será restaurado.
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowDiscardDialog(false)}
              >
                Continuar editando
              </Button>
              <Button variant="destructive" onClick={confirmDiscard}>
                Descartar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
