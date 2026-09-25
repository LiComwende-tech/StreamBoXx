import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type TrackOption = { id: number; label: string };
type PlaybackSource = { label: string; provider: string; playbackUrl: string; expiresInSeconds: number };
type HlsController = {
  destroy: () => void;
  subtitleTracks: Array<{ id: number; name?: string; lang?: string }>;
  audioTracks: Array<{ id: number; name?: string; lang?: string }>;
  levels: Array<{ height?: number; bitrate?: number }>;
  subtitleTrack: number;
  audioTrack: number;
  currentLevel: number;
};

export default function StreamPlayer({ titleId, title, publicPlaybackUrl, publicEmbedUrl, publicSourceUrl, onClose }: { titleId: string; title: string; publicPlaybackUrl?: string; publicEmbedUrl?: string; publicSourceUrl?: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [embedded, setEmbedded] = useState(false);
  const [playbackSources, setPlaybackSources] = useState<PlaybackSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [message, setMessage] = useState('Checking your access…');
  const [loading, setLoading] = useState(true);
  const [subtitles, setSubtitles] = useState<TrackOption[]>([]);
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([]);
  const [qualities, setQualities] = useState<TrackOption[]>([]);
  const [subtitleTrack, setSubtitleTrack] = useState('-1');
  const [audioTrack, setAudioTrack] = useState('-1');
  const [quality, setQuality] = useState('-1');
  const hlsRef = useRef<HlsController | null>(null);

  useEffect(() => {
    let active = true;
    if (publicEmbedUrl) {
      setEmbedded(true);
      setMessage('');
      setLoading(false);
      return () => { active = false; };
    }
    if (publicPlaybackUrl) {
      setEmbedded(false);
      setPlaybackUrl(publicPlaybackUrl);
      setMessage('');
      setLoading(false);
      return () => { active = false; };
    }
    if (!supabase) {
      setMessage('Member playback is not connected yet.');
      setLoading(false);
      return;
    }
    void supabase.functions.invoke('stream-access', { body: { titleId } }).then(({ data, error }) => {
      if (!active) return;
      if (error || typeof data?.playbackUrl !== 'string') {
        setMessage(typeof data?.error === 'string' ? data.error : error?.message || 'Playback could not be started. Please sign in and try again.');
        setLoading(false);
        return;
      }
      const sources: PlaybackSource[] = Array.isArray(data?.playbackSources)
        ? data.playbackSources.filter((source: unknown): source is PlaybackSource => typeof source === 'object' && source !== null && 'label' in source && 'provider' in source && 'playbackUrl' in source && 'expiresInSeconds' in source && typeof source.label === 'string' && typeof source.provider === 'string' && typeof source.playbackUrl === 'string' && typeof source.expiresInSeconds === 'number')
        : [];
      if (sources.length) {
        setPlaybackSources(sources);
        setSelectedSource(sources[0].playbackUrl);
        setPlaybackUrl(sources[0].playbackUrl);
        setMessage('');
        setLoading(false);
        return;
      }
      setPlaybackUrl(data.playbackUrl);
      setMessage('');
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setMessage('Playback could not be started. Please try again.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [titleId, publicPlaybackUrl, publicEmbedUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) { video.volume = 1; video.muted = false; }
    if (!video || !playbackUrl || !/\.m3u8(?:$|\?)/i.test(playbackUrl)) return;
    let active = true;
    void import('hls.js').then(({ default: Hls }) => {
      if (!active) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
          setSubtitles(hls.subtitleTracks.map((track, index) => ({ id: track.id ?? index, label: track.name || track.lang || `Subtitle ${index + 1}` })));
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          setAudioTracks(hls.audioTracks.map((track, index) => ({ id: track.id ?? index, label: track.name || track.lang || `Audio ${index + 1}` })));
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setQualities(hls.levels.map((level, index) => ({ id: index, label: level.height ? `${level.height}p` : level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : `Quality ${index + 1}` })));
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setMessage('This stream could not be played on this device.');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playbackUrl;
      } else {
        setMessage('This device cannot play the selected stream format.');
      }
    }).catch(() => setMessage('The secure video player could not be loaded.'));
    return () => { active = false; hlsRef.current?.destroy(); hlsRef.current = null; setSubtitles([]); setAudioTracks([]); setQualities([]); };
  }, [playbackUrl]);

  function chooseSubtitle(value: string) {
    setSubtitleTrack(value);
    if (hlsRef.current) hlsRef.current.subtitleTrack = Number(value);
    else if (videoRef.current) {
      Array.from(videoRef.current.textTracks).forEach((track, index) => { track.mode = value !== '-1' && index === Number(value) ? 'showing' : 'disabled'; });
    }
  }

  return (
    <div className="stream-player-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="stream-player-dialog" role="dialog" aria-modal="true" aria-labelledby="stream-player-title">
        <div className="stream-player-heading"><h2 id="stream-player-title">{title}</h2><button className="dialog-close" onClick={onClose} aria-label="Close player">×</button></div>
        {loading ? <div className="stream-player-message" role="status">{message}</div> : embedded && publicEmbedUrl ? <iframe className="stream-video" src={publicEmbedUrl} title={`${title} video player`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : playbackUrl ? <video ref={videoRef} className="stream-video" src={/\.m3u8(?:$|\?)/i.test(playbackUrl) ? undefined : playbackUrl} controls playsInline preload="metadata" onError={() => setMessage('This video is currently unavailable. Please try again later.')} /> : <div className="stream-player-message" role="alert">{message}</div>}
        {!loading && playbackUrl && (playbackSources.length > 1 || subtitles.length > 0 || audioTracks.length > 0 || qualities.length > 1) && <div className="stream-player-options" aria-label="Playback options">
          {playbackSources.length > 1 && <label>Server<select value={selectedSource} onChange={(event) => { setSelectedSource(event.target.value); setPlaybackUrl(event.target.value); setSubtitles([]); setAudioTracks([]); setQualities([]); setSubtitleTrack('-1'); setAudioTrack('-1'); setQuality('-1'); }} aria-label="Select an available secure playback server">{playbackSources.map((source, index) => <option key={`${source.provider}-${source.playbackUrl}`} value={source.playbackUrl}>{source.label || `Server ${index + 1}`}</option>)}</select></label>}
          {subtitles.length > 0 && <label>Subtitles<select value={subtitleTrack} onChange={(event) => chooseSubtitle(event.target.value)}><option value="-1">Off</option>{subtitles.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}</select></label>}
          {audioTracks.length > 0 && <label>Audio<select value={audioTrack} onChange={(event) => { setAudioTrack(event.target.value); if (hlsRef.current) hlsRef.current.audioTrack = Number(event.target.value); }}><option value="-1">Auto</option>{audioTracks.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}</select></label>}
          {qualities.length > 1 && <label>Quality<select value={quality} onChange={(event) => { setQuality(event.target.value); if (hlsRef.current) hlsRef.current.currentLevel = Number(event.target.value); }}><option value="-1">Auto</option>{qualities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        </div>}
        {!loading && playbackUrl && message && <p className="stream-player-error" role="alert">{message}</p>}
        <p className="stream-player-footnote">{embedded ? <>This title plays in StreamBoXX using the official rights-holder player.</> : publicSourceUrl ? <>This archive film is silent and has no soundtrack or subtitle tracks. <a href={publicSourceUrl} target="_blank" rel="noreferrer">View source and rights details</a>.</> : <>Playback links are private and expire automatically.</>}</p>
      </section>
    </div>
  );
}
