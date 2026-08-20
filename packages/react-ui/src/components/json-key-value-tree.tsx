import { t } from 'i18next';
import { ChevronRight, Copy } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  jsonPathFromKeys,
  safeJsonStringify,
  valueToClipboardText,
} from '@/lib/react-json-view-utils';

import { Button } from './ui/button';
import { toast } from './ui/use-toast';

type JsonKeyValueTreeProps = {
  value: unknown;
  onSelect?: (selection: { path: string; keys: string[]; value: unknown }) => void;
  selectedPath?: string | null;
  renderSpecialValue?: (value: unknown) => React.ReactNode | null;
};

type NodeType = 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object';

function getNodeType(value: unknown): NodeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

function previewFor(value: unknown): string {
  const type = getNodeType(value);
  if (type === 'array') return `Array(${(value as any[]).length})`;
  if (type === 'object')
    return `Object(${Object.keys(value as Record<string, unknown>).length})`;
  if (type === 'string') return JSON.stringify(value);
  if (type === 'null') return 'null';
  return String(value);
}

function typeClasses(type: NodeType): string {
  switch (type) {
    case 'number':
      return 'bg-yellow-200/60 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'string':
      return 'bg-emerald-200/50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200';
    case 'boolean':
      return 'bg-purple-200/50 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200';
    case 'null':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted/60 text-foreground';
  }
}

export const JsonKeyValueTree = React.memo(
  ({ value, onSelect, selectedPath, renderSpecialValue }: JsonKeyValueTreeProps) => {
    const [openByPath, setOpenByPath] = useState<Record<string, boolean>>({});

    const rootEntries = useMemo(() => {
      const type = getNodeType(value);
      if (type === 'object') {
        return Object.entries(value as Record<string, unknown>).map(
          ([k, v]) => ({ key: k, value: v, parentIsArray: false }),
        );
      }
      if (type === 'array') {
        return (value as unknown[]).map((v, i) => ({
          key: String(i),
          value: v,
          parentIsArray: true,
        }));
      }
      return [];
    }, [value]);

    const toggle = (path: string) => {
      setOpenByPath((prev) => ({ ...prev, [path]: !prev[path] }));
    };

    const renderRow = (
      keyLabel: string,
      nodeValue: unknown,
      keys: string[],
      depth: number,
      parentIsArray: boolean,
    ) => {
      const path = jsonPathFromKeys(keys);
      const type = getNodeType(nodeValue);
      const isContainer = type === 'object' || type === 'array';
      const open = openByPath[path] ?? depth < 2;
      const isSelected = selectedPath === path;
      const special = renderSpecialValue ? renderSpecialValue(nodeValue) : null;

      const handleCopy = () => {
        const text = parentIsArray
          ? valueToClipboardText(nodeValue)
          : safeJsonStringify({ [keyLabel]: nodeValue });
        navigator.clipboard
          .writeText(text)
          .then(() => {
            toast({ title: t('Copied to clipboard'), duration: 1000 });
          })
          .catch((e) => {
            console.debug('[DEBUG] JsonKeyValueTree.copy.failed', {
              path,
              error: e,
              textPreview: text.slice(0, 200),
            });
            toast({ title: t('Failed to copy to clipboard'), duration: 3000 });
          });
      };

      return (
        <div key={path}>
          <div
            className={cn(
              'group flex items-start gap-2 rounded-md px-2 py-1 transition-colors',
              'hover:bg-muted/60',
              isSelected && 'bg-muted/60',
            )}
            style={{ paddingLeft: `${Math.max(0, depth) * 12 + 8}px` }}
            onClick={() => onSelect?.({ path, keys, value: nodeValue })}
          >
            <button
              type="button"
              className={cn(
                'mt-0.5 h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground',
                isContainer ? 'hover:bg-muted' : 'opacity-0 pointer-events-none',
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (isContainer) toggle(path);
              }}
              aria-label={isContainer ? (open ? t('Collapse') : t('Expand')) : ''}
            >
              {isContainer && (
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-transform',
                    open && 'rotate-90',
                  )}
                />
              )}
            </button>

            <span
              className={cn(
                'font-mono text-xs leading-6 rounded px-1',
                'bg-muted text-muted-foreground',
                'group-hover:bg-muted/80',
              )}
            >
              {parentIsArray ? `[${keyLabel}]` : keyLabel}
            </span>

            <div className="min-w-0 flex-1">
              {special ?? (
                <span
                  className={cn(
                    'font-mono text-xs leading-6 rounded px-1 break-all',
                  )}
                  style={{ color: 'rgb(203, 75, 22)'}}
                >
                  {previewFor(nodeValue)}
                </span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-7 gap-1 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity',
                'border-primary text-primary hover:bg-primary/10',
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {t('Copy')}
            </Button>
          </div>

          {isContainer && open && (
            <div>
              {type === 'object' &&
                Object.entries(nodeValue as Record<string, unknown>).map(
                  ([childKey, childValue]) =>
                    renderRow(
                      childKey,
                      childValue,
                      [...keys, childKey],
                      depth + 1,
                      false,
                    ),
                )}
              {type === 'array' &&
                (nodeValue as unknown[]).map((childValue, i) =>
                  renderRow(
                    String(i),
                    childValue,
                    [...keys, String(i)],
                    depth + 1,
                    true,
                  ),
                )}
            </div>
          )}
        </div>
      );
    };

    // Primitive root: render as a single row without key.
    const rootType = getNodeType(value);
    if (rootType !== 'object' && rootType !== 'array') {
      return (
        <div className="font-mono text-xs p-2">
          <span className={cn('rounded px-1', typeClasses(rootType))}>
            {previewFor(value)}
          </span>
        </div>
      );
    }

    return (
      <div className="font-mono text-xs">
        {rootEntries.map((entry) =>
          renderRow(
            entry.key,
            entry.value,
            [entry.key],
            0,
            entry.parentIsArray,
          ),
        )}
      </div>
    );
  },
);

JsonKeyValueTree.displayName = 'JsonKeyValueTree';


