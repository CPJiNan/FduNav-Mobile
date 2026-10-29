import React, { useEffect, useState } from 'react';
import type { NoticeDetail, NoticeRef } from '../shared/notices';
import { noticeImageUrls } from '../services/notice-body';
import { noticeHtml, escapeHtml } from '../services/rich-content';
import { fetchNoticeImage } from '../services/notice-assets';
import { RichText } from './RichText';
export function NoticeBody({ detail, notice }: { detail: NoticeDetail; notice: NoticeRef }) {
  const [images, setImages] = useState<Record<string, string | false>>({});
  useEffect(() => {
    let alive = true;
    setImages({});
    for (const url of noticeImageUrls(detail.body))
      void fetchNoticeImage(url, notice.url)
        .then((value) => {
          if (alive) setImages((s) => ({ ...s, [url]: value }));
        })
        .catch(() => {
          if (alive) setImages((s) => ({ ...s, [url]: false }));
        });
    return () => {
      alive = false;
    };
  }, [detail, notice.url]);
  return (
    <RichText
      kind="notice"
      html={
        detail.body.length
          ? noticeHtml(detail.body, images)
          : '<pre>' + escapeHtml(detail.content) + '</pre>'
      }
      onRetry={(url) => {
        if (!noticeImageUrls(detail.body).includes(url)) return;
        setImages((s) => {
          const next = { ...s };
          delete next[url];
          return next;
        });
        void fetchNoticeImage(url, notice.url)
          .then((value) => setImages((s) => ({ ...s, [url]: value })))
          .catch(() => setImages((s) => ({ ...s, [url]: false })));
      }}
    />
  );
}
