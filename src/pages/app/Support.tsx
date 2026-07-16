import { useCallback, useEffect, useState } from 'react';
import { Camera, HelpCircle, Image, RefreshCw, Send, X } from 'lucide-react';
import { PageHeader } from '../../components/app/PageHeader';
import { EmptyState } from '../../components/app/EmptyState';
import { Spinner } from '../../components/app/Spinner';
import { Badge } from '../../components/app/Badge';
import {
  apiClient,
  type SupportIssue,
  type SupportIssueScreenshot,
  type SupportIssueCategory,
  type SupportIssueStatus,
} from '../../services/api';

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

const MAX_SCREENSHOT_BYTES = 2.5 * 1024 * 1024;
const MAX_SCREENSHOTS = 5;

type ScreenshotAttachment = {
  dataUrl: string;
  name: string;
  contentType: string;
};

function toScreenshotPayload(screenshot: ScreenshotAttachment) {
  return {
    data_url: screenshot.dataUrl,
    name: screenshot.name,
    content_type: screenshot.contentType,
  };
}

function getScreenshotCount(issue: SupportIssue) {
  if (typeof issue.screenshot_count === 'number') return issue.screenshot_count;
  if (issue.screenshots?.length) return issue.screenshots.length;
  if (issue.screenshot_data_url) return 1;
  return 0;
}

function statusVariant(status: SupportIssueStatus): 'pending' | 'warning' | 'success' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'in_progress') return 'warning';
  if (status === 'open') return 'info';
  return 'pending';
}

function statusLabel(status: SupportIssueStatus): string {
  if (status === 'in_progress') return 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function readImageFile(file: File): Promise<{
  dataUrl: string;
  name: string;
  contentType: string;
}> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      reject(new Error('Screenshot should be smaller than 2.5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUrl: String(reader.result || ''),
        name: file.name,
        contentType: file.type,
      });
    };
    reader.onerror = () => reject(new Error('Could not read screenshot.'));
    reader.readAsDataURL(file);
  });
}

export function Support() {
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewScreenshots, setPreviewScreenshots] = useState<SupportIssueScreenshot[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [category, setCategory] = useState<SupportIssueCategory>('problem');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<ScreenshotAttachment[]>([]);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listSupportIssues();
      setIssues(response.issues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support issues.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openIssueScreenshots = async (issue: SupportIssue) => {
    setError(null);
    setPreviewLoading(true);
    try {
      const existing = issue.screenshots?.length ? issue.screenshots : null;
      if (existing) {
        setPreviewScreenshots(existing);
        setPreviewIndex(0);
        return;
      }

      const res = await apiClient.getSupportIssueScreenshots(issue.id);
      const screenshots = res?.screenshots ?? [];
      setPreviewScreenshots(screenshots);
      setPreviewIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load screenshots.');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  async function handleScreenshotChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setError(null);
    try {
      const remainingSlots = MAX_SCREENSHOTS - screenshots.length;
      if (remainingSlots <= 0) {
        setError(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
        return;
      }

      const selectedFiles = files.slice(0, remainingSlots);
      if (files.length > remainingSlots) {
        setError(`Only ${remainingSlots} more screenshot${remainingSlots === 1 ? '' : 's'} can be added.`);
      }

      const nextScreenshots = await Promise.all(selectedFiles.map((file) => readImageFile(file)));
      setScreenshots((prev) => [...prev, ...nextScreenshots]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach screenshot.');
    }
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Please enter a subject.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe the query or problem.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const issue = await apiClient.createSupportIssue({
        category,
        title: title.trim(),
        description: description.trim(),
        screenshots: screenshots.map(toScreenshotPayload),
      });
      setIssues((prev) => [issue, ...prev]);
      setTitle('');
      setDescription('');
      setScreenshots([]);
      setCategory('problem');
      setMessage('Your report was sent to BillGenie support.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit support issue.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Support"
        subtitle="Send queries, problems, and screenshots to the BillGenie team."
        action={
          <button
            type="button"
            onClick={loadIssues}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Raise a request</h2>
              <p className="text-xs text-gray-500">BillGenie support will review it from the platform.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Type
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportIssueCategory)}
                className={`${inputClass} mt-1`}
              >
                <option value="problem">Problem</option>
                <option value="query">Query</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Subject
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder="e.g. Payment receipt is not printing"
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Explain what happened, the screen you were on, and what you expected."
                className={`${inputClass} mt-1 resize-none`}
              />
            </label>

            <div className="rounded-xl border border-dashed border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Camera className="h-4 w-4 text-gray-400" />
                  Screenshots are optional ({screenshots.length}/{MAX_SCREENSHOTS})
                </div>
                <label
                  className={`cursor-pointer rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 ${
                    screenshots.length >= MAX_SCREENSHOTS ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  Add images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleScreenshotChange}
                    className="hidden"
                    disabled={screenshots.length >= MAX_SCREENSHOTS}
                  />
                </label>
              </div>
              {screenshots.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {screenshots.map((screenshot, index) => (
                    <div key={`${screenshot.name}-${index}`} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                      <img src={screenshot.dataUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{screenshot.name}</p>
                        <p className="text-xs text-gray-500">Attached to this request</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeScreenshot(index)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {message ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
              Submit to BillGenie
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Previous reports</h2>
          <p className="mt-1 text-xs text-gray-500">Track status and any resolution notes from support.</p>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" className="text-primary" />
            </div>
          ) : issues.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="No support requests yet"
              description="Submitted queries and problems will appear here."
            />
          ) : (
            <div className="mt-4 space-y-3">
              {issues.map((issue) => {
                const screenshotCount = getScreenshotCount(issue);
                return (
                <article key={issue.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-gray-900">{issue.title}</h3>
                        <Badge variant={statusVariant(issue.status)}>{statusLabel(issue.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {issue.category} · {formatDate(issue.created_at)}
                      </p>
                    </div>
                    {screenshotCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => openIssueScreenshots(issue)}
                        className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        <Image className="h-3.5 w-3.5" />
                        View screenshots{screenshotCount > 1 ? ` (${screenshotCount})` : ''}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{issue.description}</p>
                  {issue.resolution_note ? (
                    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <span className="font-semibold">BillGenie response: </span>
                      {issue.resolution_note}
                    </div>
                  ) : null}
                </article>
              );
              })}
            </div>
          )}
        </section>
      </div>

      {previewScreenshots.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setPreviewScreenshots([]);
            setPreviewIndex(0);
          }}
        >
          <div
            className="max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {previewScreenshots[previewIndex]?.name || `Screenshot ${previewIndex + 1}`}
                </p>
                {previewScreenshots.length > 1 ? (
                  <p className="text-xs text-gray-500">
                    {previewIndex + 1} of {previewScreenshots.length}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {previewScreenshots.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewIndex((i) => (i - 1 + previewScreenshots.length) % previewScreenshots.length)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewIndex((i) => (i + 1) % previewScreenshots.length)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    >
                      Next
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewScreenshots([]);
                    setPreviewIndex(0);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[calc(90vh-56px)] overflow-auto p-4">
              {previewLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner />
                </div>
              ) : (
                <img
                  src={previewScreenshots[previewIndex]?.data_url}
                  alt={previewScreenshots[previewIndex]?.name || `Screenshot ${previewIndex + 1}`}
                  className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
