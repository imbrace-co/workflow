import { t } from 'i18next';
import { Copy, CopyPlus, Download, Eye, EyeOff, Link2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { JsonKeyValueTree } from '@/components/json-key-value-tree';
import {
  valueToClipboardText,
} from '@/lib/react-json-view-utils';
import { isStepFileUrl } from '@/lib/utils';
import { isNil } from '@activepieces/shared';

import { Button } from './ui/button';
import { toast } from './ui/use-toast';

type JsonViewerProps = {
  json: any;
  title: string;
  hideDownload?: boolean;
};

type FileButtonProps = {
  fileUrl: string;
  handleDownloadFile: (fileUrl: string) => void;
};
const FileButton = ({ fileUrl, handleDownloadFile }: FileButtonProps) => {
  const readonly = fileUrl.includes('file://');
  return (
    <div className="flex items-center gap-0">
      <Button
        variant="ghost"
        size="sm"
        disabled={readonly}
        onClick={() => handleDownloadFile(fileUrl)}
        className="flex items-center gap-2 p-2 max-h-[20px] text-xs"
      >
        {readonly ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
        {t('Download File')}
      </Button>
    </div>
  );
};

const removeUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefined(value)]),
    );
  }
  return obj;
};

const JsonViewer = React.memo(
  ({ json: unclearJson, title, hideDownload = false }: JsonViewerProps) => {
    const [selected, setSelected] = useState<{
      keys: string[];
      path: string;
      value: unknown;
    } | null>(null);
    const json = useMemo(() => {
      return removeUndefined(unclearJson);
    }, [unclearJson]);

    useEffect(() => {
      setSelected(null);
    }, [json]);

    const handleCopy = () => {
      navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      toast({
        title: t('Copied to clipboard'),
        duration: 1000,
      });
    };

    const handleSelect = (selection: {
      path: string;
      keys: string[];
      value: unknown;
    }) => {
      setSelected({
        keys: selection.keys,
        path: selection.path,
        value: selection.value,
      });
      console.debug('[DEBUG] JsonViewer.select', {
        title,
        path: selection.path,
        keys: selection.keys,
        valueType: typeof selection.value,
      });
    };

    const handleCopySelectedValue = async () => {
      if (!selected) {
        return;
      }
      console.debug('[DEBUG] JsonViewer.copySelectedValue', {
        title,
        selectedPath: selected.path,
        selectedValue: selected.value,
      });
      if (selected.value === undefined) {
        toast({
          title: t('No value selected'),
          duration: 1500,
        });
        return;
      }
      const text = valueToClipboardText(selected.value);
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        console.debug('[DEBUG] JsonViewer.copySelectedValue.failed', {
          title,
          error: e,
          textPreview: text.slice(0, 200),
        });
        toast({
          title: t('Failed to copy to clipboard'),
          duration: 3000,
        });
        return;
      }
      try {
        toast({
          title: t('Copied to clipboard'),
          duration: 1000,
        });
      } catch (e) {
        console.debug('[DEBUG] JsonViewer.copySelectedValue.toastFailed', {
          title,
          error: e,
        });
      }
    };

    const handleCopySelectedPath = async () => {
      if (!selected?.path) {
        return;
      }
      console.debug('[DEBUG] JsonViewer.copySelectedPath', {
        title,
        selectedPath: selected.path,
      });
      const text = selected.path;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        console.debug('[DEBUG] JsonViewer.copySelectedPath.failed', {
          title,
          error: e,
          textPreview: text.slice(0, 200),
        });
        toast({
          title: t('Failed to copy to clipboard'),
          duration: 3000,
        });
        return;
      }
      try {
        toast({
          title: t('Copied to clipboard'),
          duration: 1000,
        });
      } catch (e) {
        console.debug('[DEBUG] JsonViewer.copySelectedPath.toastFailed', {
          title,
          error: e,
        });
      }
    };

    const handleDownload = () => {
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      handleDownloadFile(url);
    };

    const handleDownloadFile = (fileUrl: string, ext = '') => {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `${title}${ext}`;
      link.click();
      URL.revokeObjectURL(fileUrl);
    };

    if (isStepFileUrl(json)) {
      return (
        <FileButton fileUrl={json} handleDownloadFile={handleDownloadFile} />
      );
    }

    return (
      <div className="rounded-lg border border-solid border-dividers overflow-hidden relative">
        <div className="px-3 py-2 flex border-solid border-b border-dividers justify-center items-center">
          <div className="flex-grow justify-center items-center">
            <span className="text-md">{title}</span>
          </div>
          <div className="flex items-center gap-0">
            {!hideDownload && (
              <Button variant={'ghost'} size={'sm'} onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={'ghost'}
                  size={'sm'}
                  onClick={handleCopySelectedPath}
                  disabled={!selected?.path}
                >
                  <Link2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex flex-col gap-1">
                  <span>{t('Copy selected path')}</span>
                  {selected?.path && (
                    <span className="font-mono text-xs break-all">
                      {selected.path}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={'ghost'}
                  size={'sm'}
                  onClick={handleCopySelectedValue}
                  disabled={!selected}
                >
                  <CopyPlus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('Copy selected value')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
            <Button variant={'ghost'} size={'sm'} onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('Copy all')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {
          <>
            {isNil(json) ? (
              <pre className="text-sm whitespace-pre-wrap overflow-x-auto p-2">
                {json === null ? 'null' : 'undefined'}
              </pre>
            ) : (
              <>
                {typeof json !== 'string' && typeof json !== 'object' && (
                  <pre className="text-sm whitespace-pre-wrap  break-all overflow-x-auto p-2">
                    {JSON.stringify(json)}
                  </pre>
                )}
                {typeof json === 'string' && (
                  <pre className="text-sm whitespace-pre-wrap break-all overflow-x-auto p-2">
                    {json}
                  </pre>
                )}
                {typeof json === 'object' && (
                  <div className="max-w-full">
                    <JsonKeyValueTree
                      value={json}
                      selectedPath={selected?.path ?? null}
                      onSelect={handleSelect}
                      renderSpecialValue={(v) => {
                        if (typeof v === 'string' && isStepFileUrl(v)) {
                          return (
                            <FileButton
                              fileUrl={v}
                              handleDownloadFile={handleDownloadFile}
                            />
                          );
                        }
                        return null;
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        }
      </div>
    );
  },
);

JsonViewer.displayName = 'JsonViewer';
export { JsonViewer };
