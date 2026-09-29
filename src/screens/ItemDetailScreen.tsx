import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DetailChrome } from '../components/detail/DetailChrome';
import { NoteBody } from '../components/detail/NoteBody';
import { FileViewer } from '../components/detail/FileViewer';
import { LinkPanel } from '../components/detail/LinkPanel';
import { MetaBlock } from '../components/detail/MetaBlock';
import { itemService } from '../services/ItemService';
import { db } from '../db/database';
import type { Item, NoteItem, FileItem, LinkItem } from '../types/item';
import type { QueryState } from '../types/query';

export const ItemDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const itemQuery = useLiveQuery<QueryState<Item>>(
    async () => {
      if (!id) return { status: 'notFound' };
      const direct = await db.items.get(id);
      if (direct) return { status: 'found', data: direct };
      return { status: 'notFound' };
    },
    [id]
  );

  const queryState: QueryState<Item> = itemQuery ?? { status: 'loading' };
  const foundItem = queryState.status === 'found' ? queryState.data : undefined;

  // Update lastOpenedAt on view
  useEffect(() => {
    if (foundItem?.id) {
      itemService.touchOpened(foundItem.id);
    }
  }, [foundItem?.id]);

  if (queryState.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <span className="w-6 h-6 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (queryState.status === 'notFound') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-[36px] text-[#BA1A1A] mb-2">
          error_outline
        </span>
        <h2 className="type-headline-xs text-[#1B1B1B]">Không tìm thấy mục tri thức</h2>
        <p className="type-body-xs text-[#75777D] mt-1 mb-4">
          Mục này có thể đã bị xóa hoặc không tồn tại.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#E8E8E8] hover:bg-[#DADADA] text-[#1B1B1B] rounded-lg text-xs font-mono font-bold border border-[#3D4A5C]/30 transition cursor-pointer press-xs"
          >
            QUAY LẠI THƯ VIỆN
          </button>
        </div>
      </div>
    );
  }

  const item = queryState.data;
  const backLabel = item.status === 'inbox' ? 'Hộp chờ' : 'Thư viện';

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF] min-h-screen">
      <DetailChrome item={item} backLabel={backLabel} />

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-20">
        {/* Main Content Component by Type */}
        {item.type === 'note' && <NoteBody item={item as NoteItem} />}

        {item.type === 'file' && <FileViewer item={item as FileItem} />}

        {item.type === 'link' && <LinkPanel item={item as LinkItem} />}

        {/* Metadata Block */}
        <MetaBlock item={item} />
      </div>
    </div>
  );
};
