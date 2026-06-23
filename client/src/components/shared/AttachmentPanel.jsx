import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getAttachments, uploadAttachment, deleteAttachment, downloadAttachment } from '../../utils/api';
import { Button } from './UI';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ICONS = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  jpg: '🖼', jpeg: '🖼', png: '🖼', webp: '🖼',
};
const iconFor = (name) => ICONS[(name.split('.').pop() || '').toLowerCase()] || '📎';

// Drop this into any detail view to give that record its own file attachments —
// e.g. <AttachmentPanel entityType="document" entityId={doc.id} />
// Files are gzip-compressed server-side on upload and transparently
// decompressed when downloaded; that's invisible here.
export const AttachmentPanel = ({ entityType, entityId, canUpload = true, canDelete = true }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const load = () => {
    setLoading(true);
    getAttachments(entityType, entityId)
      .then(res => setFiles(res.data.data || []))
      .catch(() => toast.error('Failed to load attachments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (entityId) load(); }, [entityType, entityId]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('File exceeds 25 MB limit.'); return; }
    setUploading(true);
    setProgress(0);
    try {
      await uploadAttachment(entityType, entityId, file, setProgress);
      toast.success(`${file.name} uploaded`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (att) => {
    if (!window.confirm(`Delete ${att.file_name}? This cannot be undone.`)) return;
    try {
      await deleteAttachment(att.id);
      toast.success('File deleted');
      setFiles(prev => prev.filter(f => f.id !== att.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="attachment-panel">
      {canUpload && (
        <div style={{ marginBottom: 10 }}>
          <input ref={inputRef} type="file" id={`file-${entityType}-${entityId}`}
            style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
          <Button size="sm" variant="ghost" disabled={uploading}
            onClick={() => inputRef.current?.click()}>
            {uploading ? `Uploading… ${progress}%` : '+ Attach File'}
          </Button>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading attachments…</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No files attached yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <li key={f.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span>{iconFor(f.file_name)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {formatSize(f.file_size)}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Button size="xs" variant="ghost" onClick={() => downloadAttachment(f.id, f.file_name)}>Download</Button>
                {canDelete && <Button size="xs" variant="ghost" onClick={() => handleDelete(f)}>Delete</Button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
