import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BaseEditorLayout } from './BaseEditorLayout';
import { InlineError } from '../feedback/InlineError';
import { linkMetaService } from '../../services/LinkMetaService';
import { itemService } from '../../services/ItemService';
import type { LinkItem, Item, ItemType } from '../../types/item';
import type { CommonEditorMeta } from './types';

export interface LinkEditorFormProps {
  initialItem?: LinkItem;
  isEditing?: boolean;
  commonMeta: CommonEditorMeta;
  onCommonMetaChange: (updates: Partial<CommonEditorMeta>) => void;
  onTypeChange?: (type: ItemType) => void;
  conflictBanner?: React.ReactNode;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const LinkEditorForm: React.FC<LinkEditorFormProps> = ({
  initialItem,
  isEditing = false,
  commonMeta,
  onCommonMetaChange,
  onTypeChange,
  conflictBanner,
  onDirtyChange,
}) => {
  const navigate = useNavigate();

  // Link-specific state
  const [url, setUrl] = useState(initialItem?.url || '');
  const [reason, setReason] = useState(initialItem?.reason || '');
  const [duplicateItem, setDuplicateItem] = useState<Item | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Validate URL & check for duplicates asynchronously
  useEffect(() => {
    let isCancelled = false;

    if (!url.trim()) {
      setDuplicateItem(null);
      setUrlError(null);
      return;
    }

    if (!linkMetaService.isValidUrl(url)) {
      setUrlError('Địa chỉ URL chưa đúng định dạng');
      setDuplicateItem(null);
      return;
    }

    setUrlError(null);

    itemService.checkDuplicateUrl(url, initialItem?.id).then((dup) => {
      if (!isCancelled) {
        setDuplicateItem(dup);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [url, initialItem?.id]);

  const isDirty = Boolean(
    url !== (initialItem?.url || '') ||
    commonMeta.title !== (initialItem?.title || '') ||
    reason !== (initialItem?.reason || '') ||
    commonMeta.tags.join(',') !== (initialItem?.tags || []).join(',') ||
    commonMeta.collections.join(',') !== (initialItem?.collections || []).join(',') ||
    commonMeta.isPinned !== (initialItem?.isPinned || false) ||
    commonMeta.keepLong !== (initialItem ? initialItem.status === 'saved' : true)
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const canSubmit = !isSubmitting && Boolean(url.trim() && !urlError);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (isEditing && initialItem) {
        const currentLink = initialItem;
        const baseUpdates = {
          title: commonMeta.title.trim() || undefined,
          tags: commonMeta.tags,
          collections: commonMeta.collections,
          isPinned: commonMeta.isPinned,
          status: commonMeta.keepLong ? ('saved' as const) : ('inbox' as const),
          savedAt: commonMeta.keepLong ? initialItem.savedAt || Date.now() : null,
        };

        await itemService.updateItem(initialItem.id, {
          ...baseUpdates,
          url: linkMetaService.normalizeUrl(url),
          domain: linkMetaService.parseDomain(url),
          reason,
          fetchedTitle: currentLink.fetchedTitle || null,
          previewImageUrl: currentLink.previewImageUrl || null,
          fetchStatus: currentLink.fetchStatus ?? (currentLink.fetchedTitle || currentLink.previewImageUrl ? 'success' : 'idle'),
        });

        navigate(`/items/${initialItem.id}`, { replace: true });
      } else {
        await itemService.createItem(
          {
            type: 'link',
            title: commonMeta.title.trim() || undefined,
            tags: commonMeta.tags,
            collections: commonMeta.collections,
            isPinned: commonMeta.isPinned,
            url,
            reason,
          },
          commonMeta.keepLong
        );

        const destination = commonMeta.keepLong ? '/' : '/inbox';
        navigate(destination, { replace: true });
      }
    } catch (err: unknown) {
      console.error('Failed to save link item:', err);
      setFormError((err as Error)?.message || 'Không thể lưu liên kết. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  return (
    <BaseEditorLayout
      title={isEditing ? 'Chỉnh sửa tri thức' : 'Lưu tri thức mới'}
      selectedType="link"
      isEditing={isEditing}
      onTypeChange={onTypeChange}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      formError={formError}
      conflictBanner={conflictBanner}
      tags={commonMeta.tags}
      onTagsChange={(tags) => onCommonMetaChange({ tags })}
      collections={commonMeta.collections}
      onCollectionsChange={(collections) => onCommonMetaChange({ collections })}
      isPinned={commonMeta.isPinned}
      onPinChange={(isPinned) => onCommonMetaChange({ isPinned })}
      keepLong={commonMeta.keepLong}
      onKeepLongChange={(keepLong) => onCommonMetaChange({ keepLong })}
    >
      <div className="space-y-3">
        <div>
          <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
            Địa chỉ Web (URL)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#3D4A5C]">
              link
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full pl-9 pr-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
            />
          </div>
          {urlError && <InlineError message={urlError} className="mt-1" />}
          {/* Duplicate URL Non-blocking warning */}
          {duplicateItem && (
            <div className="mt-2 p-2.5 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg text-xs flex items-center justify-between text-[#44474C] shadow-hard-xs">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">info</span>
                <span>Liên kết này đã có trong kho:</span>
              </div>
              <Link
                to={`/items/${duplicateItem.id}`}
                className="font-bold text-[#3D4A5C] underline truncate max-w-[140px]"
              >
                {duplicateItem.title}
              </Link>
            </div>
          )}
        </div>

        <div>
          <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
            Tiêu đề bài viết / Trang web
          </label>
          <input
            type="text"
            value={commonMeta.title}
            onChange={(e) => onCommonMetaChange({ title: e.target.value })}
            placeholder="Tiêu đề trang hoặc tên gợi nhớ..."
            className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
          />
        </div>

        <div>
          <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
            Lý do giữ (Vì sao giữ lại liên kết này?)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ý tưởng hoặc thông tin quan trọng rút ra..."
            rows={3}
            className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
          />
        </div>
      </div>
    </BaseEditorLayout>
  );
};
