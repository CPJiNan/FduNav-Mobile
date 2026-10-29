import { randomUUID } from 'expo-crypto';
import { SummaryQueue } from './summary-queue';
import { parseSummaryOutput, summaryMessages } from './summary-content';
import { fetchDetail } from './network';
import { complete } from './llm';
import { noticeKey, type MobileState } from '../model';
import type { Notice, NoticeSummary } from '../shared/notices';
import { validateRequiredMessagePreferences } from '../shared/message-preferences';
export class SummaryService {
  readonly queue = new SummaryQueue(randomUUID);
  private automatic = new Map<string, { notice: Notice; owner: string }>();
  private scheduled = false;
  enqueueAutomatic(notices: Notice[]) {
    const owner = this.owner();
    if (!owner) return;
    for (const notice of notices) this.automatic.set(noticeKey(notice), { notice, owner });
    this.drainAutomatic();
  }
  private drainAutomatic() {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const s = this.state();
      if (!s.settings.noticeSettings.autoSummary || !s.settings.llm.enabled || !this.owner()) {
        this.automatic.clear();
        return;
      }
      for (const [key, item] of this.automatic) {
        if (this.queue.activeCount >= 200) break;
        this.automatic.delete(key);
        if (item.owner === this.owner() && s.sourceIds.includes(item.notice.sourceId as never))
          void this.summarize(item.notice).catch(() => {});
      }
    });
  }
  private pending = new Map<string, Promise<NoticeSummary>>();
  constructor(
    private state: () => MobileState,
    private save: (update: (s: MobileState) => MobileState) => Promise<void>,
    private owner: () => string | null,
  ) {
    this.queue.subscribe(() => this.drainAutomatic());
  }
  private context(notice: Notice) {
    const s = this.state();
    const owner = this.owner();
    if (!owner) throw new Error('请先登录。');
    if (!validateRequiredMessagePreferences(s.settings.preferences).ok)
      throw new Error('请先完善消息偏好。');
    return JSON.stringify([
      4,
      owner,
      noticeKey(notice),
      s.settings.preferences,
      s.settings.llm.baseUrl,
      s.settings.llm.model,
      s.settings.llm.summaryPrompt,
    ]);
  }
  cached(notice: Notice): NoticeSummary | null {
    const s = this.state();
    const key = noticeKey(notice);
    try {
      const meta = s.summaryMeta[key];
      return meta?.context === this.context(notice) && s.summaries[key]
        ? {
            content: s.summaries[key],
            model: meta.model,
            relevance: notice.relevance ?? null,
            cached: true,
          }
        : null;
    } catch {
      return null;
    }
  }
  summarize(notice: Notice, force = false): Promise<NoticeSummary> {
    let context: string;
    try {
      context = this.context(notice);
    } catch (e) {
      return Promise.reject(e);
    }
    const running = this.pending.get(context);
    if (running) return running;
    const cached = this.cached(notice);
    if (cached && !force) return Promise.resolve(cached);
    const state = this.state();
    if (!state.settings.llm.enabled) return Promise.reject(new Error('请先在设置中启用 LLM。'));
    if (!state.settings.llm.model) return Promise.reject(new Error('请先配置 LLM 模型。'));
    const promise = this.queue.enqueue(notice, this.owner()!, async (signal, stage) => {
      const assert = () => {
        signal.throwIfAborted();
        if (context !== this.context(notice))
          throw new Error('账号、消息偏好或 LLM 设置已变化，请重新生成摘要。');
      };
      assert();
      const detail = await fetchDetail(notice);
      assert();
      if (detail.requiresLogin) throw new Error('需要登录后才能生成摘要。');
      if (!detail.content.trim()) throw new Error('这条通知没有可摘要的正文，请查看学校原文。');
      const messages = summaryMessages(
        notice,
        detail.content,
        state.settings.preferences,
        state.settings.llm.summaryPrompt,
      );
      stage('generating');
      const text = await complete(
        state.settings.llm,
        messages.slice(1) as any,
        signal,
        messages[0].content,
      );
      assert();
      const result = parseSummaryOutput(text);
      stage('saving');
      const content = result.content.slice(0, 4000);
      const key = noticeKey(notice);
      await this.save((s) => {
        assert();
        return {
          ...s,
          details: { ...s.details, [key]: detail },
          summaries: { ...s.summaries, [key]: content },
          summaryMeta: { ...s.summaryMeta, [key]: { context, model: state.settings.llm.model } },
          notices: s.notices.map((n) =>
            noticeKey(n) === key
              ? {
                  ...n,
                  relevance:
                    s.relevanceChoices[key] === undefined
                      ? result.relevance
                      : s.relevanceChoices[key] === 'none'
                        ? null
                        : s.relevanceChoices[key],
                }
              : n,
          ),
        };
      });
      return {
        content,
        model: state.settings.llm.model,
        relevance: result.relevance,
        cached: false,
      };
    });
    this.pending.set(context, promise);
    void promise.finally(() => this.pending.delete(context)).catch(() => {});
    return promise;
  }
}
