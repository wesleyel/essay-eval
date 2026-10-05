import { SENTENCE_FUNCTION_LABELS, SUBSTITUTE_LEVEL_LABELS, UPGRADE_CATEGORY_LABELS, type Inspiration } from '@essay/domain';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { TextActionButtons, type TextActions } from './EvaluationView';
import { CopyButton } from './ui';

export function InspirationView({ inspiration, onLocate, onReplace }: TextActions & { inspiration: Inspiration }) {
  return (
    <div className="space-y-4 text-xs">
      <section>
        <h4 className="flex items-center gap-1.5 border-b border-zinc-200 pb-2 font-semibold text-zinc-900">
          <Sparkles className="size-4 text-amber-500" />
          重点句剖析与高分变体
        </h4>
        <div className="mt-2 space-y-3">
          {inspiration.sentences.map((sentence, index) => (
            <article key={index} className="border-b border-zinc-200 pb-3 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <p className="leading-relaxed text-zinc-800">{sentence.original}</p>
                <span className="chip shrink-0 bg-zinc-100 text-zinc-600">{SENTENCE_FUNCTION_LABELS[sentence.function]}</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-zinc-500">
                <span className="font-medium text-amber-700">点评：</span>
                {sentence.critique}
              </p>
              <div className="mt-2 space-y-1.5">
                {sentence.variations.map((variation, variationIndex) => (
                  <div key={variationIndex} className="border border-zinc-200 bg-zinc-50 p-2">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-zinc-400">{variationIndex + 1}</span>
                      <p className="min-w-0 flex-1 leading-relaxed text-zinc-700">{variation}</p>
                      <CopyButton text={variation} label="复制变体" />
                    </div>
                    <TextActionButtons original={sentence.original} replacement={variation} onLocate={onLocate} onReplace={onReplace} />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {inspiration.upgrades.length > 0 && (
        <section className="border-t border-zinc-200 pt-3">
          <h4 className="font-semibold text-zinc-900">用词升级矩阵</h4>
          <div className="mt-2 space-y-2">
            {inspiration.upgrades.map((upgrade, index) => (
              <div key={index} className="border border-zinc-200 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-rose-700">{upgrade.word}</span>
                  <ArrowRight className="size-3 text-zinc-400" />
                  <span className="text-zinc-500">{UPGRADE_CATEGORY_LABELS[upgrade.category]}</span>
                </div>
                {upgrade.context && <p className="mt-1 text-zinc-500">“{upgrade.context}”</p>}
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {upgrade.substitutes.map((substitute, subIndex) => (
                    <div key={subIndex} className="bg-zinc-50 p-2">
                      <div className="flex justify-between gap-2">
                        <strong className="text-accent-strong">{substitute.word}</strong>
                        <span className="text-[10px] text-zinc-500">{SUBSTITUTE_LEVEL_LABELS[substitute.level]}</span>
                      </div>
                      <p className="mt-0.5 text-zinc-600">{substitute.nuance}</p>
                      {substitute.example && <p className="mt-1 text-zinc-500">例：{substitute.example}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {inspiration.structureTips.length > 0 && (
        <section className="border-t border-zinc-200 pt-3">
          <h4 className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <BookOpen className="size-3.5 text-accent" />
            结构与逻辑建议
          </h4>
          <ul className="mt-2 space-y-1.5">
            {inspiration.structureTips.map((tip, index) => (
              <li key={index} className="flex gap-1.5 leading-relaxed text-zinc-600">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-accent" />
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
