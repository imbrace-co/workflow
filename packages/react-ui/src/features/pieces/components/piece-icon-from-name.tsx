import { piecesHooks } from '../lib/pieces-hooks';

import { PieceIcon } from './piece-icon';

type PieceIconWithPieceNameProps = {
  pieceName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  border?: boolean;
  circle?: boolean;
  showTooltip?: boolean;
  flowMetadataTags?: (string | { id: string; name: string })[];
};

const PieceIconWithPieceName = ({
  pieceName,
  size = 'md',
  border = true,
  circle = true,
  showTooltip = true,
  flowMetadataTags,
}: PieceIconWithPieceNameProps) => {
  const { pieceModel } = piecesHooks.usePiece({
    name: pieceName,
  });

  return (
    <PieceIcon
      circle={circle}
      size={size}
      border={border}
      displayName={pieceModel?.displayName}
      logoUrl={pieceModel?.logoUrl}
      showTooltip={showTooltip}
      pieceName={pieceName}
      flowMetadataTags={flowMetadataTags}
    />
  );
};

export default PieceIconWithPieceName;
