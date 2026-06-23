import { useState } from 'react';
import { useNotationConverter } from 'notation-converter-react';

export function App() {
  const { convert, status, result, error } = useNotationConverter();
  const [file, setFile] = useState<File | null>(null);

  const onConvert = async () => {
    if (file) await convert(file, { to: 'gp' });
  };

  const onDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.data], { type: result.mimeType }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>notation-converter</h1>
      <p>Convert MusicXML → Guitar Pro, fully in your browser.</p>

      <input
        type="file"
        accept=".musicxml,.xml"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button onClick={onConvert} disabled={!file || status === 'converting'} style={{ marginLeft: 8 }}>
        {status === 'converting' ? 'Converting…' : 'Convert to .gp'}
      </button>

      {error && <p style={{ color: 'crimson' }}>Error: {error.message}</p>}

      {result && (
        <p>
          ✅ Converted <strong>{result.filename}</strong> ({result.data.length} bytes){' '}
          <button onClick={onDownload}>Download</button>
        </p>
      )}
    </main>
  );
}
