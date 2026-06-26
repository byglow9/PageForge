/**
 * Edit script builder — injected into VITE_SPA index.html by the serve route
 * ONLY when ?edit=1 is present (Phase 10 in-iframe text editor).
 *
 * Security:
 * - T-10-02-01: Script is only injected after HMAC token verification (serve route).
 *   Even if a viewer crafts ?edit=1, they have no path to persist edits — persistence
 *   requires calling updateLpAction from the dashboard parent, which independently
 *   gates on requireWorkspaceRole (dual-gate pattern).
 * - T-10-02-02: dashboardOrigin is embedded via JSON.stringify — prevents injection if
 *   the env value contains quotes or backslashes. Same pattern as escapeJsonForHtml in
 *   apply-shim.ts.
 * - T-10-02-05: Text edits applied exclusively via node.textContent (NEVER innerHTML).
 *   The IIFE does not eval() any data from the DOM or postMessage.
 * - T-10-02-06: IIFE validates event.origin === dashboardOrigin before processing any
 *   incoming postMessage (EDIT_MODE_ENTER, EDIT_MODE_EXIT, REQUEST_SAVE, REQUEST_DISCARD).
 *   dashboardOrigin is embedded server-side at injection time, never from URL params.
 * - pathToNode is IDENTICAL to apply-shim.ts:128-138 — must stay in sync so paths
 *   computed by computePath can be decoded by the apply-shim.
 */

// -----------------------------------------------------------------------
// buildEditScript
// -----------------------------------------------------------------------

/**
 * Build the inline <script> IIFE that runs inside the Vite SPA iframe in edit mode.
 *
 * @param dashboardOrigin - The dashboard origin (e.g. "http://localhost:3000") used
 *   for postMessage targetOrigin and event.origin allowlist. Set from
 *   process.env.DASHBOARD_ORIGIN at injection time — never from URL params.
 * @returns A complete <script>...</script> tag string containing the edit-mode IIFE.
 *
 * IIFE capabilities:
 * - Sends IFRAME_READY on DOMContentLoaded (handshake with parent)
 * - Listens for EDIT_MODE_ENTER/EXIT, REQUEST_SAVE, REQUEST_DISCARD from parent
 * - Hover/click/contentEditable lifecycle on text-leaf elements
 * - Sends ELEMENT_SELECTED, ELEMENT_CHANGED, PENDING_EDITS, EDIT_DISCARDED to parent
 * - pathToNode: IDENTICAL to apply-shim.ts:128-138 (character-for-character)
 * - computePath: reverse walk using parent.childNodes (NOT parent.children — Pitfall 1)
 * - fnv1a: FNV-1a 32-bit hash for originalHash (deterministic, self-contained)
 */
export function buildEditScript(dashboardOrigin: string): string {
  // JSON.stringify embeds dashboardOrigin as a safe JS string literal:
  // prevents injection if the value contains quotes or backslashes (T-10-02-02).
  const dashboardOriginLiteral = JSON.stringify(dashboardOrigin);

  return `<script>
/* PageForge edit-mode script — injected by serve route only when ?edit=1 */
(function() {
  'use strict';
  var dashboardOrigin = ${dashboardOriginLiteral};
  var editMode = false;
  var selectedEl = null;
  var selectedPath = null;
  var pendingMap = {};
  var originalMap = {};
  var savedStylesMap = {};

  // FNV-1a 32-bit hash — sync, dependency-free, deterministic.
  // fnv1a('') = '811c9dc5' (satisfies z.string().min(1) for PfOverrideSchema.originalHash).
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  // pathToNode: IDENTICAL to apply-shim.ts:128-138 (character-for-character copy).
  // DO NOT modify — paths computed by computePath must decode correctly via this function.
  // Uses childNodes (includes text nodes, comment nodes) — NOT children (elements only).
  function pathToNode(path) {
    try {
      var parts = path.split('/').filter(function(p) { return p !== ''; });
      var node = document.body;
      for (var i = 0; i < parts.length; i++) {
        var idx = parseInt(parts[i], 10);
        if (!node || !node.childNodes || isNaN(idx) || idx >= node.childNodes.length) return null;
        node = node.childNodes[idx];
      }
      return node || null;
    } catch(e) { return null; }
  }

  // computePath: reverse of pathToNode — walks up from node to document.body.
  // CRITICAL: uses parent.childNodes (ALL node types) NOT parent.children (elements only).
  // Pitfall 1 from RESEARCH.md: text nodes count in childNodes indices.
  function computePath(node) {
    var parts = [];
    var current = node;
    while (current !== document.body && current.parentNode !== null) {
      var par = current.parentNode;
      var idx = Array.prototype.indexOf.call(par.childNodes, current);
      parts.unshift(String(idx));
      current = par;
      if (current === document.body) break;
    }
    if (current !== document.body) return null;
    return '/' + parts.join('/');
  }

  // isTextLeaf: element has no child elements and has non-empty visible text content.
  // Skips non-content tags that should never be editable.
  function isTextLeaf(el) {
    if (el.nodeType !== Node.ELEMENT_NODE) return false;
    var tag = el.tagName.toLowerCase();
    var skipTags = ['script', 'style', 'noscript', 'head', 'meta', 'link', 'br', 'hr', 'input', 'img', 'svg'];
    if (skipTags.includes(tag)) return false;
    if (el.children.length > 0) return false;
    return (el.textContent || '').trim().length > 0;
  }

  // sendToParent: send a postMessage to the dashboard parent window.
  // targetOrigin=dashboardOrigin — never '*' (T-10-02-06).
  function sendToParent(msg) {
    try { parent.postMessage(msg, dashboardOrigin); } catch(e) {}
  }

  // saveStyles: capture element's current inline styles before applying highlights.
  // Preserves author styles so cleanup can restore them (UI-SPEC: restore on deselect).
  function saveStyles(path, el) {
    if (!savedStylesMap[path]) {
      savedStylesMap[path] = {
        outline: el.style.outline,
        outlineOffset: el.style.outlineOffset,
        backgroundColor: el.style.backgroundColor,
        cursor: el.style.cursor,
        boxShadow: el.style.boxShadow
      };
    }
  }

  // restoreStyles: restore element's pre-highlight inline styles from savedStylesMap.
  function restoreStyles(path, el) {
    var saved = savedStylesMap[path];
    if (saved) {
      el.style.outline = saved.outline;
      el.style.outlineOffset = saved.outlineOffset;
      el.style.backgroundColor = saved.backgroundColor;
      el.style.cursor = saved.cursor;
      el.style.boxShadow = saved.boxShadow;
    }
  }

  // deselectCurrent: clear selection highlight on selectedEl and reset state.
  function deselectCurrent() {
    if (selectedEl && selectedPath) {
      restoreStyles(selectedPath, selectedEl);
      selectedEl.removeAttribute('contenteditable');
      selectedEl = null;
      selectedPath = null;
    }
  }

  // Message handler: receive commands from dashboard parent.
  // Validates event.origin === dashboardOrigin before processing (T-10-02-06).
  window.addEventListener('message', function(event) {
    if (event.origin !== dashboardOrigin) return;
    var msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'EDIT_MODE_ENTER') {
      editMode = true;
    } else if (msg.type === 'EDIT_MODE_EXIT') {
      editMode = false;
      deselectCurrent();
    } else if (msg.type === 'REQUEST_SAVE') {
      // Collect pending edits, filtering out unchanged values (value === original).
      var overrides = Object.values(pendingMap).filter(function(ov) {
        return ov.value !== originalMap[ov.path];
      });
      sendToParent({ type: 'PENDING_EDITS', overrides: overrides });
    } else if (msg.type === 'REQUEST_DISCARD') {
      // Restore all original textContent values.
      for (var p in originalMap) {
        var node = pathToNode(p);
        if (node) node.textContent = originalMap[p];
      }
      pendingMap = {};
      // Restore saved styles for all paths in savedStylesMap.
      for (var sp in savedStylesMap) {
        var sEl = pathToNode(sp);
        if (sEl) restoreStyles(sp, sEl);
      }
      // Remove any remaining contentEditable attributes.
      document.querySelectorAll('[contenteditable]').forEach(function(cel) {
        cel.removeAttribute('contenteditable');
      });
      editMode = false;
      selectedEl = null;
      selectedPath = null;
      sendToParent({ type: 'EDIT_DISCARDED' });
    }
  });

  // DOMContentLoaded handler: send IFRAME_READY + register DOM event listeners.
  document.addEventListener('DOMContentLoaded', function() {
    sendToParent({ type: 'IFRAME_READY' });

    // Hover: apply dashed outline to text-leaf elements (UI-SPEC lines 148-154).
    document.body.addEventListener('mouseover', function(e) {
      if (!editMode || !isTextLeaf(e.target)) return;
      var path = computePath(e.target);
      if (!path) return;
      saveStyles(path, e.target);
      e.target.style.outline = '2px dashed #3b82f6';
      e.target.style.outlineOffset = '2px';
      e.target.style.cursor = 'pointer';
    });

    // Hover clear: restore saved styles when mouse leaves (except for selectedEl).
    document.body.addEventListener('mouseout', function(e) {
      if (!editMode || !isTextLeaf(e.target)) return;
      if (e.target === selectedEl) return;
      var path = computePath(e.target);
      if (!path) return;
      restoreStyles(path, e.target);
    });

    // Click: select text-leaf, activate contentEditable, initiate edit session.
    document.body.addEventListener('click', function(e) {
      if (!editMode || !isTextLeaf(e.target)) return;
      e.stopPropagation();
      var el = e.target;
      var path = computePath(el);
      if (!path) return;

      // Deselect previous element if clicking a different one.
      if (selectedEl && selectedEl !== el) {
        deselectCurrent();
      }

      selectedEl = el;
      selectedPath = path;

      // Save styles before applying selection highlight (UI-SPEC: restore author styles).
      saveStyles(path, el);
      el.style.outline = '2px solid #2563eb';
      el.style.outlineOffset = '2px';
      el.style.backgroundColor = 'rgba(37,99,235,0.08)';

      // Capture original textContent lazily on first click (handles overridden values too).
      if (!originalMap[path]) {
        originalMap[path] = el.textContent || '';
      }
      var originalHash = fnv1a(originalMap[path]);

      sendToParent({ type: 'ELEMENT_SELECTED', path: path, originalHash: originalHash, currentText: el.textContent || '' });

      // Activate contentEditable + contentEditable affordance styles.
      el.setAttribute('contenteditable', 'true');
      el.style.cursor = 'text';
      el.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.25)';
      el.focus();

      // Blur: capture edited text, restore cursor/boxShadow, store in pendingMap.
      el.addEventListener('blur', function handleBlur() {
        el.removeEventListener('blur', handleBlur);
        var newText = el.textContent || '';
        el.removeAttribute('contenteditable');
        // Restore only cursor and boxShadow — outline and backgroundColor stay (selection visible).
        var saved = savedStylesMap[path];
        if (saved) {
          el.style.cursor = saved.cursor;
          el.style.boxShadow = saved.boxShadow;
        }
        pendingMap[path] = { path: path, originalHash: originalHash, type: 'text', value: newText };
        sendToParent({ type: 'ELEMENT_CHANGED', path: path, newText: newText });
      });

      // Keydown: Enter confirms edit (blur); Escape reverts and blurs.
      el.addEventListener('keydown', function handleKeydown(ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
        if (ev.key === 'Escape') { el.textContent = originalMap[path] || ''; el.blur(); }
      });
    });
  });
})();
</script>`;
}

// -----------------------------------------------------------------------
// injectEditScript
// -----------------------------------------------------------------------

/**
 * Insert the edit script into a VITE_SPA HTML string immediately before </head>.
 *
 * Identical strategy to injectOverrides in apply-shim.ts:
 * - Case-insensitive </head> search (matches injectBrandStyle and injectOverrides).
 * - Slices on the ORIGINAL html so document casing is preserved (toLowerCase()
 *   used only for position detection — same as IN-04 comment in apply-shim.ts).
 * - Fallback: no </head> found → prepend edit script to html.
 *
 * @param html - The LP HTML string (after injectOverrides has already run).
 * @param editScript - The <script>...</script> string from buildEditScript().
 * @returns html with editScript injected before </head>, or prepended if absent.
 */
export function injectEditScript(html: string, editScript: string): string {
  // IN-04 same pattern: case-insensitive indexOf; slice on ORIGINAL html.
  const idx = html.toLowerCase().indexOf("</head>");
  if (idx !== -1) {
    return html.slice(0, idx) + editScript + "\n" + html.slice(idx);
  }
  // Fallback: no </head> found — prepend (same as injectOverrides fallback).
  return `${editScript}\n${html}`;
}
