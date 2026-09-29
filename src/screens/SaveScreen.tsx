import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { EditorForm } from '../components/editor/EditorForm';
import type { ItemType } from '../types/item';

export const SaveScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const defaultTitle = searchParams.get('title') || '';
  const defaultType: ItemType =
    rawType === 'note' || rawType === 'file' || rawType === 'link' ? rawType : 'note';

  return (
    <EditorForm
      isEditing={false}
      defaultType={defaultType}
      defaultTitle={defaultTitle}
    />
  );
};
