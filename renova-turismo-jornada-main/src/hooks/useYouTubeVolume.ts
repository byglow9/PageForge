import { useEffect, useRef } from "react";

/**
 * Hook para controlar o volume de um iframe do YouTube.
 * Requer que o parâmetro `enablejsapi=1` esteja no src do iframe.
 * Inicia o vídeo desmutado com o volume especificado (default 50%).
 */
export function useYouTubeVolume(volume = 50) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendCommand = (func: string, args: any[] = []) => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func, args }),
          "https://www.youtube.com"
        );
      } catch {
        // Ignora erros de cross-origin ou iframe não pronto
      }
    };

    const attempt = () => {
      sendCommand("unMute");
      sendCommand("setVolume", [volume]);
    };

    // Primeira tentativa rápida
    const firstTimer = setTimeout(attempt, 1200);
    // Repetir por segurança até o player estar pronto
    const interval = setInterval(attempt, 2000);
    const stopTimer = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
      clearTimeout(stopTimer);
    };
  }, [volume]);

  return iframeRef;
}
