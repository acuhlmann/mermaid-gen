import { useEffect } from 'react';

/** Mirror prompt buffers into refs for voice/radial callbacks with stable deps. */
export function usePromptBufferSync({
  prompt,
  promptRef,
  deskPrompt,
  deskPromptRef,
  slopNextPrompt,
  slopNextPromptRef,
  slopPromptExpanded,
  slopPromptExpandedRef,
  slopPromptSource,
  slopPromptSourceRef
}) {
  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt, promptRef]);

  useEffect(() => {
    deskPromptRef.current = deskPrompt;
  }, [deskPrompt, deskPromptRef]);

  useEffect(() => {
    slopNextPromptRef.current = slopNextPrompt;
  }, [slopNextPrompt, slopNextPromptRef]);

  useEffect(() => {
    slopPromptExpandedRef.current = slopPromptExpanded;
  }, [slopPromptExpanded, slopPromptExpandedRef]);

  useEffect(() => {
    slopPromptSourceRef.current = slopPromptSource;
  }, [slopPromptSource, slopPromptSourceRef]);
}
