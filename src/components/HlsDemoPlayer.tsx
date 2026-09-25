import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const DEMO_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

type SubtitleTrack = { id: number; name: string; lang?: string };

export default function HlsDemoPlayer({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [subtitleTrack, setSubtitleTrack] = useState('-1');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let timeout = 0;
    const clearLoadingTimeout = () => window.clearTimeout(timeout);
    const onLoaded = () => {
      clearLoadingTimeout();
      setLoading(false);
    };
    const onMediaError = () => {
      if (video.error) {
        clearLoadingTimeout();
        setLoading(false);
        setError('The demo stream is unavailable right now. Please try again later.');
      }
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onMediaError);
    timeout = window.setTimeout(() => {
      setLoading(false);
      setError((current) => current || 'The test stream is taking too long to respond. Check your connection and reload the preview.');
    }, 25000);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = DEMO_STREAM;
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(DEMO_STREAM);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => onLoaded());
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
        setSubtitles(data.subtitleTracks.map(({ id, name, lang }) => ({ id, name, lang })));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          clearLoadingTimeout();
          setLoading(false);
          setError('The demo stream could not be loaded. Check your internet connection and try again.');
        }
      });
    } else {
      setLoading(false);
      setError('This browser does not support HLS playback. Try a current version of Chrome, Edge, or Safari.');
    }

    return () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onMediaError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, []);

  function changeSubtitle(value: string) {
    setSubtitleTrack(value);
    if (hlsRef.current) hlsRef.current.subtitleTrack = Number(value);
  }

  return (
    <section className="player-page" aria-labelledby="player-title">
      <div className="player-heading">
        <div><p className="eyebrow">DEVELOPER PREVIEW · TEST STREAM</p><h1 id="player-title">HLS player demo</h1><p>This external sample is only for testing playback. It is not part of the StreamBoXx catalogue.</p></div>
        <button className="back-button" onClick={onClose}><span aria-hidden="true">←</span> Back to browse</button>
      </div>
      <div className="video-frame">
        <video ref={videoRef} controls playsInline preload="metadata" aria-label="HLS test stream video" />
        {loading && <div className="player-status" role="status"><span className="loader" /> Connecting to the test stream…</div>}
        {error && <div className="player-error" role="alert"><span>!</span><p>{error}</p><button onClick={() => window.location.reload()}>Reload preview</button></div>}
      </div>
      <div className="player-controls-note">
        <span>Playback controls appear on the video.</span>
        {subtitles.length > 0 && <label>Subtitles <select value={subtitleTrack} onChange={(event) => changeSubtitle(event.target.value)}><option value="-1">Off</option>{subtitles.map((track) => <option key={track.id} value={track.id}>{track.name || track.lang || `Track ${track.id + 1}`}</option>)}</select></label>}
      </div>
      <p className="stream-source">Test stream source: <a href="https://github.com/video-dev/hls.js/blob/master/demo/basic-usage.html" target="_blank" rel="noreferrer">HLS.js public demo</a>.</p>
    </section>
  );
}
