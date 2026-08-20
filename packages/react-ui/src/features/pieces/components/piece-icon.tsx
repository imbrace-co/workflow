import { VariantProps, cva } from 'class-variance-authority';
import React from 'react';

import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CHANNEL_TYPE } from '@/lib/imbrace/channel';

const pieceIconVariants = cva('flex items-center justify-center   ', {
  variants: {
    circle: {
      true: 'rounded-full  p-2',
      false: 'dark:rounded-[2px]',
    },
    size: {
      xxl: 'size-[64px] p-4',
      xl: 'size-[48px]',
      lg: 'size-[40px]',
      md: 'size-[36px]',
      sm: 'size-[25px]',
      xs: 'size-[18px]',
    },
    border: {
      true: 'border border-solid',
    },
  },
  defaultVariants: {},
});

interface PieceIconCircleProps extends VariantProps<typeof pieceIconVariants> {
  displayName?: string;
  logoUrl?: string;
  showTooltip: boolean;
  pieceName?: string;
  flowMetadataTags?: (string | { id: string; name: string })[];
}

const PieceIcon = React.memo(
  ({
    displayName,
    logoUrl,
    border,
    size,
    circle = false,
    showTooltip,
    pieceName,
    flowMetadataTags = [],
  }: PieceIconCircleProps) => {
    // Check if this is a webhook piece with channel-specific tags
    const isWebhookPiece = pieceName === '@activepieces/piece-webhook';
    
    // Find current channel type based on flow metadata tags
    const currentChannelType = CHANNEL_TYPE.find(channel => 
      flowMetadataTags.some(tag => 
        typeof tag === 'string' ? tag === channel.tag : tag?.name === channel.tag
      )
    )?.tag;

    console.log({isWebhookPiece, currentChannelType},'-------');
    
    // Use local icon for webhook pieces with channel type
    const finalLogoUrl = React.useMemo(() => {
      if (isWebhookPiece && currentChannelType) {
        return `/node-icons/icon_${currentChannelType}Trigger.svg`;
      }
      return logoUrl;
    }, [isWebhookPiece, currentChannelType, logoUrl]);

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(pieceIconVariants({ border, size, circle }))}>
            {finalLogoUrl ? (
              <ImageWithFallback
                src={finalLogoUrl}
                alt={displayName}
                className="object-contain w-full h-full "
                key={finalLogoUrl}
                fallback={<Skeleton className="rounded-full w-full h-full" />}
              />
            ) : (
              <Skeleton className="rounded-full w-full h-full" />
            )}
          </div>
        </TooltipTrigger>
        {showTooltip ? (
          <TooltipContent side="bottom">{displayName}</TooltipContent>
        ) : null}
      </Tooltip>
    );
  },
);

PieceIcon.displayName = 'PieceIcon';
export { PieceIcon };
