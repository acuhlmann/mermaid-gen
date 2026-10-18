import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fileSummaryFromFile,
  imageSummaryFromElement,
  isImageFile,
  isVideoFile,
  videoSummaryFromElement
} from './mediaMetadata.js';
import './MediaViewer.css';

function kindLabel(file) {
  if (isVideoFile(file)) return 'Video';
  if (isImageFile(file)) return 'Image';
  return 'File';
}

/**
 * Local media library viewer — review walkthrough MP4s without leaving the dev server.
 * Video `src` is assigned in an effect (not in JSX) so switching files does not leave
 * the element stuck mid-decode, which reads as a frozen frame.
 */
export default function MediaViewer() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [streamMeta, setStreamMeta] = useState([]);
  const [playbackError, setPlaybackError] = useState(null);

  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selected = useMemo(
    () => items.find((entry) => entry.id === selectedId) ?? null,
    [items, selectedId]
  );

  const revokeAll = useCallback(() => {
    for (const entry of itemsRef.current) {
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
  }, []);

  useEffect(() => () => revokeAll(), [revokeAll]);

  const onPickFiles = useCallback(
    (event) => {
      const fileList = event.target.files;
      if (!fileList?.length) return;
      revokeAll();
      const next = Array.from(fileList).map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        url: URL.createObjectURL(file)
      }));
      setItems(next);
      setSelectedId(next[0]?.id ?? null);
      setStreamMeta([]);
      setPlaybackError(null);
      event.target.value = '';
    },
    [revokeAll]
  );

  useEffect(() => {
    setStreamMeta([]);
    setPlaybackError(null);
  }, [selectedId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (!selected || !isVideoFile(selected.file)) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      return undefined;
    }

    const url = selected.url;
    video.pause();
    video.src = url;
    video.load();

    const onMeta = () => {
      setStreamMeta(videoSummaryFromElement(video, selected.file));
    };
    const onError = () => {
      const code = video.error?.code;
      setPlaybackError(
        code != null ? `Playback error (code ${code}).` : 'Playback failed for this file.'
      );
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('loadeddata', onMeta);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('loadeddata', onMeta);
      video.removeEventListener('error', onError);
      video.pause();
    };
  }, [selected]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img || !selected || !isImageFile(selected.file)) return undefined;

    const onLoad = () => {
      setStreamMeta(imageSummaryFromElement(img, selected.file));
    };
    img.addEventListener('load', onLoad);
    if (img.complete) onLoad();
    return () => img.removeEventListener('load', onLoad);
  }, [selected]);

  const metaRows = useMemo(() => {
    if (!selected) return [];
    const base = fileSummaryFromFile(selected.file);
    if (streamMeta.length === 0) return base;
    const seen = new Set(base.map((row) => row.label));
    const merged = [...base];
    for (const row of streamMeta) {
      if (seen.has(row.label)) continue;
      merged.push(row);
      seen.add(row.label);
    }
    for (const row of streamMeta) {
      const idx = merged.findIndex((r) => r.label === row.label);
      if (idx >= 0) merged[idx] = row;
    }
    return merged;
  }, [selected, streamMeta]);

  const stage = (() => {
    if (!selected) {
      return <p className="media-viewer-empty">Choose files to preview video and images.</p>;
    }
    if (isVideoFile(selected.file)) {
      return (
        <>
          <video
            ref={videoRef}
            className="media-viewer-video"
            controls
            playsInline
            preload="metadata"
          />
          {playbackError ? (
            <p className="media-viewer-error" role="alert">
              {playbackError}
            </p>
          ) : null}
        </>
      );
    }
    if (isImageFile(selected.file)) {
      return (
        <img
          ref={imageRef}
          className="media-viewer-image"
          src={selected.url}
          alt={selected.file.name}
        />
      );
    }
    return (
      <p className="media-viewer-empty">
        Preview is available for images and video. Metadata for this file is in the panel.
      </p>
    );
  })();

  return (
    <div className="media-viewer-root" data-testid="media-viewer">
      <header className="media-viewer-header">
        <h1 className="media-viewer-title">Media viewer</h1>
        <label className="media-viewer-pick">
          <input
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={onPickFiles}
            data-testid="media-viewer-file-input"
          />
          Add media
        </label>
      </header>
      <div className="media-viewer-body">
        <aside className="media-viewer-list" aria-label="Media list">
          <h2 className="media-viewer-list-heading">Library</h2>
          {items.length === 0 ? (
            <p className="media-viewer-empty">No files yet.</p>
          ) : (
            items.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`media-viewer-item${entry.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(entry.id)}
                data-testid={`media-item-${entry.id}`}
              >
                <span className="media-viewer-item-name">{entry.file.name}</span>
                <span className="media-viewer-item-kind">{kindLabel(entry.file)}</span>
              </button>
            ))
          )}
        </aside>
        <main className="media-viewer-stage" aria-label="Preview">
          {stage}
        </main>
        <aside className="media-viewer-meta" aria-label="Metadata">
          <h2 className="media-viewer-meta-heading">Metadata</h2>
          {!selected ? (
            <p className="media-viewer-empty">Select a file to inspect metadata.</p>
          ) : (
            <div data-testid="media-viewer-metadata">
              {metaRows.map((row) => (
                <div key={row.label} className="media-viewer-meta-row">
                  <span className="media-viewer-meta-label">{row.label}</span>
                  <span className="media-viewer-meta-value">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
