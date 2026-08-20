import { foldersHooks } from '@/features/folders/lib/folders-hooks';
import { FlowsTable } from './flows-table';
import { useEffect } from 'react';

const FlowsPage = () => {
  // Auto-create predefined folders when entering FlowsPage
  // This ensures all predefined folders exist for better organization
  const { mutate: createPredefinedFolders } =
    foldersHooks.useCreatePredefinedFolders();

  // Auto-create predefined folders on component mount
  // This runs every time the FlowsPage is loaded
  useEffect(() => {
    createPredefinedFolders();
  }, [createPredefinedFolders]);

  return <FlowsTable />;
};

export { FlowsPage };
