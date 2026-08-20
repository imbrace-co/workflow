import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Mention, { MentionNodeAttrs } from '@tiptap/extension-mention';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { useEditor, EditorContent } from '@tiptap/react';
import React from 'react';

import './tip-tap.css';
import { stepsHooks } from '@/features/pieces/lib/steps-hooks';
import { cn } from '@/lib/utils';
import { flowStructureUtil, isNil } from '@activepieces/shared';

import { useBuilderStateContext } from '../../builder-hooks';

import { textMentionUtils } from './text-input-utils';

type TextInputWithMentionsProps = {
  className?: string;
  initialValue?: unknown;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  plainText?: boolean;
};
const extensions = (placeholder?: string) => {
  return [
    Document,
    History,
    HardBreak,
    Placeholder.configure({
      placeholder,
    }),
    Paragraph.configure({
      HTMLAttributes: {},
    }),
    Text,
    Mention.configure({
      suggestion: {
        char: '',
      },
      deleteTriggerWithBackspace: true,
      renderHTML({ node }) {
        const mentionAttrs: MentionNodeAttrs =
          node.attrs as unknown as MentionNodeAttrs;
        return textMentionUtils.generateMentionHtmlElement(mentionAttrs);
      },
    }),
  ];
};

function convertToText(value: unknown): string {
  if (isNil(value)) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return JSON.stringify(value);
}

export const TextInputWithMentions = ({
  className,
  initialValue,
  onChange,
  disabled,
  placeholder,
  plainText = true,
}: TextInputWithMentionsProps) => {
  const setInsertMentionHandler = useBuilderStateContext(
    (state) => state.setInsertMentionHandler,
  );

  // Plain text editable mode
  if (plainText) {
    const textValue = convertToText(initialValue);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    
    const handleFocus = React.useCallback(() => {
      const insertMentionPlainText = (propertyPath: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = textarea.value;
        const mentionText = `{{${propertyPath}}}`;
        
        // Insert the mention at cursor position
        const newValue = 
          currentValue.substring(0, start) + 
          mentionText + 
          currentValue.substring(end);
        
        onChange(newValue);
        
        // Set cursor position after the inserted mention
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = start + mentionText.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      };
      
      setInsertMentionHandler(insertMentionPlainText);
    }, [onChange, setInsertMentionHandler]);
    
    return (
      <textarea
        ref={textareaRef}
        className={cn(
          'w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 resize-y',
          textMentionUtils.inputWithMentionsCssClass,
          className,
        )}
        value={textValue}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
      />
    );
  }

  // Original TipTap implementation
  const steps = useBuilderStateContext((state) =>
    flowStructureUtil.getAllSteps(state.flowVersion.trigger),
  );
  const stepsMetadata = stepsHooks
    .useStepsMetadata(steps)
    .map(({ data: metadata }, index) => {
      if (metadata) {
        return {
          ...metadata,
          stepDisplayName: steps[index].displayName,
        };
      }
      return undefined;
    });

  const insertMention = (propertyPath: string) => {
    const mentionNode = textMentionUtils.createMentionNodeFromText(
      `{{${propertyPath}}}`,
      steps,
      stepsMetadata,
    );
    editor?.chain().focus().insertContent(mentionNode).run();
  };
  const editor = useEditor({
    editable: !disabled,
    extensions: extensions(placeholder),
    content: {
      type: 'doc',
      content: textMentionUtils.convertTextToTipTapJsonContent(
        convertToText(initialValue),
        steps,
        stepsMetadata,
      ),
    },
    editorProps: {
      attributes: {
        class: cn(
          className ??
            ' w-full rounded-sm border shadow-sm border-input bg-background px-3 min-h-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          textMentionUtils.inputWithMentionsCssClass,
          {
            'cursor-not-allowed opacity-50': disabled,
          },
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const editorContent = editor.getJSON();
      const textResult =
        textMentionUtils.convertTiptapJsonToText(editorContent);
      if (onChange) {
        onChange(textResult);
      }
    },
    onFocus: () => {
      setInsertMentionHandler(insertMention);
    },
  });

  return <EditorContent editor={editor} />;
};
